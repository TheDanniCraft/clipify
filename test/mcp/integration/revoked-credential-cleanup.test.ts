/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-CLEANUP-003 durable revoked credential cleanup", () => {
	test("retries cleanup from durable local revocation without touching another active connection", () => {
		const result = runMcpProbe("revoked-cleanup-probe", ["normal"]);
		expect(result.available).toBe(true);
		expect(result.revoked).toBe(true);
		for (const ids of Object.values(result.remaining)) expect(ids).toEqual(["active", "unbound", "unknown"]);
	});
	test("bounds each credential table and leaves remaining work for later sweeps", () => {
		const result = runMcpProbe("revoked-cleanup-probe", ["bounded"]);
		expect(result.available).toBe(true);
		expect(result.revoked).toBe(true);
		for (const ids of Object.values(result.remaining)) expect(ids).toHaveLength(5);
	});
	test("independent concurrent workers leave active and unrelated credentials untouched", () => {
		const result = runMcpProbe("revoked-cleanup-probe", ["concurrent"]);
		expect(result.available).toBe(true);
		expect(result.revoked).toBe(true);
		for (const ids of Object.values(result.remaining)) {
			expect(ids).toEqual(expect.arrayContaining(["active", "unbound", "unknown"]));
			expect((ids as string[]).filter((id) => id.startsWith("revoked"))).toHaveLength(1);
		}
	});
});
