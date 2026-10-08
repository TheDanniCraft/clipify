/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-US1-003 registration JSON root boundaries", () => {
	test.each([null, [], "client", 1, true])("rejects non-object metadata %j without a server error", (value) => {
		const response = runMcpProbe("provider-probe", ["register", JSON.stringify(value)]);
		expect(response.status).toBe(400);
		expect(response.body).toEqual({ error: "invalid_client_metadata" });
	});
});
