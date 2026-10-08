import { createBdd, DataTable } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let result: ReturnType<typeof runMcpProbe>;
Given("a real provider issued a consented creator access token", async () => {});
When("every explicit malformed header and signed claim case reaches the public MCP route", async () => {
	result = runMcpProbe("flow-probe", ["protocol:token-catalogue"], 30000);
});
Then("all listed invalid credentials receive an OAuth challenge and both supported bearer controls can read", async ({}, table: DataTable) => {
	expect(result.clockChecks).toEqual({ before: true, at: false, after: false });
	const names = table.hashes().map((row) => row.case);
	expect(result.outcomes.map((outcome: { name: string }) => outcome.name).sort()).toEqual(names.sort());
	for (const outcome of result.outcomes) {
		const valid = ["valid", "lowercase-bearer"].includes(outcome.name);
		expect({ name: outcome.name, status: outcome.status }).toEqual({ name: outcome.name, status: valid ? 200 : 401 });
		expect(outcome.read).toBe(valid);
		if (!valid) expect(outcome.challenge).toBe(true);
	}
});
