/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
import { CORE_TOOL_NAMES as names, PUBLIC_TOOL_NAMES } from "../../support/mcp/public-tool-expectations";

describe("TDD-US2-022 every public tool result excludes seeded credentials", () => {
	let result: any;
	beforeAll(() => {
		result = flowProbe("catalogue:tool-results");
	});
	test("actual discovery exposes exactly the 76 supported tool definitions without seeded credentials", () => {
		expect(result.discovery.status).toBe(200);
		expect(result.discovery.secretFree).toBe(true);

		expect([...result.discovery.names].sort()).toEqual([...PUBLIC_TOOL_NAMES].sort());
	});
	test.each(names)("%s exposes truthful risk hints on native discovery", (name) => {
		const read = name.startsWith("list_") || name.startsWith("get_");
		const destructive = ["update_overlay_settings", "delete_overlay", "update_playlist", "delete_playlist", "remove_playlist_items", "reorder_playlist_items"].includes(name);
		const tool = result.discovery.annotations.find((row: any) => row.name === name);
		expect(tool.title).toEqual(expect.stringMatching(/\S/));
		expect(tool.annotations).toEqual({ title: tool.title, readOnlyHint: read, destructiveHint: destructive, idempotentHint: true, openWorldHint: name === "add_playlist_items" });
	});
	test("every discovered tool has a distinct display title for connector directories", () => {
		const titles = result.discovery.annotations.map((row: any) => row.title);
		expect(titles).toHaveLength(PUBLIC_TOOL_NAMES.length);
		for (const row of result.discovery.annotations) {
			expect(row.title).toEqual(expect.stringMatching(/^\S.{0,62}\S$/));
			expect(row.annotations.title).toBe(row.title);
		}
		expect(new Set(titles).size).toBe(titles.length);
	});
	test.each(names)("%s succeeds without provider, OAuth, clip or overlay credentials", (name) => {
		expect(result.outcomes.find((row: any) => row.name === name)).toEqual({ name, status: 200, success: true, secretFree: true });
	});
	test.each(["rotate_overlay_secret", "get_runner_credentials", "create_api_token", "configure_twitch_reward"])("excluded %s is denied without credentials", (name) => {
		expect(result.excluded.find((row: any) => row.name === name)).toEqual({ name, denied: true, secretFree: true });
	});
	test("clip append uses the actual decrypted provider credential exactly once", () => {
		expect(result.providerCalls).toBe(1);
	});
});
