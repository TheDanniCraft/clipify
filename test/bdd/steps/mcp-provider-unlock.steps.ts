import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let mode: string;
let result: ReturnType<typeof runMcpProbe>;
Given("provider lock cleanup has {string} behavior", async ({}, behavior: string) => {
	mode = behavior;
});
When("the completed credential operation releases its database lease", async () => {
	result = runMcpProbe("provider-unlock-probe", [mode]);
});
Then("an independent database connection can coordinate that provider account and the pool stays healthy", async () => {
	expect(result.completed).toBe(true);
	expect(result.injected).toBe(mode === "failure");
	expect(result.lockReleased).toBe(true);
	expect(result.healthy).toBe(true);
});
