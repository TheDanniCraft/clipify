import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let selected: { phase: string; name: string };
let catalogue: any;
Given("the current read access case is {string} for {string}", async ({}, phase: string, name: string) => {
	selected = { phase, name };
});
When("the validly authenticated client attempts that read through the MCP route", async () => {
	catalogue ??= flowProbe("catalogue:read-authority");
});
Then("the read reports {string} with creator filtering {string} and no secrets or resource changes", async ({}, code: string, filtered: string) => {
	expect(catalogue.outcomes).toHaveLength(110);
	expect(catalogue.outcomes.find((row: any) => row.name === selected.name && row.phase === selected.phase)).toEqual({ ...selected, status: 200, code: code === "NONE" ? null : code, filtered: filtered === "true", changed: false, leakedData: false });
});
