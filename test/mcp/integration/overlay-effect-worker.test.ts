/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
test("TDD-OVERLAY-EFFECT-002 provider failure leaves durable retry then completes without recreating resource", () => {
	const result = runMcpProbe("overlay-effect-worker-probe", [], 45000);
	expect(result.available).toBe(true);
	expect(result.outsideResourceLock).toBe(true);
	expect(result.calls).toBe(2);
	expect(result.earlyCalls).toBe(1);
	expect(result.afterFailure.jobs).toEqual([expect.objectContaining({ status: "retry", attempts: 1, last_error: "provider_unavailable", claimed_by: null, claim_expires_at: null })]);
	expect(result.afterRetry.jobs).toEqual([expect.objectContaining({ status: "done", attempts: 2, last_error: null, claimed_by: null, claim_expires_at: null })]);
	expect(result.afterFailure.resources).toEqual([{ configuration_revision: 1, reward_id: "RewardOne" }]);
	expect(result.afterRetry.resources).toEqual(result.afterFailure.resources);
});

describe("TDD-OVERLAY-EFFECT-003 current desired reward", () => {
	test.each(["cleared", "changed"])("%s configuration makes old reward work obsolete without provider I/O", (mode) => {
		const result = runMcpProbe("overlay-effect-worker-probe", [mode], 45000);
		expect(result.calls).toBe(0);
		expect(result.state.jobs).toEqual([expect.objectContaining({ status: "obsolete", attempts: 1, claimed_by: null, claim_expires_at: null })]);
	});
	test("unrelated name/revision edit preserves pending work for the unchanged reward", () => {
		const result = runMcpProbe("overlay-effect-worker-probe", ["name-only"], 45000);
		expect(result.calls).toBe(1);
		expect(result.state.jobs).toEqual([expect.objectContaining({ status: "done", attempts: 1 })]);
		expect(result.state.resources).toEqual([{ configuration_revision: 2, reward_id: "RewardOne" }]);
	});
	test("deleted overlay cascades work and makes no provider call", () => {
		const result = runMcpProbe("overlay-effect-worker-probe", ["deleted"], 45000);
		expect(result.calls).toBe(0);
		expect(result.state).toEqual({ jobs: [], resources: [] });
	});
});

describe("TDD-OVERLAY-EFFECT-004 durable job lease boundaries", () => {
	test("queued work reclaimed by another worker cannot still send from the old batch", () => {
		const result = runMcpProbe("overlay-effect-worker-probe", ["lease-replaced"], 45000);
		expect(result.calls).toEqual(["RewardOne", "RewardTwo"]);
		expect(result.jobs).toEqual([expect.objectContaining({ reward_id: "RewardOne", status: "done", attempts: 1 }), expect.objectContaining({ reward_id: "RewardTwo", status: "done", attempts: 2 })]);
	});
	test("two concurrent workers issue one call while its durable lease is live", () => {
		const result = runMcpProbe("overlay-effect-worker-probe", ["concurrent"], 45000);
		expect(result.calls).toEqual(["RewardOne"]);
		expect(result.jobs).toEqual([expect.objectContaining({ status: "done", attempts: 1 })]);
	});
	test("expired orphan claim is recoverable", () => {
		const result = runMcpProbe("overlay-effect-worker-probe", ["expired-reclaim"], 45000);
		expect(result.calls).toEqual(["RewardOne"]);
		expect(result.jobs).toEqual([expect.objectContaining({ status: "done", attempts: 1 })]);
	});
	test("future scheduled work remains untouched", () => {
		const result = runMcpProbe("overlay-effect-worker-probe", ["not-due"], 45000);
		expect(result.calls).toEqual([]);
		expect(result.jobs).toEqual([expect.objectContaining({ status: "pending", attempts: 0 })]);
	});
});
