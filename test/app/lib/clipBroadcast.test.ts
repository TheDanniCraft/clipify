/** @jest-environment node */
import { rememberClipBroadcast, withClipBroadcast } from "@lib/clipBroadcast";
const clip = { id: "ClipA", broadcaster_id: "owner", video_id: "123", vod_offset: 42 };
it("keeps the known stream and offset when Twitch removes VOD fields", () => {
	const previous = { clip, broadcast: { id: "123", offset: 42 } };
	const fresh = { ...clip, video_id: "", vod_offset: null };
	expect(rememberClipBroadcast(fresh, previous)).toEqual({ id: "123", offset: 42 });
	expect(withClipBroadcast(fresh, previous)).toMatchObject({ video_id: "123", vod_offset: 42 });
	expect(fresh.video_id).toBe("");
});
it("preserves legacy associations without borrowing another clip or creator reference", () => {
	const fresh = { ...clip, video_id: "", vod_offset: null };
	expect(rememberClipBroadcast(fresh, { clip })).toEqual({ id: "123", offset: 42 });
	expect(rememberClipBroadcast(fresh, { clip: { ...clip, id: "Other" } })).toBeUndefined();
	expect(rememberClipBroadcast(fresh, { clip: { ...clip, broadcaster_id: "foreign" } })).toBeUndefined();
	expect(rememberClipBroadcast(fresh, { clip: fresh, broadcast: { id: 42 } })).toBeUndefined();
});
it("prefers current validated VOD fields and never reuses an offset from another stream", () => {
	expect(rememberClipBroadcast({ ...clip, video_id: "456", vod_offset: null }, { clip, broadcast: { id: "123", offset: 42 } })).toEqual({ id: "456", offset: null });
	expect(withClipBroadcast({ ...clip, video_id: "", vod_offset: null }, null)).toMatchObject({ video_id: "", vod_offset: null });
});
it("rejects malformed newly supplied history fields at the provider boundary", () => {
	expect(rememberClipBroadcast({ ...clip, video_id: "x".repeat(201) })).toBeUndefined();
	expect(rememberClipBroadcast({ ...clip, vod_offset: Infinity })).toBeUndefined();
});
