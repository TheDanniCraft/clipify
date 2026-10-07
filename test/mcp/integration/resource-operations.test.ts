/** @jest-environment node */
export {};
let schemas: any;
try {
	schemas = require("@/server/mcp/schemas");
} catch {}
const creatorId = "creator-1",
	resourceId = "79e6c5a3-5368-4813-9780-49d22d99175f";
const cases: Record<string, object> = {
	list_creators: {},
	get_capabilities: { creatorId },
	list_overlays: { creatorId },
	get_overlay: { creatorId, overlayId: resourceId },
	create_overlay: { creatorId, retryKey: "request-1" },
	update_overlay: { creatorId, overlayId: resourceId, expectedRevision: 1, patch: { name: "Edited" } },
	delete_overlay: { creatorId, overlayId: resourceId, expectedRevision: 1 },
	list_playlists: { creatorId },
	get_playlist: { creatorId, playlistId: resourceId },
	create_playlist: { creatorId, retryKey: "request-1", name: "Playlist" },
	update_playlist: { creatorId, playlistId: resourceId, expectedRevision: 1, name: "Edited" },
	delete_playlist: { creatorId, playlistId: resourceId, expectedRevision: 1 },
	add_playlist_items: { creatorId, playlistId: resourceId, expectedRevision: 1, clipIds: ["Clip_123"] },
	remove_playlist_items: { creatorId, playlistId: resourceId, expectedRevision: 1, itemIds: ["Clip_123"] },
	reorder_playlist_items: { creatorId, playlistId: resourceId, expectedRevision: 1, itemIds: ["Clip_123"] },
};
describe("TDD-US2-016–022 inner strict resource contracts", () => {
	test.each(Object.entries(cases))("%s accepts its declared input and rejects caller authority/unknown fields", (name, input) => {
		expect(schemas?.toolInputSchemas?.[name]).toBeDefined();
		const schema = schemas.toolInputSchemas[name];
		expect(schema.safeParse(input).success).toBe(true);
		for (const unknown of ["secret", "ownerId", "grantId", "scopes", "confirmed", "unexpected"]) expect(schema.safeParse({ ...input, [unknown]: "untrusted" }).success).toBe(false);
	});
	test.each(["", " ", "x".repeat(121)])("creation rejects invalid name %j", (name) => {
		expect(schemas?.toolInputSchemas).toBeDefined();
		expect(schemas.toolInputSchemas.create_playlist.safeParse({ ...cases.create_playlist, name }).success).toBe(false);
	});
	test.each(["", "x".repeat(129), 1, null])("create retry key rejects invalid boundary %j", (retryKey) => {
		expect(schemas?.toolInputSchemas).toBeDefined();
		expect(schemas.toolInputSchemas.create_overlay.safeParse({ ...cases.create_overlay, retryKey }).success).toBe(false);
	});
	test.each([0, -1, 1.1, "1", null, undefined])("edit requires a positive integer revision %j", (expectedRevision) => {
		expect(schemas?.toolInputSchemas).toBeDefined();
		expect(schemas.toolInputSchemas.update_overlay.safeParse({ ...cases.update_overlay, expectedRevision }).success).toBe(false);
	});
	test("identifiers, types, pagination and config ranges are strict", () => {
		expect(schemas?.toolInputSchemas).toBeDefined();
		const s = schemas.toolInputSchemas;
		expect(s.get_overlay.safeParse({ creatorId, overlayId: "invalid" }).success).toBe(false);
		expect(s.get_overlay.safeParse({ creatorId: "../owner", overlayId: resourceId }).success).toBe(false);
		for (const limit of [0, 101, 1.5, "25"]) expect(s.list_overlays.safeParse({ creatorId, limit }).success).toBe(false);
		for (const patch of [{ playerVolume: 101 }, { playerVolume: "50" }, { clipPackSize: 501 }, { name: " " }, { secret: "x" }, {}]) expect(s.update_overlay.safeParse({ ...cases.update_overlay, patch }).success).toBe(false);
	});
	test("item batches reject malformed references, duplicates and oversized arrays", () => {
		expect(schemas?.toolInputSchemas).toBeDefined();
		const schema = schemas.toolInputSchemas.add_playlist_items;
		for (const clipIds of [[], ["../clip"], ["duplicate", "duplicate"], Array.from({ length: 501 }, (_, i) => `clip_${i}`)]) expect(schema.safeParse({ ...cases.add_playlist_items, clipIds }).success).toBe(false);
	});
	test("safe overlay DTO contains configuration and revision but no private credentials", () => {
		expect(schemas?.overlayDto).toEqual(expect.any(Function));
		const dto = schemas.overlayDto({ id: resourceId, ownerId: creatorId, name: "Overlay", status: "active", type: "Featured", playlistId: null, configurationRevision: 1, secret: "private-secret", token: "private-token", runnerKey: "private-runner" });
		expect(dto).toMatchObject({ id: resourceId, creatorId, name: "Overlay", configurationRevision: 1 });
		expect(JSON.stringify(dto)).not.toMatch(/private-|secret|token|runnerKey/);
	});
});
