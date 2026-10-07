import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let mode: string;
let result: ReturnType<typeof runMcpProbe>;
Given("an anonymous OAuth client sends {string} registration input", async ({}, value: string) => {
	mode = value;
});
When("the real authentication provider processes that registration", async () => {
	result = runMcpProbe("registration-body-probe", [mode], 25000);
});
Then("bounded registration input preserves storage and finishes safely", async () => {
	expect(result.elapsed).toBeLessThan(mode === "deadline" ? 11000 : 1500);
	if (mode === "valid") {
		expect(result.status).toBeGreaterThanOrEqual(200);
		expect(result.status).toBeLessThan(300);
		expect(result.clients).toBe(1);
	} else {
		expect(result.status).toBe(400);
		expect(result.body).toEqual({ error: "invalid_client_metadata" });
		expect(result.clients).toBe(0);
	}
});
