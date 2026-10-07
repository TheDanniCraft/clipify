/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-EXPIRY-001 queued resource mutation authority", () => {
	test.each([
		["overlay", "token"],
		["overlay", "grant"],
		["playlist", "token"],
		["playlist", "grant"],
		["overlay", "active"],
		["playlist", "active"],
	])("%s rechecks %s authority after real resource lock wait", (kind, expiry) => {
		const result = runMcpProbe("resource-expiry-probe", [kind, expiry]);
		expect(result.waited).toBe(true);
		expect(result.success).toBe(expiry === "active");
		expect(result.error).toBe(expiry === "active" ? null : "AUTHENTICATION_REQUIRED");
		expect(result.current).toEqual({ name: expiry === "active" ? "After" : "Before", configuration_revision: expiry === "active" ? 2 : 1 });
		expect(result.audits).toBe(expiry === "active" ? 1 : 0);
	});
});
