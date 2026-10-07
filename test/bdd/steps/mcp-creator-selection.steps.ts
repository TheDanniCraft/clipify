import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let result: any;
Given("an authenticated owner has approved one creator for a real OAuth client", async () => {});
When("another creator is owned and a new consent approves both creators", async () => {
	result = runMcpProbe("flow-probe", ["protocol:creator-selection-catalogue"], 45000);
});
Then("creator calls require explicit approval and current membership", async () => {
	expect(result.initialList.result.items.map((item: any) => item.id)).toEqual(["fixture-creator"]);
	expect(result.initialRead.result.creatorId).toBe("fixture-creator");
	expect(result.unapproved.result.error.code).toBe("ACCESS_DENIED");
	expect(JSON.stringify(result.unapproved.result)).not.toContain("Second owned");
	expect(result.missing.result.error.code).toBe("INVALID_INPUT");
	expect(result).toMatchObject({ consentStatus: 200, tokenStatus: 200, distinctGrant: true, generation: 1, subjectBound: true });
	expect(result.expandedCreators).toEqual(["fixture-creator", "second-owned-creator"]);
	expect(result.expandedList.result.items.map((item: any) => item.id)).toEqual(result.expandedCreators);
	expect(result.afterThirdOwnership.result.items.map((item: any) => item.id)).toEqual(["fixture-creator", "second-owned-creator"]);
	expect(result.thirdSelection.result.error.code).toBe("ACCESS_DENIED");
	expect(JSON.stringify(result.thirdSelection.result)).not.toContain("Third owned");
	expect(result.firstSelection.result.creatorId).toBe("fixture-creator");
	expect(result.secondSelection.result.creatorId).toBe("second-owned-creator");
	expect(result.oldAccess).toMatchObject({ status: 401, error: "invalid_token" });
	expect(result.oldAccess.challenge).toContain("resource_metadata=");
	expect(result.afterRemoval.result.items.map((item: any) => item.id)).toEqual(["fixture-creator"]);
	expect(result.removedSelection.result.error.code).toBe("ACCESS_DENIED");
	expect(result.approvalsAfterRemoval).toEqual(result.expandedCreators);
});
