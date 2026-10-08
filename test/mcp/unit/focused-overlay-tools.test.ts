/** @jest-environment node */
import { toolInputSchemas } from "@/server/mcp/schemas";
import { toolPermissions } from "@/server/mcp/permissions";
const target = { creatorId: "creator", overlayId: "11111111-1111-4111-8111-111111111111" };
const groups = [
	["settings", { name: "Renamed" }, "themeTextColor"],
	["source", { type: "featured" }, "name"],
	["filters", { minClipViews: 20 }, "name"],
	["playback", { playerVolume: 40 }, "name"],
	["theme", { themeTextColor: "#ffffff" }, "playerVolume"],
] as const;
test.each(groups)("%s updates accept only their own fields and require a revision", (group, patch, foreignField) => {
	const schema = (toolInputSchemas as Record<string, any>)[`update_overlay_${group}`];
	expect(schema).toBeDefined();
	// Source enum values are checked separately by the existing shared schema.
	const validPatch = group === "source" ? { playlistId: null } : patch;
	expect(schema.safeParse({ ...target, expectedRevision: 1, patch: validPatch }).success).toBe(true);
	expect(schema.safeParse({ ...target, expectedRevision: 1, patch: { ...validPatch, [foreignField]: "oops" } }).success).toBe(false);
	expect(schema.safeParse({ ...target, patch: validPatch }).success).toBe(false);
	expect(schema.safeParse({ ...target, expectedRevision: 1, patch: {} }).success).toBe(false);
	expect((toolPermissions as Record<string, string>)[`update_overlay_${group}`]).toBe("overlay:update");
});
test.each(["source", "filters", "playback", "theme"])("%s reads are owner-bound and read-scoped", (group) => {
	const name = `get_overlay_${group}`;
	const schema = (toolInputSchemas as Record<string, any>)[name];
	expect(schema).toBeDefined();
	expect(schema.safeParse(target).success).toBe(true);
	expect(schema.safeParse({ overlayId: target.overlayId }).success).toBe(false);
	expect(schema.safeParse({ ...target, secret: "x" }).success).toBe(false);
	expect((toolPermissions as Record<string, string>)[name]).toBe("overlay:read");
});
