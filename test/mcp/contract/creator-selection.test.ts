/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
let result: any;
beforeAll(() => {
	result = runMcpProbe("flow-probe", ["protocol:creator-selection-catalogue"], 45000);
});

describe("TDD-US1-026 immutable approval and live creator selection", () => {
	test("subsequent ownership does not automatically expand the approved creator set", () => {
		expect(result.initialList.status).toBe(200);
		expect(result.initialList.result.items.map((creator: any) => creator.id)).toEqual(["fixture-creator"]);
		expect(result.initialCreators).toEqual(["fixture-creator"]);
	});
	test("an explicit approved creator is readable", () => {
		expect(result.initialRead.result.creatorId).toBe("fixture-creator");
	});
	test("an owned but unapproved creator is denied without private creator metadata", () => {
		expect(result.unapproved.result.error.code).toBe("ACCESS_DENIED");
		expect(JSON.stringify(result.unapproved.result)).not.toContain("Second owned");
	});
	test("an operation with no explicit creator context is invalid", () => {
		expect(result.missing.result.error.code).toBe("INVALID_INPUT");
	});
	test("expansion uses new actual consent and a distinct subject-bound grant", () => {
		expect(result).toMatchObject({ consentStatus: 200, tokenStatus: 200, distinctGrant: true, generation: 1, subjectBound: true });
		expect(result.expandedCreators).toEqual(["fixture-creator", "second-owned-creator"]);
		expect(result.expandedList.result.items.map((creator: any) => creator.id)).toEqual(["fixture-creator", "second-owned-creator"]);
	});
	test("a user with three accessible creators receives only the two newly approved creators", () => {
		expect(result.afterThirdOwnership.result.items.map((creator: any) => creator.id)).toEqual(["fixture-creator", "second-owned-creator"]);
		expect(result.thirdSelection.result.error.code).toBe("ACCESS_DENIED");
		expect(JSON.stringify(result.thirdSelection.result)).not.toContain("Third owned");
	});
	test("each call selects its explicit approved creator without sticky account state", () => {
		expect(result.firstSelection.result.creatorId).toBe("fixture-creator");
		expect(result.secondSelection.result.creatorId).toBe("second-owned-creator");
	});
	test("replaced consent cannot keep using the old signed access token", () => {
		expect(result.oldAccess.status).toBe(401);
		expect(result.oldAccess.error).toBe("invalid_token");
		expect(result.oldAccess.challenge).toContain("resource_metadata=");
	});
	test("live membership removal shrinks access while the immutable approved set is preserved", () => {
		expect(result.afterRemoval.result.items.map((creator: any) => creator.id)).toEqual(["fixture-creator"]);
		expect(result.removedSelection.result.error.code).toBe("ACCESS_DENIED");
		expect(result.approvalsAfterRemoval).toEqual(["fixture-creator", "second-owned-creator"]);
	});
});
