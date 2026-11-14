/** @jest-environment node */
const lookup = jest.fn(),
	playback = jest.fn();
jest.mock("@/db/client", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: () => lookup() }) }) }) } }));
jest.mock("@/app/actions/twitch", () => ({ getTwitchClipPlaybackUrl: (...args: unknown[]) => playback(...args) }));
import { GET } from "@/app/api/events/[eventId]/clips/[clipId]/route";
const eventId = "11111111-1111-4111-8111-111111111111",
	clipId = "ClipOne";
const params = Promise.resolve({ eventId, clipId });
beforeEach(() => {
	jest.resetAllMocks();
	lookup.mockResolvedValue([{ ownerId: "host" }]);
	playback.mockResolvedValue("https://production.assets.clips.twitchcdn.net/clip.mp4");
	jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([1, 2]), { status: 206, headers: { "content-type": "video/mp4", "content-range": "bytes 0-1/2" } }));
});
afterEach(() => jest.restoreAllMocks());
it("uses the stored event owner, scopes preview access and forwards byte ranges", async () => {
	const response = await GET(new Request(`https://example.invalid/api/events/${eventId}/clips/${clipId}?preview=capability&creatorId=foreign`, { headers: { Range: "bytes=0-" } }), { params });
	expect(response.status).toBe(206);
	expect(playback).toHaveBeenCalledWith(clipId, "host", { kind: "event", eventId, previewToken: "capability" });
	expect(response.headers.get("content-range")).toBe("bytes 0-1/2");
	expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2]);
});
it("fails closed before fetching media when the clip is unavailable or access is revoked", async () => {
	playback.mockResolvedValue(undefined);
	expect((await GET(new Request("https://example.invalid"), { params })).status).toBe(404);
	expect(fetch).not.toHaveBeenCalled();
	expect((await GET(new Request("https://example.invalid", { headers: { Range: "invalid" } }), { params })).status).toBe(404);
	expect(playback).toHaveBeenCalledTimes(1);
});
