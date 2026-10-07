/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
let result: any;
beforeAll(() => {
	result = runMcpProbe("flow-probe", ["protocol:revocation-catalogue"], 45000);
});
describe("TDD-US1-024 actual durable revocation boundary", () => {
	test.each([
		["missing-origin", 403],
		["foreign-origin", 403],
		["missing-cookie", 401],
		["invalid-id", 400],
		["unknown-id", 404],
	])("denied %s preserves active grant", (name, status) => {
		expect(result.denied.find((row: any) => row.name === name)).toEqual({ name, status, state: { active: true, revoked: false } });
	});
	test("foreign actor grant is not changed", () => {
		expect(result.foreign).toEqual({ status: 404, state: { active: true, revoked: false } });
	});
	test("failed durable commit reports failure and leaves actual bearer usable", () => {
		expect(result.failure).toEqual({ status: 503, state: { active: true, revoked: false }, read: 200 });
	});
	test("queued revoke waits for the real row lock then durably denies the next public call", () => {
		expect(result.blocked).toBe(true);
		expect(result.pendingState).toEqual({ active: true, revoked: false });
		expect(result.cleanup).toMatchObject({ status: 200, body: { revoked: true, cleanupPending: true }, state: { active: false, revoked: true }, read: 401 });
		expect(result.cleanup.remainingRefresh).toBeGreaterThan(0);
	});
	test("retry removes provider credentials without restoring access or inaccurate listing", () => {
		expect(result.retry).toEqual({ status: 200, body: { revoked: true, cleanupPending: false }, read: 401, remainingRefresh: 0 });
		expect(result.listed).toEqual([{ active: false, revoked: true }]);
	});
});
