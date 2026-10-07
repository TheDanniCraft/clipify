/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-ROLLOUT-BOOTSTRAP-001 public OAuth surfaces", () => {
	test.each(["missing-grants:register", "missing-revision:register", "missing-rate:register", "missing-rate:authorization", "missing-rate:resource", "missing-rate:root", "missing-grants:authorization", "missing-grants:resource", "missing-grants:root", "missing-grants:jwks"])("%s stays safely unavailable", (mode) => {
		const r = runMcpProbe("rollout-probe", [mode]);
		expect(r.status).toBe(503);
		expect(r.body).toEqual({ error: "service_unavailable" });
	});
	test.each([
		["ready:register", 201],
		["ready:authorization", 200],
		["ready:resource", 200],
		["ready:root", 200],
		["missing-grants:session", 200],
		["ready:session", 200],
		["ready:jwks", 200],
	])("%s preserves expected availability", (mode, status) => {
		expect(runMcpProbe("rollout-probe", [String(mode)]).status).toBe(status);
	});
});
