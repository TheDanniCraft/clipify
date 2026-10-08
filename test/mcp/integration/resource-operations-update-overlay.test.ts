/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US2-006 update_overlay through authenticated MCP", () => {
	test("commits allowed configuration and increments the revision", () => {
		const result = flowProbe("resources:overlay-update");
		expect(result.resourceResult?.overlay).toMatchObject({ playerVolume: 70, configurationRevision: 2 });
		expect(result.persistedOverlay).toMatchObject({ name: "Existing overlay", player_volume: 70, configuration_revision: 2 });
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/secret|rewardId|token/);
	});
	test.each([
		["stale", "CONFLICT"],
		["missing", "RESOURCE_UNAVAILABLE"],
		["denied", "ACCESS_DENIED"],
	])("%s update fails without changing configuration", (mode, code) => {
		const result = flowProbe(`resources:overlay-update:${mode}`);
		expect(result.resourceResult?.error?.code).toBe(code);
		expect(result.persistedOverlay).toMatchObject({ name: "Existing overlay", player_volume: 50, configuration_revision: 1 });
	});
});
