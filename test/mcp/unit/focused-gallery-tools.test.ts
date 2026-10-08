/** @jest-environment node */
import { toolInputSchemas } from "@/server/mcp/schemas";
import { toolPermissions } from "@/server/mcp/permissions";
const target = { creatorId: "creator", galleryId: "11111111-1111-4111-8111-111111111111" };
test.each([
	["settings", { name: "Renamed" }, "accentColor"],
	["source", { playlistId: null }, "name"],
	["filters", { minimumViews: 10 }, "layout"],
	["layout", { layout: "carousel" }, "theme"],
	["theme", { accentColor: "#abcdef" }, "source"],
])("%s only accepts its own nonempty revision-aware patch", (group, patch, foreignField) => {
	const schema = (toolInputSchemas as Record<string, any>)[`update_gallery_${group}`];
	expect(schema).toBeDefined();
	expect(schema.safeParse({ ...target, expectedRevision: 1, patch }).success).toBe(true);
	expect(schema.safeParse({ ...target, expectedRevision: 1, patch: { ...patch, [foreignField as string]: "x" } }).success).toBe(false);
	expect(schema.safeParse({ ...target, expectedRevision: 1, patch: {} }).success).toBe(false);
	expect(schema.safeParse({ ...target, patch }).success).toBe(false);
	expect((toolPermissions as Record<string, string>)[`update_gallery_${group}`]).toBe("gallery:update");
});
test.each(["source", "filters", "layout", "theme"])("%s reads require creator ownership", (group) => {
	const name = `get_gallery_${group}`;
	const schema = (toolInputSchemas as Record<string, any>)[name];
	expect(schema).toBeDefined();
	expect(schema.safeParse(target).success).toBe(true);
	expect(schema.safeParse({ galleryId: target.galleryId }).success).toBe(false);
	expect((toolPermissions as Record<string, string>)[name]).toBe("gallery:read");
});
