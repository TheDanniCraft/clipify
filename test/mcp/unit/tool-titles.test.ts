/** @jest-environment node */
import { publicToolNames, toolInputSchemas, type ToolName } from "@/server/mcp/schemas";
import { toolTitle, toolTitles } from "@/server/mcp/titles";

describe("connector directory tool titles", () => {
	test("every tool schema has exactly one title", () => {
		expect(Object.keys(toolTitles).sort()).toEqual(Object.keys(toolInputSchemas).sort());
	});
	test.each(publicToolNames)("%s has a concise human-readable title", (name) => {
		const title = toolTitle(name);
		expect(title).toMatch(/^[A-Z][A-Za-z0-9 ,'-]{2,62}[A-Za-z0-9]$/);
		expect(title).not.toContain("_");
	});
	test("public titles are distinct", () => {
		const titles = publicToolNames.map(toolTitle);
		expect(new Set(titles).size).toBe(titles.length);
	});
	test("unknown names are rejected", () => {
		expect(() => toolTitle("rotate_overlay_secret" as ToolName)).toThrow("INVALID_INPUT");
	});
});
