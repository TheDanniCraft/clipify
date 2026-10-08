/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
test("TDD-CONSENT-NATIVE-QUERY-002 official helper verifies the actual provider-issued query", () => {
	expect(runMcpProbe("consent-target-probe", ["native-query"])).toEqual({ valid: true, changed: false, duplicate: false, expired: false });
});
