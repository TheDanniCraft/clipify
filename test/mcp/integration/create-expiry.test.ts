/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-EXPIRY-004 creation authority through audit commit", () => {
	test.each(["overlay", "playlist"].flatMap((kind) => ["token", "grant", "active"].map((expiry) => [kind, expiry])))("%s rechecks %s authority after audit wait", (kind, expiry) => {
		const result = runMcpProbe("create-expiry-probe", [kind, expiry]);
		expect(result.waited).toBe(true);
		expect(result.success).toBe(expiry === "active");
		expect(result.error).toBe(expiry === "active" ? null : "AUTHENTICATION_REQUIRED");
		expect(result.resources).toBe(expiry === "active" ? 1 : 0);
		expect(result.retries).toBe(expiry === "active" ? 1 : 0);
		expect(result.audits).toBe(expiry === "active" ? 1 : 0);
	});
});
