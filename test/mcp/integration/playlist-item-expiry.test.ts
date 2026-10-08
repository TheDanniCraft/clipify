/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-EXPIRY-003 queued playlist item authority", () => {
	test.each(["remove", "reorder", "replace"].flatMap((operation) => ["token", "grant", "active"].map((expiry) => [operation, expiry])))("%s rechecks %s authority after resource lock wait", (operation, expiry) => {
		const result = runMcpProbe("playlist-item-expiry-probe", [operation, expiry]);
		expect(result.waited).toBe(true);
		expect(result.success).toBe(expiry === "active");
		expect(result.error).toBe(expiry === "active" ? null : "AUTHENTICATION_REQUIRED");
		expect(result.current).toEqual({ name: "Before", configuration_revision: expiry === "active" ? 2 : 1 });
		expect(result.audits).toBe(expiry === "active" ? 1 : 0);
		const ids = expiry !== "active" ? ["clip-a", "clip-b"] : operation === "reorder" ? ["clip-b", "clip-a"] : ["clip-b"];
		expect(result.items).toEqual(ids.map((clip_id, position) => ({ clip_id, position })));
	});
});
