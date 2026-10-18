/** @jest-environment node */
import { discoveryFilters, creatorPageFields } from "@/server/mcp/workflows/schemas";
import { toolInputSchemas as schemas } from "@/server/mcp/schemas";
const creatorId = "creator";
const overlayId = "11111111-1111-4111-8111-111111111111";
const playlistId = overlayId;
const sessionId = overlayId;
test.each([0, 100])("remote volume accepts the endpoint %s", (volume) => {
	expect(schemas.control_overlay.safeParse({ creatorId, overlayId, command: "volume", volume }).success).toBe(true);
});
test.each([-1, 101, 0.5, undefined])("remote volume rejects invalid or missing value %s", (volume) => {
	expect(schemas.control_overlay.safeParse({ creatorId, overlayId, command: "volume", volume }).success).toBe(false);
});
test("volume cannot accompany a playback command", () => {
	expect(schemas.control_overlay.safeParse({ creatorId, overlayId, command: "pause", volume: 50 }).success).toBe(false);
});
test.each([{ startedAt: "2026-10-07T00:00:00Z", endedAt: "2026-10-06T00:00:00Z" }, { startedAt: "2026-10-06T00:00:00Z", endedAt: "2026-10-06T00:00:00Z" }, { timezone: "Not/A_Zone" }, { minDuration: 20, maxDuration: 10 }, { minViews: -1 }, { maxDuration: 601 }])("discovery rejects invalid filter interval or bound %#", (filters) => {
	expect(discoveryFilters.safeParse(filters).success).toBe(false);
});
test("discovery accepts an offset date interval and equal duration bounds", () => {
	expect(discoveryFilters.safeParse({ startedAt: "2026-10-06T00:00:00+02:00", endedAt: "2026-10-07T00:00:00+02:00", timezone: "Europe/Berlin", minDuration: 12, maxDuration: 12 }).success).toBe(true);
});
test.each([{}, { clips: ["Clip"], filters: {} }, { clips: [] }])("import preview requires exactly one nonempty selection method %#", (selection) => {
	expect(schemas.preview_playlist_import.safeParse({ creatorId, playlistId, expectedRevision: 1, ...selection }).success).toBe(false);
});
test.each([false, undefined, "true"])("import commit requires explicit boolean confirmation %s", (confirmed) => {
	expect(schemas.commit_playlist_import.safeParse({ creatorId, playlistId, previewToken: "preview", retryKey: "retry", confirmed }).success).toBe(false);
});
test.each(["windows", "linux", "linux-arm64", "macos", "macos-arm64"])("runner setup accepts supported platform %s", (platform) => {
	expect(schemas.get_runner_setup.safeParse({ creatorId, platform }).success).toBe(true);
});
test("stream creation requires a retry key and existing configuration requires a revision", () => {
	const input = { creatorId, runnerId: overlayId, overlayId, mode: "failsafe" };
	expect(schemas.configure_stream_session.safeParse(input).success).toBe(false);
	expect(schemas.configure_stream_session.safeParse({ ...input, retryKey: "new" }).success).toBe(true);
	expect(schemas.configure_stream_session.safeParse({ ...input, sessionId, retryKey: "new" }).success).toBe(false);
	expect(schemas.configure_stream_session.safeParse({ ...input, sessionId, expectedRevision: 1 }).success).toBe(true);
});
test.each(["update_gallery_settings", "update_creator_page"] as const)("%s rejects empty edits", (tool) => {
	expect(schemas[tool].safeParse({ creatorId, ...(tool === "update_gallery_settings" ? { galleryId: overlayId } : {}), expectedRevision: 1, patch: {} }).success).toBe(false);
});

test("clip search without explicit filters keeps its bounded UTC defaults", () => {
	expect(schemas.search_clips.parse({ creatorId })).toMatchObject({ creatorId, limit: 25, filters: { timezone: "UTC", sort: "newest" } });
});

test("Creator Page social preview fields retain explicit title and visibility bounds", () => {
	expect(creatorPageFields.creatorPageSocialTitle.safeParse("x".repeat(120)).success).toBe(true);
	expect(creatorPageFields.creatorPageSocialTitle.safeParse("x".repeat(121)).success).toBe(false);
	expect(creatorPageFields.creatorPageVisibility.safeParse("unlisted").success).toBe(true);
	expect(creatorPageFields.creatorPageVisibility.safeParse("public").success).toBe(false);
});

test("TDD-US2-FR006: saved destination IDs and a legacy preset cannot ambiguously select a broadcast target", () => {
	const input = { creatorId, runnerId: overlayId, overlayId, mode: "24/7", retryKey: "selection" };
	expect(schemas.configure_stream_session.safeParse({ ...input, destinationIds: [overlayId] }).success).toBe(true);
	expect(schemas.configure_stream_session.safeParse({ ...input, destination: "twitch" }).success).toBe(true);
	expect(schemas.configure_stream_session.safeParse({ ...input, destination: "twitch", destinationIds: [overlayId] }).success).toBe(false);
});
