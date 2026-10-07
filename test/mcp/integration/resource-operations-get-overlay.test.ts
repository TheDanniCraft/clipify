/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
const resourceId = "79e6c5a3-5368-4813-9780-49d22d99175f";

describe("TDD-US2-004 get_overlay through authenticated MCP", () => {
	test("returns owned overlay configuration and revision without private fields", () => {
		const result = flowProbe("resources:overlay-get");
		expect(result.protocolStatus).toBe(200);
		expect(result.resourceResult?.overlay).toMatchObject({ id: resourceId, creatorId: "fixture-creator", name: "Existing overlay", configurationRevision: 1 });
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-|secret|rewardId|token/);
	});
	test.each(["foreign", "missing"])("%s resource has the same safe unavailable outcome", (mode) => {
		const result = flowProbe(`resources:overlay-get:${mode}`);
		expect(result.resourceResult?.error?.code).toBe("RESOURCE_UNAVAILABLE");
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/Private overlay|foreign-owner|private-foreign/);
	});
	test("revoked current membership overrides previously approved read consent", () => {
		const result = flowProbe("resources:overlay-get:denied");
		expect(result.resourceResult?.error?.code).toBe("ACCESS_DENIED");
	});
});
