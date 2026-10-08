/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US2-005 create_overlay through authenticated MCP", () => {
	test("creates one safe resource and replays the same result for a repeated retry key", () => {
		const result = flowProbe("resources:overlay-create");
		expect(result.protocolStatus).toBe(200);
		expect(result.resourceResult?.created).toMatchObject({ creatorId: "fixture-creator", name: "Agent overlay", configurationRevision: 1 });
		expect(result.resourceResult?.replayed).toEqual(result.resourceResult?.created);
		expect(result.resourceCount).toBe(1);
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/secret|rewardId|token/);
	});
});

describe("TDD-US3-018 Free overlay quota at the actual public MCP boundary", () => {
	test("reports usage and limit and leaves the existing private overlay unchanged", () => {
		const result = flowProbe("resources:overlay-create:limit-one");
		expect(result.protocolStatus).toBe(200);
		expect(result.resourceResult.created.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 });
		expect(result.resourceResult.replayed.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 });
		expect(result.resourceCount).toBe(1);
		expect(result.quotaStateChanged).toBe(false);
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-overlay-secret|private-input-value|secret|token|rewardId/);
	});
});
