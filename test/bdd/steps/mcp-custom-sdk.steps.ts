import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { When, Then } = createBdd();
let result: any;
let mode: string;
When("the independent SDK uses {word} transport against the isolated HTTP service", async ({}, value: string) => {
	mode = value;
	result = runMcpProbe("sdk-client-probe", [mode], 60000);
});
Then("native discovery and OAuth lead to permitted reads and edits within Free limits", async () => {
	expect(result).toMatchObject({ metadataValid: true, registrationStatus: 201, issuerBound: true, audienceBound: true, toolCount: 50, readAllowed: true, createAllowed: true, editAllowed: true, count: 1, limitError: "PLAN_LIMIT_REACHED", stored: { name: "Edited by official SDK", configuration_revision: 2 }, secretFree: true });
	expect(result.protocols).toContain(mode === "auto" ? "2026-07-28" : "2025-11-25");
});
Then("denial adds no grant and revocation rejects old SDK and refresh access", async () => {
	expect(result).toMatchObject({ deniedConsent: true, revocationStatus: 200, revokedSdkDenied: true, oldBearerStatus: 401, oldBearerChallenge: true, refreshStatus: 400 });
});
