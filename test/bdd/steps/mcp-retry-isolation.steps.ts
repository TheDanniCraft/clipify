import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { When, Then } = createBdd();
let catalogue: any;
let context: string;
When("independently authorized MCP create retries differ by {word}", async ({}, value: string) => {
	context = value;
	catalogue ??= flowProbe("catalogue:retry-isolation");
});
Then("each context gets its own resource and replays only its own result", async () => {
	expect(catalogue).toMatchObject({ records: 8, resources: 8, clients: 2, actors: 2, creators: 2 });
	const rows = catalogue.outcomes.filter((row: any) => row.context === context);
	expect(rows).toHaveLength(2);
	for (const row of rows) {
		for (const result of [row.baseline, row.created, row.replay]) expect(result).toMatchObject({ status: 200, error: null, safe: true });
		expect(row.created.id).toEqual(expect.any(String));
		expect(row.created.id).not.toBe(row.baseline.id);
		expect(row.replay.id).toBe(row.created.id);
		expect(row.created.creatorId).toBe(context === "creator" ? "retry-second-creator" : "fixture-creator");
	}
});
