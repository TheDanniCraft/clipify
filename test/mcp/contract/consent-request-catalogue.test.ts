/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
let result: any;
beforeAll(() => {
	result = runMcpProbe("flow-probe", ["consent:request-catalogue"], 45000);
});
describe("TDD-US1-029 consent request authenticated actor and signed state", () => {
	test.each(["missing-origin", "foreign-origin", "missing-cookie", "invalid-cookie", "missing-signature", "changed-signature", "changed-client", "changed-scope"])("rejects %s without issuing or retaining authority", (name) => {
		const outcome = result.outcomes.find((item: any) => item.name === name);
		expect(outcome.status).toBeGreaterThanOrEqual(400);
		expect(outcome).toMatchObject({ issuedCode: false, grantCount: 0 });
	});
});
