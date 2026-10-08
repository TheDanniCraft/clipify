/** @jest-environment node */
jest.mock("server-only", () => ({}));
import { buildOverlayUpdatePayload, normalizeCreatorFilters, browserOverlayPatchSchema } from "@/server/resources/overlay-configuration";
import { OverlayType, PlaybackMode, StatusOptions, type Overlay } from "@types";
const overlay = { name: "Overlay", status: StatusOptions.Active, type: OverlayType.All, playbackMode: PlaybackMode.Random } as Overlay;
test("Free update payload excludes saved paid settings", () => {
	const result = buildOverlayUpdatePayload({ ...overlay, playerVolume: 83, themeTextColor: "#123456", effectCrt: true }, false);
	expect(result).toEqual({ name: "Overlay", status: StatusOptions.Active, type: OverlayType.All, playlistId: null, updatedAt: expect.any(Date) });
});
test("legacy absent settings normalize to usable Pro defaults", () => {
	expect(buildOverlayUpdatePayload(overlay, true)).toMatchObject({ rewardId: null, categoriesOnly: [], categoriesBlocked: [], clipCreatorsOnly: [], clipCreatorsBlocked: [], clipPackSize: 100, playerVolume: 50, overlayInfoFadeOutSeconds: 6, themeFontFamily: "inherit", themeTextColor: "#FFFFFF", themeAccentColor: "#7C3AED", themeBackgroundColor: "rgba(10,10,10,0.65)", borderSize: 0, borderRadius: 10, channelInfoX: 0, clipInfoX: 100, timerY: 0, channelScale: 100 });
});
test.each([null, "", " ", "x".repeat(201), "bad<script>", "Inter||url||", "Inter||url||not-a-url", "Inter||url||http://fonts.googleapis.com/css2?family=Inter", "Inter||url||https://other.example/font.css"])("unsafe or absent font %p never becomes remote CSS", (font) => {
	const result = buildOverlayUpdatePayload({ ...overlay, themeFontFamily: font } as Overlay, true);
	expect(result).toMatchObject({ themeFontFamily: font?.startsWith("Inter||url||") ? "Inter" : "inherit" });
});
test("allowlisted HTTPS font URL and clean family are preserved", () => {
	expect(buildOverlayUpdatePayload({ ...overlay, themeFontFamily: "Inter||url||https://fonts.googleapis.com/css2?family=Inter" }, true)).toMatchObject({ themeFontFamily: "Inter||url||https://fonts.googleapis.com/css2?family=Inter" });
});
test.each(["transparent", "#abc", "#11223344", "rgb(1, 2, 3)", "rgba(1, 2, 3, 0.5)", "hsl(120, 50%, 50%)"])("supported color %s is preserved", (color) => {
	expect(buildOverlayUpdatePayload({ ...overlay, themeTextColor: color }, true)).toMatchObject({ themeTextColor: color });
});
test("invalid CSS color cannot become stored display styling", () => {
	expect(buildOverlayUpdatePayload({ ...overlay, themeTextColor: "url(https://private.example)" }, true)).toMatchObject({ themeTextColor: "#FFFFFF" });
});
test("non-playlist ordered playback is normalized while playlist ordering is retained", () => {
	expect(buildOverlayUpdatePayload({ ...overlay, playbackMode: PlaybackMode.Order }, true)).toMatchObject({ playbackMode: PlaybackMode.Random });
	expect(buildOverlayUpdatePayload({ ...overlay, type: OverlayType.Playlist, playlistId: "playlist", playbackMode: PlaybackMode.Order }, true)).toMatchObject({ playlistId: "playlist", playbackMode: PlaybackMode.Order });
	expect(buildOverlayUpdatePayload({ ...overlay, type: OverlayType.Playlist }, true).playlistId).toBeNull();
});
test("display sizes, positions and audio stay bounded", () => {
	expect(buildOverlayUpdatePayload({ ...overlay, clipPackSize: 999, playerVolume: -1, overlayInfoFadeOutSeconds: 99, borderSize: 99, borderRadius: -1, channelInfoX: 101, timerY: -10, channelScale: 1, clipScale: 999 }, true)).toMatchObject({ clipPackSize: 500, playerVolume: 0, overlayInfoFadeOutSeconds: 30, borderSize: 32, borderRadius: 0, channelInfoX: 100, timerY: 0, channelScale: 50, clipScale: 250 });
});
test("creator filters normalize and deduplicate without empty names", () => {
	expect(normalizeCreatorFilters([" User ", "user", "", "Other"])).toEqual(["user", "other"]);
	expect(normalizeCreatorFilters(null)).toEqual([]);
});
test("browser patch permits its reward field but rejects empty and foreign fields", () => {
	expect(browserOverlayPatchSchema.safeParse({ rewardId: null }).success).toBe(true);
	expect(browserOverlayPatchSchema.safeParse({}).success).toBe(false);
	expect(browserOverlayPatchSchema.safeParse({ secret: "forged" }).success).toBe(false);
});
