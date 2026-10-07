import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let mode: string;
let result: ReturnType<typeof flowProbe>;
Given("the consented refresh request has {string} behavior", async ({}, value: string) => {
	mode = value;
});
When("the actual provider handles that refresh boundary", async () => {
	result = flowProbe(`refresh:${mode}`);
});
Then("refresh cannot widen or transfer authority and consumed refresh credentials cannot be reused", async () => {
	const allowed = ["valid", "narrow", "reuse", "concurrent"].includes(mode);
	expect(result.creatorSetPreserved).toBe(true);
	if (allowed) {
		expect(result.refreshStatus).toBe(200);
		expect(result.sameRefreshGrant).toBe(true);
		expect(result.refreshScopes).toBe(mode === "narrow" ? "creator:read" : "creator:read overlay:read playlist:read offline_access");
	} else {
		expect(result.refreshStatus).toBeGreaterThanOrEqual(400);
		expect(result.sameRefreshGrant).toBe(false);
	}
	if (mode === "revoked-grant" || mode === "expired-grant") {
		expect(result.refreshStatus).toBe(400);
		expect(result.refreshError).toBe("invalid_grant");
	}
	if (mode === "reuse" || mode === "concurrent") expect(result.refreshReplayStatus).toBe(400);
	if (mode === "concurrent") {
		expect(result.refreshWaiters).toBe(2);
		expect(result.refreshRaceStatuses.sort()).toEqual([200, 400]);
	}
});
