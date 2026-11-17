/** @jest-environment node */
const clips = jest.fn();
const playback = jest.fn();
jest.mock("@/server/resources/clip-validation", () => ({ resolveValidatedPlaylistClips: (...a: unknown[]) => clips(...a) }));
jest.mock("@/server/clip-playback-resolver", () => ({ resolveTwitchClipPlaybackUrl: (...a: unknown[]) => playback(...a) }));
import { resolveConnectedClip } from "@/server/connected-apps/clip-read";
const clip = { id: "ClipA", title: "Title", duration: 12, broadcaster_id: "owner", created_at: "2026-11-01T00:00:00Z" };
beforeEach(() => {
	clips.mockReset().mockResolvedValue([clip]);
	playback.mockReset().mockResolvedValue("https://production.assets.clips.twitchcdn.net/clip.mp4");
});
it("resolves explicit clip references to matching creator metadata", async () => {
	const r = await resolveConnectedClip("owner", "https://clips.twitch.tv/ClipA");
	expect(r).toMatchObject({ creatorId: "owner", clip: { id: "ClipA", broadcasterId: "owner" } });
	expect(playback).not.toHaveBeenCalled();
});
it("returns playback only after verifying exact creator ownership", async () => {
	const r = await resolveConnectedClip("owner", "ClipA", true);
	expect(r).toMatchObject({ creatorId: "owner", clipId: "ClipA", playbackUrl: expect.stringContaining("twitchcdn.net") });
	expect(playback).toHaveBeenCalledWith("ClipA", "owner");
});
it.each([{ value: [] }, { value: [{ ...clip, broadcaster_id: "foreign" }] }, { value: [{ ...clip, id: "Other" }] }])("denies missing/foreign clips before resolving playback %j", async ({ value }) => {
	clips.mockResolvedValue(value);
	await expect(resolveConnectedClip("owner", "ClipA", true)).rejects.toMatchObject({ code: "NOT_FOUND" });
	expect(playback).not.toHaveBeenCalled();
});
it.each([undefined, "https://attacker.example/video.mp4", "http://production.assets.clips.twitchcdn.net/clip.mp4"])("rejects absent or untrusted playback %s", async (value) => {
	playback.mockResolvedValue(value);
	await expect(resolveConnectedClip("owner", "ClipA", true)).rejects.toMatchObject({ code: "RESOURCE_UNAVAILABLE" });
});
it("rejects arbitrary URL references without provider work", async () => {
	await expect(resolveConnectedClip("owner", "https://attacker.example/ClipA")).rejects.toMatchObject({ code: "INVALID_INPUT" });
	expect(clips).not.toHaveBeenCalled();
});
