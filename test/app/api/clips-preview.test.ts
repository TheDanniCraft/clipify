/** @jest-environment node */
const preview = jest.fn();
jest.mock("@actions/creatorLibrary", () => ({ getCreatorClipPreview: (...args: unknown[]) => preview(...args) }));
import { GET } from "@/app/api/clips/preview/route";
const url = "http://localhost/api/clips/preview?creatorId=owner&clipId=ClipA";
beforeEach(() => {
	preview.mockReset().mockResolvedValue({ playbackUrl: "https://production.assets.clips.twitchcdn.net/clip.mp4" });
	jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([1, 2]), { headers: { "content-type": "video/mp4", "content-length": "2" } }));
});
afterEach(() => jest.restoreAllMocks());
it("serves trusted authorized video without requiring CDN CORS and forwards byte ranges", async () => {
	jest.mocked(fetch).mockResolvedValueOnce(new Response(new Uint8Array([1, 2]), { status: 206, headers: { "content-type": "video/mp4", "content-length": "2", "content-range": "bytes 2-3/4" } }));
	const result = await GET(new Request(url, { headers: { range: "bytes=2-3" } }));
	expect(result.status).toBe(206);
	expect([...new Uint8Array(await result.arrayBuffer())]).toEqual([1, 2]);
	expect(result.headers.get("cache-control")).toBe("private, no-store");
	expect(result.headers.get("content-range")).toBe("bytes 2-3/4");
	expect(result.headers.get("server-timing")).toMatch(/^playback;dur=\d+\.\d, upstream;dur=\d+\.\d$/);
	expect(fetch).toHaveBeenCalledWith(expect.stringContaining("twitchcdn.net"), expect.objectContaining({ redirect: "manual", headers: { Range: "bytes=2-3" } }));
});
it("never accepts arbitrary media URLs or inaccessible clips", async () => {
	for (const playbackUrl of [undefined, "http://127.0.0.1/private", "https://evil.invalid/clip.mp4"]) {
		preview.mockResolvedValueOnce({ playbackUrl });
		expect((await GET(new Request(url + "&url=https://evil.invalid"))).status).toBe(404);
	}
	expect(fetch).not.toHaveBeenCalled();
	for (const requestUrl of ["http://localhost/api/clips/preview", "http://localhost/api/clips/preview?creatorId=owner", url.replace("owner", "x".repeat(201)), url.replace("ClipA", "../secret")]) expect((await GET(new Request(requestUrl))).status).toBe(400);
	expect((await GET(new Request(url, { headers: { range: "invalid" } }))).status).toBe(400);
});
it("rejects non-video, redirected, missing, failed and oversized upstream responses", async () => {
	for (const response of [new Response("<html>", { headers: { "content-type": "text/html" } }), new Response(null, { status: 302 }), new Response(null), new Response("x", { headers: { "content-length": String(33 * 1024 * 1024) } })]) {
		jest.mocked(fetch).mockResolvedValueOnce(response);
		expect((await GET(new Request(url))).status).toBe(502);
	}
	preview.mockRejectedValueOnce(Error("offline"));
	expect((await GET(new Request(url))).status).toBe(502);
});
it("streams a complete video and rejects actual bytes beyond the declared size cap", async () => {
	const good = await GET(new Request(url + "&refresh=1"));
	expect(good.status).toBe(200);
	expect([...new Uint8Array(await good.arrayBuffer())]).toEqual([1, 2]);
	expect(preview).toHaveBeenLastCalledWith({ creatorId: "owner", clipId: "ClipA", refresh: true });
	jest.mocked(fetch).mockResolvedValueOnce(new Response(new Uint8Array(32 * 1024 * 1024 + 1), { headers: { "content-type": "application/octet-stream", "content-length": "2" } }));
	const oversized = await GET(new Request(url));
	await expect(oversized.arrayBuffer()).rejects.toThrow("byte_limit");
});

it("serves Twitch CDN binary/octet-stream media as video/mp4", async () => {
	jest.mocked(fetch).mockResolvedValueOnce(new Response(new Uint8Array([1, 2]), { status: 206, headers: { "content-type": "binary/octet-stream", "content-length": "2", "content-range": "bytes 0-1/2" } }));
	const result = await GET(new Request(url, { headers: { range: "bytes=0-" } }));
	expect(result.status).toBe(206);
	expect(result.headers.get("content-type")).toBe("video/mp4");
	expect([...new Uint8Array(await result.arrayBuffer())]).toEqual([1, 2]);
});
