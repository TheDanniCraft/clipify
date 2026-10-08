/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
test.each(["token-headers", "token-body", "subscription-headers"])("TDD-OVERLAY-EFFECT-006 stalled %s fails within the full provider deadline", (mode) => {
	const result = runMcpProbe("overlay-reward-http-probe", [mode], 45000);
	expect(result.available).toBe(true);
	expect(result.success).toBe(false);
	expect(result.error).toBe("provider_unavailable");
	expect(result.elapsedMs).toBeGreaterThanOrEqual(9000);
	expect(result.elapsedMs).toBeLessThan(13000);
	expect(result.calls.every((call: any) => call.valid)).toBe(true);
	expect(result.calls.map((call: any) => call.path)).toEqual(mode === "subscription-headers" ? ["token", "subscription"] : ["token"]);
});

test.each(["headers", "body", "credentials"])("TDD-OVERLAY-REWARD-OWNERSHIP-002 stalled reward %s cannot commit beyond its deadline", (mode) => {
	const result = runMcpProbe("overlay-reward-ownership-probe", [mode], 30000);
	expect(result).toMatchObject({ saved: false, rewardId: null, revision: 1, jobs: 0, audits: 0 });
	expect(result.elapsedMs).toBeGreaterThanOrEqual(4500);
	expect(result.elapsedMs).toBeLessThan(7500);
	if (mode !== "credentials") expect(result).toMatchObject({ calls: 1, requestValid: true, lockFree: true });
});
