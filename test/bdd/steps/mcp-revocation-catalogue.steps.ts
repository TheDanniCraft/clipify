import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { When, Then } = createBdd();
let result: any;
When("real consented connection revocation encounters invalid requests database failure and queued cleanup", async () => {
	result = runMcpProbe("flow-probe", ["protocol:revocation-catalogue"], 45000);
});
Then("denied requests preserve the grant and a failed commit preserves real bearer access", async () => {
	expect(result.denied).toEqual(
		[
			["missing-origin", 403],
			["foreign-origin", 403],
			["missing-cookie", 401],
			["invalid-id", 400],
			["unknown-id", 404],
		].map(([name, status]) => ({ name, status, state: { active: true, revoked: false } })),
	);
	expect(result.foreign).toEqual({ status: 404, state: { active: true, revoked: false } });
	expect(result.failure).toEqual({ status: 503, state: { active: true, revoked: false }, read: 200 });
});
Then("completed revocation denies the next public call despite provider cleanup failure", async () => {
	expect(result.blocked).toBe(true);
	expect(result.pendingState).toEqual({ active: true, revoked: false });
	expect(result.cleanup).toMatchObject({ status: 200, body: { revoked: true, cleanupPending: true }, state: { active: false, revoked: true }, read: 401 });
	expect(result.cleanup.remainingRefresh).toBeGreaterThan(0);
});
Then("retry cleans credentials without restoring access or an inaccurate connection listing", async () => {
	expect(result.retry).toEqual({ status: 200, body: { revoked: true, cleanupPending: false }, read: 401, remainingRefresh: 0 });
	expect(result.listed).toEqual([{ active: false, revoked: true }]);
});
