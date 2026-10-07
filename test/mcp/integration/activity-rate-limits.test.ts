/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
const probe = (mode: string) => runMcpProbe("rate-limit-probe", [mode]);
describe("TDD-US4-017 shared persistent rate-budget prerequisites", () => {
	test("allows below and exactly at a call budget, rejects above it with retry guidance", () => {
		const result = probe("boundary");
		expect(result.available).toBe(true);
		expect(result.results.map((decision: any) => decision.allowed)).toEqual([true, true, true, false]);
		expect(result.results[3]).toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 60 });
		expect(result.counters.every((row: any) => row.count === 3)).toBe(true);
	});
	test("resets at the exact boundary, not a millisecond earlier", () => {
		expect(probe("reset").results).toMatchObject([{ allowed: false, retryAfterSeconds: 1 }, { allowed: true }]);
	});
	test("coordinates twenty independent database transactions without admitting over budget", () => {
		const result = probe("concurrent");
		expect(result.results.filter((value: any) => value.allowed)).toHaveLength(3);
		expect(result.counters.every((row: any) => row.count === 3)).toBe(true);
	});
	test("isolates actor/client pairs while preserving the common network ceiling", () => {
		expect(probe("identity").results).toMatchObject([{ allowed: true }, { allowed: true }, { allowed: false }]);
	});
	test("the network limit spans different actors and isolates other networks", () => {
		expect(probe("network").results).toMatchObject([{ allowed: false }, { allowed: true }]);
	});
	test("registration minute and day budgets both apply without consuming rejected requests", () => {
		expect(probe("registration").results).toMatchObject([{ allowed: true }, { allowed: true }, { allowed: false, retryAfterSeconds: 60 }, { allowed: true }, { allowed: false, retryAfterSeconds: 86280 }]);
	});
	test("missing signal-hashing secret fails closed without persisting raw identity or counters", () => {
		expect(probe("missing-secret")).toMatchObject({ results: ["unavailable"], counters: [] });
	});
	test("unavailable database limiter fails closed", () => {
		expect(probe("database-failure").results).toEqual(["unavailable"]);
	});
	test("persisted keys contain HMAC digests rather than raw caller information", () => {
		const result = probe("boundary");
		expect(result.available).toBe(true);
		expect(result.counters).toHaveLength(2);
		for (const row of result.counters) {
			expect(row.signal_hash).toMatch(/^[a-f0-9]{64}$/);
			expect(JSON.stringify(row)).not.toContain("actor-one");
			expect(JSON.stringify(row)).not.toContain("127.0.0.1");
		}
	});
});
