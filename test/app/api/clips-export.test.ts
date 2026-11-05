/** @jest-environment node */
import { POST } from "@/app/api/clips/export/route";
const archive = jest.fn();
const planArchive = jest.fn();
jest.mock("@/server/clip-export", () => ({ ...jest.requireActual("@/server/clip-export"), buildClipArchive: (...args: unknown[]) => archive(...args), buildClipExportPlan: (...args: unknown[]) => planArchive(...args) }));
it("rejects cross-origin export before preparing media", async () => {
	const response = await POST(new Request("https://clipify.test/api/clips/export", { method: "POST", headers: { origin: "https://other.test", "content-type": "application/json" }, body: JSON.stringify({ creatorId: "owner", clipIds: ["A"] }) }));
	expect(response.status).toBe(403);
	expect(archive).not.toHaveBeenCalled();
});

it("returns the private attachment and bounded positional summary", async () => {
	archive.mockResolvedValue({ ok: true, bytes: new Uint8Array([1, 2, 3]), summary: { included: [0], skipped: [] } });
	const response = await POST(new Request("https://clipify.test/api/clips/export", { method: "POST", headers: { origin: "https://clipify.test", "content-type": "application/json" }, body: JSON.stringify({ creatorId: "owner", clipIds: ["A"] }) }));
	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toBe("application/zip");
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(JSON.parse(Buffer.from(response.headers.get("X-Clipify-Export-Result")!, "base64url").toString())).toEqual({ included: [0], skipped: [] });
	expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
});

it("checks the browser-facing Host when Next supplies an internal request origin", async () => {
	archive.mockResolvedValue({ ok: true, bytes: new Uint8Array([1, 2, 3]), summary: { included: [0], skipped: [] } });
	const response = await POST(new Request("http://127.0.0.1:3107/api/clips/export", { method: "POST", headers: { origin: "http://127.0.0.1:45678", host: "127.0.0.1:45678", "content-type": "application/json" }, body: JSON.stringify({ creatorId: "owner", clipIds: ["A"] }) }));
	expect(response.status).toBe(200);
});

const request = (body = "{}", headers: Record<string, string> = {}) => new Request("https://clipify.test/api/clips/export", { method: "POST", headers: { origin: "https://clipify.test", "content-type": "application/json", ...headers }, body });
it("rejects non-JSON requests", async () => {
	const result = await POST(request("{}", { "content-type": "text/plain" }));
	expect(result.status).toBe(400);
	expect(await result.json()).toMatchObject({ code: "INVALID_INPUT" });
});
it("rejects malformed JSON", async () => {
	expect((await POST(request("{"))).status).toBe(400);
});
it("enforces declared and actual request byte caps", async () => {
	expect((await POST(request("{}", { "content-length": "65537" }))).status).toBe(413);
	expect((await POST(request(" ".repeat(65537)))).status).toBe(413);
});
it("preserves typed provider failures and retry timing", async () => {
	archive.mockResolvedValue({ ok: false, code: "RATE_LIMITED", status: 429, retryAt: new Date(Date.now() + 60000).toISOString() });
	const result = await POST(request());
	expect(result.status).toBe(429);
	expect(Number(result.headers.get("retry-after"))).toBeGreaterThan(0);
	expect(await result.json()).toMatchObject({ code: "RATE_LIMITED" });
});
it("bounds the response summary header", async () => {
	archive.mockResolvedValue({ ok: true, bytes: new Uint8Array(), summary: { included: [0], skipped: [], unexpected: "x".repeat(20000) } });
	const result = await POST(request());
	expect(result.status).toBe(413);
	expect(await result.json()).toMatchObject({ code: "EXPORT_LIMIT" });
});
it("returns a private controlled failure when packaging throws", async () => {
	archive.mockRejectedValue(new Error("private"));
	const result = await POST(request());
	expect(result.status).toBe(503);
	expect(await result.json()).toEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
	expect(result.headers.get("cache-control")).toBe("private, no-store");
});
it("rejects a malformed browser host without an uncaught route exception", async () => {
	const result = await POST(request("{}", { host: "[" }));
	expect(result.status).toBe(403);
});
it("accepts the browser HTTPS origin forwarded by the deployment proxy", async () => {
	archive.mockResolvedValue({ ok: true, bytes: new Uint8Array([1]), summary: { included: [0], skipped: [] } });
	const result = await POST(new Request("http://127.0.0.1:3000/api/clips/export", { method: "POST", headers: { host: "preview.clipify.test", origin: "https://preview.clipify.test", "x-forwarded-proto": "https", "content-type": "application/json" }, body: "{}" }));
	expect(result.status).toBe(200);
});
it("sends individual MP4 through the same authorized pipeline", async () => {
	archive.mockResolvedValue({ ok: true, bytes: new Uint8Array([1]), filename: "Winning round.mp4", summary: { included: [0], skipped: [] } });
	const input = new Request("https://clipify.test/api/clips/export?format=mp4", { method: "POST", headers: { origin: "https://clipify.test", "content-type": "application/json" }, body: '{"creatorId":"owner","clipIds":["A"]}' });
	const response = await POST(input);
	expect(response.headers.get("content-type")).toBe("video/mp4");
	expect(response.headers.get("content-disposition")).toContain("Winning%20round.mp4");
	expect(archive).toHaveBeenLastCalledWith({ creatorId: "owner", clipIds: ["A"] }, input.signal, "mp4");
});
it("rejects unsupported download formats", async () => {
	const response = await POST(new Request("https://clipify.test/api/clips/export?format=html", { method: "POST", headers: { origin: "https://clipify.test", "content-type": "application/json" }, body: "{}" }));
	expect(response.status).toBe(400);
});
it("streams per-clip progress before the bounded download bytes", async () => {
	archive.mockImplementation(async (_input, _signal, _format, progress) => {
		progress({ index: 0, stage: "processing", title: "Owned clip" });
		return { ok: true, bytes: new Uint8Array([1, 2, 3]), summary: { included: [0], skipped: [] } };
	});
	const req = new Request("https://clipify.test/api/clips/export?progress=1", { method: "POST", headers: { origin: "https://clipify.test", "content-type": "application/json" }, body: JSON.stringify({ creatorId: "owner", clipIds: ["A"] }) });
	const result = await POST(req);
	expect(result.headers.get("content-type")).toBe("application/vnd.clipify.export-stream");
	expect(result.headers.get("x-accel-buffering")).toBe("no");
	const bytes = new Uint8Array(await result.arrayBuffer());
	expect(new TextDecoder().decode(bytes)).toContain('"stage":"processing"');
	expect([...bytes.slice(-3)]).toEqual([1, 2, 3]);
});
it("streams a controlled error rather than an unhandled rejected response", async () => {
	archive.mockRejectedValue(new Error("private detail"));
	const result = await POST(new Request("https://clipify.test/api/clips/export?progress=1", { method: "POST", headers: { origin: "https://clipify.test", "content-type": "application/json" }, body: "{}" }));
	expect(await result.text()).toBe(JSON.stringify({ type: "error", code: "SERVICE_UNAVAILABLE" }) + "\n");
});
it("streams typed access denial without a file and cancels active work on disconnect", async () => {
	archive.mockResolvedValueOnce({ ok: false, code: "PERMISSION_DENIED", status: 403 });
	const make = () => new Request("https://clipify.test/api/clips/export?progress=1", { method: "POST", headers: { origin: "https://clipify.test", "content-type": "application/json" }, body: "{}" });
	expect(await (await POST(make())).text()).toContain('"code":"PERMISSION_DENIED"');
	let signal!: AbortSignal;
	archive.mockImplementation((_input, abort) => {
		signal = abort;
		return new Promise((resolve) => abort.addEventListener("abort", () => resolve({ ok: false, code: "EXPORT_CANCELLED", status: 499 })));
	});
	const response = await POST(make());
	await response.body!.cancel();
	expect(signal.aborted).toBe(true);
});

it("dispatches a bounded multi-version plan through the private progress response", async () => {
	archive.mockClear();
	archive.mockResolvedValue({ ok: true, bytes: new Uint8Array([1, 2, 3]), summary: { included: [0], skipped: [] } });
	planArchive.mockResolvedValue({ ok: true, bytes: new Uint8Array([1, 2, 3]), summary: { included: [0], skipped: [] } });
	const input = { creatorId: "owner", files: [{ clipId: "A", outputKey: "original" }], outputs: [{ key: "original", label: "Original" }] };
	const response = await POST(new Request("https://clipify.test/api/clips/export?plan=1&progress=1", { method: "POST", headers: { origin: "https://clipify.test", "content-type": "application/json" }, body: JSON.stringify(input) }));
	await response.arrayBuffer();
	expect(planArchive).toHaveBeenCalledWith(input, expect.any(AbortSignal), "zip", expect.any(Function));
	expect(archive).not.toHaveBeenCalled();
});
