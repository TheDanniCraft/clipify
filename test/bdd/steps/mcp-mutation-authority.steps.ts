import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let phase: string;
let result: any;
Given("the mutation authority catalogue selects {string}", async ({}, value: string) => {
	phase = value;
});
When("every applicable mutation uses the actual public MCP route", async () => {
	result ??= flowProbe("catalogue:mutation-authority");
});
Then("each result and persisted state agree with that authority boundary", async () => {
	expect(result.outcomes).toHaveLength(83);
	expect(result.providerCalls).toBe(6);
	const rows = result.outcomes.filter((row: any) => row.phase === phase);
	expect(rows).toHaveLength(phase === "foreign-resource" ? 7 : phase === "paid-boundary" ? 4 : 9);
	for (const row of rows) {
		const positive = phase === "direct-pro" || phase === "owner-free" || phase.startsWith("agency-");
		const code = positive ? null : phase === "foreign-resource" ? "RESOURCE_UNAVAILABLE" : phase === "failed-audit" ? "SERVICE_UNAVAILABLE" : phase === "paid-boundary" ? (row.name === "update_overlay" ? "FEATURE_RESTRICTED" : "PLAN_LIMIT_REACHED") : "ACCESS_DENIED";
		expect(row).toEqual({ name: row.name, phase, status: 200, code, success: positive, changed: positive, leakedData: false });
	}
});
