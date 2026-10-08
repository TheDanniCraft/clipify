/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
test.each(["accepted", "exists", "rate", "denied", "app-auth", "invalid-json", "missing-token"])("TDD-OVERLAY-EFFECT-005 actual reward provider HTTP %s", (mode) => {
	const result = runMcpProbe("overlay-reward-http-probe", [mode], 45000);
	expect(result.available).toBe(true);
	expect(result.success).toBe(["accepted", "exists"].includes(mode));
	expect(result.calls.every((call: any) => call.valid)).toBe(true);
	expect(result.calls.map((call: any) => call.path)).toEqual(["app-auth", "invalid-json", "missing-token"].includes(mode) ? ["token"] : ["token", "subscription"]);
	if (!result.success) expect(result.error).toBe("provider_unavailable");
});
