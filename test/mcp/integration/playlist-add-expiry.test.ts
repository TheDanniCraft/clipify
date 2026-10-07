/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-EXPIRY-005 queued validated clip addition", () => {
	test.each(["token", "grant", "active"])("%s authority is checked after clip validation and resource wait", (expiry) => {
		const result = runMcpProbe("playlist-add-expiry-probe", [expiry]);
		expect(result.waited).toBe(true);
		expect(result.providerCalls).toBe(1);
		expect(result.credentialUsed).toBe(true);
		expect(result.success).toBe(expiry === "active");
		expect(result.error).toBe(expiry === "active" ? null : "AUTHENTICATION_REQUIRED");
		expect(result.current).toEqual({ name: "Before", configuration_revision: expiry === "active" ? 2 : 1 });
		expect(result.audits).toBe(expiry === "active" ? 1 : 0);
		const ids = expiry === "active" ? ["clip-a", "clip-b", "NewClip"] : ["clip-a", "clip-b"];
		expect(result.items).toEqual(ids.map((clip_id, position) => ({ clip_id, position })));
	});
});
