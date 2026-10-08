/** @jest-environment node */
import { registerMcpPrompts, MCP_INSTRUCTIONS, MCP_EXAMPLE_PROMPTS } from "@/server/mcp/prompts";
test("discoverable prompts describe focused workflows without performing operations", () => {
	const prompts = new Map<string, { config: any; callback: any }>();
	registerMcpPrompts({ registerPrompt: (name: string, config: any, callback: any) => prompts.set(name, { config, callback }) } as any);
	expect(prompts.size).toBe(6);
	expect(MCP_EXAMPLE_PROMPTS).toHaveLength(6);
	for (const { config, callback } of prompts.values()) {
		expect(config.description.length).toBeGreaterThan(30);
		const messages = callback().messages;
		expect(messages[0]).toMatchObject({ role: "user", content: { type: "text" } });
		expect(messages[0].content.text).toMatch(/list_creators/);
		expect(messages[0].content.text).toMatch(/get_capabilities/);
	}
	expect(MCP_INSTRUCTIONS).toContain("expectedRevision");
	expect(MCP_INSTRUCTIONS).toContain("get_overlay_link");
	expect(prompts.get("filter-overlay")!.callback().messages[0].content.text).toContain("category IDs");
	expect(prompts.get("style-overlay")!.callback().messages[0].content.text).toContain("update_overlay_theme");
	expect(prompts.get("import-clips")!.callback().messages[0].content.text).toContain("commit_playlist_import");
	expect(prompts.get("streaming-link")!.callback().messages[0].content.text).toMatch(/private|credential/);
});
