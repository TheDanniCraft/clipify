import { AccountLifecycleService, DELETION_RECOVERY_MS, type AccountLifecycleRepository, type AccountLifecycleState, type LifecycleActor } from "@/server/account-lifecycle/service";
import { evaluateDeletionBoundary, recoverDeletion } from "@/server/account-lifecycle/recovery";
import { purgeEligibleAccount } from "@/server/account-lifecycle/purge";
import { buildDeletionNotificationIntents, buildRecoveryNotificationIntent, renderAccountLifecycleNotification } from "@/server/notifications/templates/account-lifecycle";

const SUSPENDED_AT = new Date("2026-09-28T12:00:00.000Z");
const ELIGIBLE_AT = new Date(SUSPENDED_AT.getTime() + DELETION_RECOVERY_MS);

function suspendedState(): AccountLifecycleState {
	return {
		accounts: [{ organizationId: "org_creator", creatorId: "creator_1", status: "suspended", suspensionAt: SUSPENDED_AT, purgeEligibleAt: ELIGIBLE_AT }],
		deletionRequests: [
			{
				id: "delete_1",
				organizationId: "org_creator",
				choice: "immediate",
				status: "suspended",
				requestedBy: "auth_owner",
				requestedAt: SUSPENDED_AT,
				suspensionAt: SUSPENDED_AT,
				suspendedAt: SUSPENDED_AT,
				purgeEligibleAt: ELIGIBLE_AT,
				stripeSnapshot: {},
				version: 1,
			},
		],
		subscriptions: [],
		auditEvents: [],
		resources: [{ id: "overlay_1", organizationId: "org_creator" }],
	};
}

class MemoryRepository implements AccountLifecycleRepository {
	constructor(public readonly state = suspendedState()) {}
	transaction<T>(operation: (state: AccountLifecycleState) => Promise<T>): Promise<T> {
		return operation(this.state);
	}
}

function owner(authenticatedAt: Date): LifecycleActor {
	return { authUserId: "auth_owner", sessionId: "session_owner", organizationId: "org_creator", accountRole: "owner", authenticatedAt };
}

describe("TDD-US5-002 deletion recovery, notifications, and purge", () => {
	it("keeps the account recoverable before 30 days and marks it eligible at the exact boundary", () => {
		expect(evaluateDeletionBoundary({ status: "suspended", purgeEligibleAt: ELIGIBLE_AT }, new Date(ELIGIBLE_AT.getTime() - 1))).toBe("recoverable");
		expect(evaluateDeletionBoundary({ status: "suspended", purgeEligibleAt: ELIGIBLE_AT }, ELIGIBLE_AT)).toBe("purge_eligible");
		expect(evaluateDeletionBoundary({ status: "suspended", purgeEligibleAt: ELIGIBLE_AT }, new Date(ELIGIBLE_AT.getTime() + 1))).toBe("purge_eligible");
	});

	it("rejects a link-only recovery and requires a recent authenticated owner", async () => {
		const repository = new MemoryRepository();
		await expect(recoverDeletion(repository, owner(SUSPENDED_AT), { requestId: "delete_1", now: SUSPENDED_AT, recoveryEntryOnly: true })).rejects.toThrow("AUTHENTICATION_REQUIRED");
		await expect(recoverDeletion(repository, owner(new Date(SUSPENDED_AT.getTime() - 5 * 60 * 1000 - 1)), { requestId: "delete_1", now: SUSPENDED_AT })).rejects.toThrow("RECENT_AUTH_REQUIRED");
	});

	it("restores runtime before 30 days without restarting billing or reclaiming an agency allocation", async () => {
		const repository = new MemoryRepository();
		const effects: string[] = [];
		const recoveryAt = new Date(SUSPENDED_AT.getTime() + 10 * 24 * 60 * 60 * 1000);
		const recovered = await recoverDeletion(repository, owner(recoveryAt), {
			requestId: "delete_1",
			now: recoveryAt,
			resumeRuntime: async () => void effects.push("runtime"),
			restartBilling: async () => void effects.push("billing"),
			reclaimAgencyAllocation: async () => void effects.push("allocation"),
		});

		expect(recovered.status).toBe("recovered");
		expect(repository.state.accounts[0].status).toBe("active");
		expect(repository.state.resources).toHaveLength(1);
		expect(effects).toEqual(["runtime"]);
		expect(repository.state.auditEvents.at(-1)).toMatchObject({ action: "account.deletion.recover", outcome: "success" });
	});

	it("emits exactly one request, suspension/30, 7, 3, 1, 0, and recovery notification intent", () => {
		const intents = [...buildDeletionNotificationIntents({ requestId: "delete_1", recipient: "creator@example.com", requestedAt: SUSPENDED_AT, suspensionAt: SUSPENDED_AT, purgeEligibleAt: ELIGIBLE_AT }), buildRecoveryNotificationIntent({ requestId: "delete_1", recipient: "creator@example.com", recoveredAt: SUSPENDED_AT })];
		expect(intents.map((intent) => intent.boundary)).toEqual(["request", "suspension", "7d", "3d", "1d", "0d", "recovery"]);
		expect(new Set(intents.map((intent) => intent.dedupeKey)).size).toBe(7);
		expect(intents.find((intent) => intent.boundary === "7d")?.scheduledAt).toEqual(new Date(ELIGIBLE_AT.getTime() - 7 * 24 * 60 * 60 * 1000));
	});

	it("renders product-owned notices without credentials or duplicated Stripe billing language", () => {
		const message = renderAccountLifecycleNotification("7d", { effectiveAt: ELIGIBLE_AT, recoveryPath: "/dashboard/settings/account/recovery" });
		expect(message.subject).toContain("7 days");
		expect(message.body).toContain("data deletion");
		expect(message.body).toContain("sign in");
		expect(message.body).not.toMatch(/invoice|receipt|payment failed|bearer|token|otp|secret/i);
	});

	it("purges in dependency order once, retains a lawful audit tombstone, and never auto-restores", async () => {
		const repository = new MemoryRepository();
		const order: string[] = [];
		const purge = () =>
			purgeEligibleAccount(repository, {
				requestId: "delete_1",
				now: ELIGIBLE_AT,
				deleteResources: async () => void order.push("resources"),
				deleteMemberships: async () => void order.push("memberships"),
				deleteIdentity: async () => void order.push("identity"),
				restoreDatabase: async () => void order.push("restore"),
			});

		await expect(purge()).resolves.toEqual({ purged: true });
		await expect(purge()).resolves.toEqual({ purged: false });
		expect(order).toEqual(["resources", "memberships", "identity"]);
		expect(repository.state.auditEvents.at(-1)).toMatchObject({ action: "account.deletion.purge", outcome: "success" });
	});

	it("does not permit purge one millisecond before eligibility", async () => {
		const repository = new MemoryRepository();
		await expect(purgeEligibleAccount(repository, { requestId: "delete_1", now: new Date(ELIGIBLE_AT.getTime() - 1) })).rejects.toThrow("PURGE_NOT_ELIGIBLE");
	});

	it("keeps account deletion independent from creating a second lifecycle service", () => {
		expect(new AccountLifecycleService(new MemoryRepository(), { now: () => SUSPENDED_AT })).toBeInstanceOf(AccountLifecycleService);
	});
});

test("deletion has the full countdown catalog but does not duplicate the request at day thirty", () => {
	const requestedAt = new Date("2030-01-01T12:00:00Z");
	const base = { requestId: "schedule", recipient: "alex@example.test", requestedAt, suspensionAt: requestedAt };
	const standard = buildDeletionNotificationIntents({ ...base, purgeEligibleAt: new Date(requestedAt.getTime() + 30 * 86400000) });
	expect(standard.some((i) => i.boundary === "30d")).toBe(false);
	const long = buildDeletionNotificationIntents({ ...base, purgeEligibleAt: new Date(requestedAt.getTime() + 60 * 86400000) });
	expect(long.map((i) => i.boundary)).toEqual(["request", "suspension", "30d", "7d", "3d", "1d", "0d"]);
});
