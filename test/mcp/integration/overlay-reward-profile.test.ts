/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-OVERLAY-EFFECT-010 provider configuration and response boundaries", () => {
	test("preview preserves its own callback destination", () => {
		const result = runMcpProbe("overlay-reward-http-probe", ["preview"], 45000);
		expect(result.success).toBe(true);
		expect(result.calls).toEqual([
			{ path: "token", valid: true },
			{ path: "subscription", valid: true },
		]);
	});
	test.each(["missing-client", "missing-secret", "missing-webhook", "missing-callback", "bad-callback", "bad-webhook"])("invalid %s sends no credentials or subscription request", (mode) => {
		const result = runMcpProbe("overlay-reward-http-probe", [mode], 45000);
		expect(result.success).toBe(false);
		expect(result.error).toBe("provider_unavailable");
		expect(result.calls).toEqual([]);
	});
	test.each(["token-array", "oversized-token", "bad-token", "bad-token-type", "bad-expiry"])("invalid %s never reaches subscription", (mode) => {
		const result = runMcpProbe("overlay-reward-http-probe", [mode], 45000);
		expect(result.success).toBe(false);
		expect(result.error).toBe("provider_unavailable");
		expect(result.calls).toEqual([{ path: "token", valid: true }]);
	});
});
