import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { When, Then } = createBdd();
let result: any;
When("reward provider HTTP returns {word}", async ({}, response: string) => {
	result = runMcpProbe("overlay-reward-http-probe", [response], 45000);
});
Then("the subscription adapter succeeds only for accepted or existing subscriptions", async () => {
	expect(result.available).toBe(true);
	expect(result.success).toBe(["accepted", "exists"].includes(result.mode));
	expect(result.calls.every((call: any) => call.valid)).toBe(true);
	expect(result.calls.map((call: any) => call.path)).toEqual(["app-auth", "invalid-json", "missing-token"].includes(result.mode) ? ["token"] : ["token", "subscription"]);
	if (!result.success) expect(result.error).toBe("provider_unavailable");
});

When("reward provider HTTP stalls at {word}", async ({}, stage: string) => {
	result = runMcpProbe("overlay-reward-http-probe", [stage], 45000);
});
Then("the stalled reward request fails within ten seconds without subscription success", async () => {
	expect(result.available).toBe(true);
	expect(result.success).toBe(false);
	expect(result.error).toBe("provider_unavailable");
	expect(result.elapsedMs).toBeGreaterThanOrEqual(9000);
	expect(result.elapsedMs).toBeLessThan(13000);
	expect(result.calls.every((call: any) => call.valid)).toBe(true);
	expect(result.calls.map((call: any) => call.path)).toEqual(result.mode === "subscription-headers" ? ["token", "subscription"] : ["token"]);
});

Then("reward configuration and token validation preserve the expected request boundary", async () => {
	if (result.mode === "preview") {
		expect(result.success).toBe(true);
		expect(result.calls).toEqual([
			{ path: "token", valid: true },
			{ path: "subscription", valid: true },
		]);
	} else {
		expect(result.success).toBe(false);
		expect(result.error).toBe("provider_unavailable");
		expect(result.calls).toEqual(["token-array", "oversized-token", "bad-token", "bad-token-type", "bad-expiry"].includes(result.mode) ? [{ path: "token", valid: true }] : []);
	}
});
