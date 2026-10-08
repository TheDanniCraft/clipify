import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let mode: string;
let result: ReturnType<typeof runMcpProbe>;
Given("MCP activity includes expired and current entries with {string} retention cleanup", async ({}, value: string) => {
	mode = value;
});
When("the bounded MCP activity cleanup runs", async () => {
	result = runMcpProbe("activity-retention-probe", [mode]);
});
Then("only the permitted batch of expired MCP activity is removed and unrelated audits remain", async () => {
	expect(result.available).toBe(true);
	expect(result.error).toBeNull();
	expect(result.remaining).toEqual(mode === "bounded" ? ["retention-2", "retention-3", "retention-4", "retention-5", "retention-6"] : ["retention-3", "retention-4", "retention-5", "retention-6"]);
	expect(result.result).toEqual(mode === "concurrent" ? [1, 1] : mode === "bounded" ? 1 : 2);
});
