/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
import { CORE_TOOL_NAMES as names, PUBLIC_TOOL_NAMES } from "../../support/mcp/public-tool-expectations";

describe("TDD-US2-022 every public tool result excludes seeded credentials", () => {
	let result: any;
	beforeAll(() => {
		result = flowProbe("catalogue:tool-results");
	});
	test("every public tool advertises a readable English title on native discovery", () => {
		for (const tool of result.discovery.annotations) {
			expect(tool.title).toEqual(expect.any(String));
			expect(tool.title).toMatch(/^[A-Z]/);
			expect(tool.title).not.toContain("_");
			expect(tool.name.length).toBeLessThanOrEqual(64);
		}
	});
	test("actual discovery exposes exactly the 66 supported tool definitions without seeded credentials", () => {
		expect(result.discovery.status).toBe(200);
		expect(result.discovery.secretFree).toBe(true);

		expect([...result.discovery.names].sort()).toEqual([...PUBLIC_TOOL_NAMES].sort());
	});
	test.each(names)("%s exposes truthful risk hints on native discovery", (name) => {
		const read = name.startsWith("list_") || name.startsWith("get_");
		const destructive = !read;
		expect(result.discovery.annotations.find((row: any) => row.name === name).annotations).toEqual({ readOnlyHint: read, destructiveHint: destructive, idempotentHint: true, openWorldHint: name === "add_playlist_items" });
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
