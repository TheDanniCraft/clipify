import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let selected: { name: string; phase: string; catalogue: string };
const results: Record<string, any> = {};
Given("the native authority boundary is {string} for {string} in {string}", async ({}, phase: string, name: string, catalogue: string) => {
	selected = { name, phase, catalogue };
});
When("the authenticated client reaches the public operation boundary", async () => {
	results[selected.catalogue] ??= flowProbe(`catalogue:${selected.catalogue}-authority`);
});
Then("current backend access is denied without private data or state changes", async () => {
	const row = results[selected.catalogue].outcomes.find((item: any) => item.name === selected.name && item.phase === selected.phase);
	expect(row).toEqual({ name: selected.name, phase: selected.phase, status: 200, code: "ACCESS_DENIED", changed: false, leakedData: false, ...(selected.catalogue === "read" ? { filtered: false } : { success: false }) });
});
