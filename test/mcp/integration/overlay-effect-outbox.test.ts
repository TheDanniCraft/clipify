/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-OVERLAY-EFFECT-001 atomic durable reward intent", () => {
	test("committed Pro reward edit retains a pending job with its exact committed revision", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["overlay-save-reward-outbox"]);
		expect(result.deleted).toMatchObject({ rewardId: "RewardOne", configurationRevision: 2 });
		expect(result.effectJobs).toEqual([expect.objectContaining({ overlay_id: result.deleted.id, creator_id: "creator", reward_id: "RewardOne", configuration_revision: 2, status: "pending", attempts: 0 })]);
	});
	test("stale edit creates neither a reward change nor an external intent", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["overlay-save-reward-outbox-stale"]);
		expect(result.deleted).toBeNull();
		expect(result.storedOverlay).toMatchObject({ configuration_revision: 1, reward_id: null });
		expect(result.effectJobs).toEqual([]);
		expect(result.activity).toEqual([]);
	});
	test("post-intent audit failure rolls back configuration and the inserted job together", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["overlay-save-reward-outbox-rollback"]);
		expect(result.deleted).toBeNull();
		expect(result.storedOverlay).toMatchObject({ configuration_revision: 1, reward_id: null });
		expect(result.effectJobs).toEqual([]);
		expect(result.activity).toEqual([]);
	});
	test.each(["unchanged", "clear"])("%s reward does not schedule a subscription", (mode) => {
		const result = runMcpProbe("browser-playlist-delete-probe", [`overlay-save-reward-outbox-${mode}`]);
		expect(result.deleted).toMatchObject({ configurationRevision: 2, rewardId: mode === "clear" ? null : "RewardOne" });
		expect(result.effectJobs).toEqual([]);
		expect(result.activity).toHaveLength(1);
	});
	test("public save commits the durable job without issuing best-effort provider requests", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["overlay-save-reward-outbox-public"], 45000);
		expect(result.deleted).toMatchObject({ rewardId: "RewardOne", configurationRevision: 2 });
		expect(result.effectJobs).toHaveLength(1);
		expect(result.providerRequests).toEqual([]);
	});
});
