/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-ROLLOUT-BOOTSTRAP-002 direct provider discovery", () => {
	test.each(["missing-grants", "missing-revision", "missing-provider", "nullable-revision", "missing-rate", "bad-origin"])("%s guards the provider's direct public metadata path", (mode) => {
		const r = runMcpProbe("rollout-probe", [mode + ":directauthorization"]);
		expect(r.status).toBe(503);
		expect(r.body).toEqual({ error: "service_unavailable" });
	});
	test("ready schema retains provider-owned direct metadata", () => {
		expect(runMcpProbe("rollout-probe", ["ready:directauthorization"]).status).toBe(200);
	});
});
