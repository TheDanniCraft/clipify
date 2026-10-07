/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
const probe = (mode: string) => runMcpProbe("cleanup-probe", [mode]);
describe("TDD-CLEANUP-001 / T223 bounded operational cleanup", () => {
	test("expires unused dynamic clients at 24 hours while retaining consented, granted and managed clients", () => {
		const result = probe("normal");
		expect(result.available).toBe(true);
		expect(result.remaining.clients).toEqual(["cimd", "consented", "granted", "owned", "recent", "tokenized", "trusted"]);
	});
	test("prunes expired retries and only MCP counters at the exact expiration boundary", () => {
		const result = probe("normal");
		expect(result.available).toBe(true);
		expect(result.remaining.retries).toEqual(["recent"]);
		expect(result.remaining.counters).toEqual([
			{ action: "auth:login", expired: true },
			{ action: "mcp:call:network", expired: false },
		]);
	});
	test("bounds every table sweep and leaves remaining records for a subsequent run", () => {
		const result = probe("bounded");
		expect(result.available).toBe(true);
		expect(result.remaining.clients).toHaveLength(8);
		expect(result.remaining.retries).toHaveLength(2);
		expect(result.remaining.counters).toHaveLength(3);
	});
	test("independent concurrent sweep transactions do not delete protected records", () => {
		const result = probe("concurrent");
		expect(result.available).toBe(true);
		expect(result.remaining.clients).toEqual(["cimd", "consented", "granted", "owned", "recent", "tokenized", "trusted"]);
		expect(result.remaining.retries).toEqual(["recent"]);
	});
});
