import { AccountLifecycleService, type AccountLifecycleRepository, type AccountLifecycleState, type LifecycleActor } from "@/server/account-lifecycle/service";
import { recentAuthBoundary } from "../../support/auth-engine-rewrite/time";

const NOW = new Date("2026-09-28T12:00:00.000Z");
const PERIOD_END = new Date("2026-10-28T12:00:00.000Z");

function initialState(): AccountLifecycleState {
	return {
		accounts: [{ organizationId: "org_creator", creatorId: "creator_1", status: "active" }],
		deletionRequests: [],
		subscriptions: [{ id: "sub_1", organizationId: "org_creator", status: "active", currentPeriodEnd: PERIOD_END, cancelAtPeriodEnd: false, latestStripeEventCreated: 0 }],
		auditEvents: [],
		resources: [
			{ id: "overlay_1", organizationId: "org_creator" },
			{ id: "playlist_1", organizationId: "org_creator" },
		],
	};
}

class MemoryRepository implements AccountLifecycleRepository {
	constructor(public readonly state: AccountLifecycleState = initialState()) {}

	async transaction<T>(operation: (draft: AccountLifecycleState) => Promise<T>): Promise<T> {
		return operation(this.state);
	}
}

function owner(authenticatedAt = NOW): LifecycleActor {
	return { authUserId: "auth_owner", sessionId: "session_owner", organizationId: "org_creator", accountRole: "owner", authenticatedAt };
}

function member(authenticatedAt = NOW): LifecycleActor {
	return { authUserId: "auth_member", sessionId: "session_member", organizationId: "org_creator", accountRole: "member", authenticatedAt };
}

describe("TDD-US5-001 account and subscription lifecycle", () => {
	it.each(["read", "update", "export", "subscription:read", "subscription:manage", "subscription:cancel"] as const)("allows a recently authenticated owner to perform %s", async (operation) => {
		const service = new AccountLifecycleService(new MemoryRepository(), { now: () => NOW });
		await expect(service.authorizeOwnerOperation(owner(), operation)).resolves.toEqual(expect.objectContaining({ organizationId: "org_creator" }));
	});

	it("denies destructive or billing operations to a non-owner even with a fresh session", async () => {
		const service = new AccountLifecycleService(new MemoryRepository(), { now: () => NOW });
		await expect(service.authorizeOwnerOperation(member(), "delete")).rejects.toThrow("OWNER_REQUIRED");
		await expect(service.requestDeletion(member(), { choice: "immediate" })).rejects.toThrow("OWNER_REQUIRED");
	});

	it("accepts identity confirmation at exactly five minutes and rejects it one millisecond later", async () => {
		const boundary = recentAuthBoundary(NOW);
		const service = new AccountLifecycleService(new MemoryRepository(), { now: () => NOW });
		await expect(service.authorizeOwnerOperation(owner(boundary.exact), "delete")).resolves.toBeDefined();
		await expect(service.authorizeOwnerOperation(owner(boundary.outside), "delete")).rejects.toThrow("RECENT_AUTH_REQUIRED");
	});

	it("defaults deletion to paid-through suspension and preserves all resources", async () => {
		const repository = new MemoryRepository();
		const revoked: string[] = [];
		const service = new AccountLifecycleService(repository, { now: () => NOW, revokeSessions: async (id) => void revoked.push(id) });
		const request = await service.requestDeletion(owner(), { choice: "paid_through" });

		expect(request).toMatchObject({ choice: "paid_through", status: "scheduled", suspensionAt: PERIOD_END });
		expect(repository.state.accounts[0]).toMatchObject({ status: "suspension_scheduled" });
		expect(repository.state.resources).toHaveLength(2);
		expect(revoked).toEqual([]);
		expect(repository.state.subscriptions[0].cancelAtPeriodEnd).toBe(true);
	});

	it("suspends immediately, revokes sessions, pauses runtime, and releases allocation without deleting data", async () => {
		const repository = new MemoryRepository();
		const effects: string[] = [];
		const service = new AccountLifecycleService(repository, {
			now: () => NOW,
			revokeSessions: async () => void effects.push("sessions"),
			pauseRuntime: async () => void effects.push("runtime"),
			releaseAgencyAllocation: async () => void effects.push("allocation"),
		});
		const request = await service.requestDeletion(owner(), { choice: "immediate" });

		expect(request).toMatchObject({ status: "suspended", suspendedAt: NOW });
		expect(request.purgeEligibleAt).toEqual(new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000));
		expect(repository.state.resources.map((resource) => resource.id)).toEqual(["overlay_1", "playlist_1"]);
		expect(effects).toEqual(["sessions", "runtime", "allocation"]);
	});

	it("requires an authenticated Stripe event and ignores reordered older state", async () => {
		const repository = new MemoryRepository();
		const service = new AccountLifecycleService(repository, { now: () => NOW });

		await expect(service.applyStripeSubscriptionEvent({ verified: false, organizationId: "org_creator", subscriptionId: "sub_1", created: 30, status: "canceled", cancelAtPeriodEnd: true, currentPeriodEnd: PERIOD_END })).rejects.toThrow("STRIPE_SIGNATURE_REQUIRED");
		await service.applyStripeSubscriptionEvent({ verified: true, organizationId: "org_creator", subscriptionId: "sub_1", created: 30, status: "canceled", cancelAtPeriodEnd: true, currentPeriodEnd: PERIOD_END });
		await service.applyStripeSubscriptionEvent({ verified: true, organizationId: "org_creator", subscriptionId: "sub_1", created: 10, status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: PERIOD_END });

		expect(repository.state.subscriptions[0]).toMatchObject({ status: "canceled", cancelAtPeriodEnd: true, latestStripeEventCreated: 30 });
	});

	it("permits only one nonterminal deletion request and records immutable outcomes", async () => {
		const repository = new MemoryRepository();
		const service = new AccountLifecycleService(repository, { now: () => NOW });
		await service.requestDeletion(owner(), { choice: "paid_through" });
		await expect(service.requestDeletion(owner(), { choice: "immediate" })).rejects.toThrow("DELETION_ALREADY_REQUESTED");

		expect(repository.state.deletionRequests).toHaveLength(1);
		expect(repository.state.auditEvents).toEqual([expect.objectContaining({ action: "account.deletion.request", outcome: "success", actorUserId: "auth_owner" }), expect.objectContaining({ action: "account.deletion.request", outcome: "denied", actorUserId: "auth_owner", reason: "DELETION_ALREADY_REQUESTED" })]);
	});
});
