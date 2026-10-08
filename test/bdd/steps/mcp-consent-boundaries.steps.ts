import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { When, Then } = createBdd();
let result: any;
When("consent requests omit or change origin session or signed authorization state", async () => {
	result = runMcpProbe("flow-probe", ["consent:request-catalogue"], 45000);
});
Then("all eight invalid consent requests issue no code and retain no grant", async () => {
	expect(result.outcomes.map((item: any) => item.name).sort()).toEqual(["missing-origin", "foreign-origin", "missing-cookie", "invalid-cookie", "missing-signature", "changed-signature", "changed-client", "changed-scope"].sort());
	for (const item of result.outcomes) {
		expect(item.status).toBeGreaterThanOrEqual(400);
		expect(item).toMatchObject({ issuedCode: false, grantCount: 0 });
	}
});
When("signed credentials change binding or their stored grant is revoked or expired", async () => {
	result = runMcpProbe("flow-probe", ["protocol:binding-catalogue"], 45000);
});
Then("all seven invalid credentials are challenged and both valid controls can read", async () => {
	expect(result.outcomes.map((item: any) => item.name).sort()).toEqual(["valid", "wrong-subject", "wrong-client", "wrong-generation", "unknown-grant", "wrong-audience", "revoked-grant", "expired-grant", "restored-grant"].sort());
	for (const item of result.outcomes) {
		const valid = ["valid", "restored-grant"].includes(item.name);
		expect(item).toMatchObject({ status: valid ? 200 : 401, read: valid });
		if (!valid) expect(item.challenge).toBe(true);
	}
});
