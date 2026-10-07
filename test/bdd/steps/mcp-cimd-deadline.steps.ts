import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let mode: string;
let result: ReturnType<typeof runMcpProbe>;
Given("the isolated client metadata hostname has {string} DNS behavior", async ({}, value: string) => {
	mode = value;
});
When("the actual provider resolves client metadata for authorization", async () => {
	result = runMcpProbe("cimd-deadline-probe", [mode], 25000);
});
Then("metadata fails within the dependency budget without creating a client or contacting a forbidden host", async () => {
	expect(result.elapsed).toBeLessThan(11000);
	expect(result.error).toBe("invalid_client");
	expect(result.lookups).toBe(1);
	expect(result.clients).toBe(0);
	expect(result.transportAborted).toBe(true);
	if (mode === "private") expect(result.transportCalls).toBe(0);
});
