import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let result: any;
Given("the consent actor has an agency link to a creator they do not directly own", async () => {
	result = undefined;
});
When("the real provider consent is attempted with valid and invalid agency contexts", async () => {
	result = runMcpProbe("consent-target-probe", ["agency-catalogue"]);
});
Then("only current agency membership and a matching permission ceiling issue creator authority", async () => {
	expect(result.outcomes).toHaveLength(8);
	for (const row of result.outcomes) {
		const valid = row.name === "valid" || row.name === "restored";
		expect(row.status).toBe(valid ? 200 : row.name === "duplicate-creator" ? 400 : 403);
		expect(row.issuedCode).toBe(valid);
		expect(row.newGrants).toBe(valid ? 1 : 0);
		if (valid) expect(row.currentCreators).toEqual([{ creatorId: "foreign-creator", agencyOrganizationId: "consent-agency" }]);
	}
	expect(result.uniqueEnforced).toBe(true);
});
