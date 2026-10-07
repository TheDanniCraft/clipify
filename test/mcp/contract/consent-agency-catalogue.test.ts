/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";

describe("server-validated consent agency context and creator uniqueness", () => {
	let result: any;
	beforeAll(() => {
		result = runMcpProbe("consent-target-probe", ["agency-catalogue"]);
	});
	test.each(["valid", "restored"])("%s agency context preserves exactly the approved creator", (name) => {
		expect(result.outcomes.find((row: any) => row.name === name)).toEqual({ name, status: 200, issuedCode: true, newGrants: 1, currentCreators: [{ creatorId: "foreign-creator", agencyOrganizationId: "consent-agency" }] });
	});
	test.each(["missing-agency", "foreign-agency", "removed-member", "revoked-link", "missing-ceiling", "duplicate-creator"])("%s cannot grant new authority", (name) => {
		expect(result.outcomes.find((row: any) => row.name === name)).toMatchObject({ name, status: name === "duplicate-creator" ? 400 : 403, issuedCode: false, newGrants: 0 });
	});
	test("native PostgreSQL enforces a unique grant/creator approval", () => {
		expect(result.uniqueEnforced).toBe(true);
	});
});
