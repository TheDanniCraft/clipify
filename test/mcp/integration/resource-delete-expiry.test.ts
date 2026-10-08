/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-EXPIRY-002 queued destructive authority", () => {
	test.each([
		["overlay", "token"],
		["overlay", "grant"],
		["playlist", "token"],
		["playlist", "grant"],
		["overlay", "active"],
		["playlist", "active"],
	])("%s deletion rechecks %s authority after actual resource wait", (kind, expiry) => {
		const result = runMcpProbe("resource-expiry-probe", [kind, expiry, "delete"]);
		expect(result.waited).toBe(true);
		expect(result.success).toBe(expiry === "active");
		expect(result.error).toBe(expiry === "active" ? null : "AUTHENTICATION_REQUIRED");
		expect(result.current).toEqual(expiry === "active" ? null : { name: "Before", configuration_revision: 1 });
		expect(result.audits).toBe(expiry === "active" ? 1 : 0);
	});
});
