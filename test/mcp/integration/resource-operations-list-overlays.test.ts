/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US2-003 list overlays through authenticated MCP", () => {
	test("returns creator configuration and revisions without credentials", () => {
		const result = flowProbe("resources:overlays");
		expect(result.protocolStatus).toBe(200);
		expect(result.resourceResult.items).toHaveLength(1);
		expect(result.resourceResult.items[0]).toMatchObject({ creatorId: "fixture-creator", name: "Existing overlay", configurationRevision: 1 });
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-overlay-secret|secret|token|rewardId/);
		expect(result.resourceResult.nextCursor).toBeNull();
	});
});

describe("strict list_overlays public validation", () => {
	test.each(["unknown", "bad-limit", "bad-id"])("%s returns a stable safe error without changing resources", (mode) => {
		const result = flowProbe(`resources:overlays:${mode}`);
		expect(result.protocolStatus).toBe(200);
		expect(result.resourceResult?.error?.code).toBe("INVALID_INPUT");
		expect(result.resourceCount).toBe(1);
		expect(JSON.stringify(result.resourceResult)).not.toContain("private-input-value");
	});
});
