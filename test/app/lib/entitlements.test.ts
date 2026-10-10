/** @jest-environment node */
jest.mock("@/server/notifications/benefit-events", () => ({ queueGrantEmails: jest.fn() }));
import { Plan, Entitlement, EntitlementGrantSource, RunnerStatus, StreamState } from "@types";
import { PgDialect } from "drizzle-orm/pg-core";

const selectExecute = jest.fn();
const deleteExecute = jest.fn();
const updateExecute = jest.fn();
const findUser = jest.fn();

const queryBuilder = {
	from: jest.fn(),
	where: jest.fn(),
	limit: jest.fn(),
	orderBy: jest.fn(),
	execute: (...args: unknown[]) => selectExecute(...args),
};

queryBuilder.from.mockImplementation(() => queryBuilder);
queryBuilder.where.mockImplementation(() => queryBuilder);
queryBuilder.limit.mockImplementation(() => queryBuilder);
queryBuilder.orderBy.mockImplementation(() => queryBuilder);

const deleteBuilder = {
	where: jest.fn(),
	execute: (...args: unknown[]) => deleteExecute(...args),
};

deleteBuilder.where.mockImplementation(() => deleteBuilder);

const updateBuilder = {
	set: jest.fn(),
	where: jest.fn(),
	execute: (...args: unknown[]) => updateExecute(...args),
};
updateBuilder.set.mockImplementation(() => updateBuilder);
updateBuilder.where.mockImplementation(() => updateBuilder);

const db = {
	query: { usersTable: { findFirst: (...args: unknown[]) => findUser(...args) } },
	select: jest.fn(() => queryBuilder),
	transaction: jest.fn(),
	execute: jest.fn(),
	insert: jest.fn(),
	delete: jest.fn(() => deleteBuilder),
	update: jest.fn(() => updateBuilder),
};

jest.mock("@/db/client", () => ({
	db,
}));

async function loadEntitlements() {
	jest.resetModules();
	return import("@/app/lib/entitlements");
}

type PartialUser = { id: string; plan: Plan };

describe("lib/entitlements", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		selectExecute.mockResolvedValue([]);
		updateExecute.mockResolvedValue({ rowCount: 1 });
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "1";
	});

	it("returns billing entitlements for pro users without querying grants", async () => {
		const { resolveUserEntitlements } = await loadEntitlements();
		const result = await resolveUserEntitlements({ id: "pro-user", plan: Plan.Pro } as PartialUser as any);
		expect(result).toEqual(
			expect.objectContaining({
				effectivePlan: "pro",
				runnerAccess: false,
				isBillingPro: true,
				source: "billing",
			}),
		);
		// Runner access can be owned by a direct entitlement or an agency allocation.
		expect(db.select).toHaveBeenCalledTimes(2);
	});

	it("keeps Runner independent from Pro for Free creators", async () => {
		selectExecute
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: "runner-grant" }]);
		const { resolveUserEntitlements } = await loadEntitlements();

		await expect(resolveUserEntitlements({ id: "free-runner-user", plan: Plan.Free } as PartialUser as any)).resolves.toEqual(expect.objectContaining({ effectivePlan: "free", proAccess: false, runnerAccess: true }));
	});

	it("returns free entitlements when hybrid grants are disabled", async () => {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "0";
		const { resolveUserEntitlements } = await loadEntitlements();
		const result = await resolveUserEntitlements({ id: "free-user", plan: Plan.Free } as PartialUser as any);
		expect(result).toEqual(
			expect.objectContaining({
				effectivePlan: "free",
				hasActiveGrant: false,
				source: "reverse_trial",
			}),
		);
		// Hybrid Pro grants are disabled, but an agency may still fund Runner access.
		expect(db.select).toHaveBeenCalledTimes(1);
	});

	it("resolves active reverse-trial grants for free users", async () => {
		selectExecute.mockResolvedValueOnce([
			{
				userId: "free-user",
				source: EntitlementGrantSource.ReverseTrial,
				startsAt: new Date("2026-03-01T00:00:00.000Z"),
				endsAt: new Date("2026-03-10T00:00:00.000Z"),
				entitlement: "pro_access",
			},
		]);
		const { resolveUserEntitlements } = await loadEntitlements();
		const result = await resolveUserEntitlements({ id: "free-user", plan: Plan.Free } as PartialUser as any);
		expect(result).toEqual(
			expect.objectContaining({
				effectivePlan: "pro",
				reverseTrialActive: true,
				hasActiveGrant: true,
				source: "reverse_trial",
			}),
		);
	});

	it("resolves entitlements in bulk for mixed users with global grants", async () => {
		selectExecute.mockResolvedValueOnce([]); // Runner entitlement for the billing-Pro user.
		selectExecute.mockResolvedValueOnce([]); // Agency Runner allocation for the billing-Pro user.
		selectExecute.mockResolvedValueOnce([
			{
				userId: null,
				source: EntitlementGrantSource.Support,
				startsAt: new Date("2026-03-01T00:00:00.000Z"),
				endsAt: new Date("2026-03-10T00:00:00.000Z"),
				entitlement: "pro_access",
			},
		]);
		selectExecute.mockResolvedValueOnce([]); // Runner entitlement for the globally granted user.
		selectExecute.mockResolvedValueOnce([]); // Agency Runner allocation for the globally granted user.
		const { resolveUserEntitlementsForUsers } = await loadEntitlements();
		const result = await resolveUserEntitlementsForUsers([
			{ id: "pro-user", plan: Plan.Pro },
			{ id: "free-user", plan: Plan.Free },
		] as Parameters<typeof resolveUserEntitlementsForUsers>[0]);

		expect(result.get("pro-user")).toEqual(
			expect.objectContaining({
				effectivePlan: "pro",
				source: "billing",
			}),
		);
		expect(result.get("free-user")).toEqual(
			expect.objectContaining({
				effectivePlan: "pro",
				source: "grant",
				hasActiveGrant: true,
			}),
		);
	});

	it("checks active grants with hybrid on/off behavior", async () => {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "0";
		const off = await loadEntitlements();
		await expect(off.hasActiveProGrant("user-1")).resolves.toBe(false);

		process.env.ENTITLEMENTS_HYBRID_ENABLED = "1";
		selectExecute.mockResolvedValueOnce([{ id: "grant-1" }]);
		const on = await loadEntitlements();
		await expect(on.hasActiveProGrant("user-1")).resolves.toBe(true);
	});

	it("creates pro access grant", async () => {
		const insertExecute = jest.fn().mockResolvedValue([{ id: "grant-1" }]);
		db.insert.mockImplementation(() => ({
			values: jest.fn(() => ({
				returning: jest.fn(() => ({
					execute: insertExecute,
				})),
			})),
		}));

		const { createProAccessGrant } = await loadEntitlements();
		const result = await createProAccessGrant({ source: EntitlementGrantSource.Support });
		expect(result).toEqual({ id: "grant-1" });
	});

	it("creates partner access grants with the partner source", async () => {
		db.transaction.mockImplementationOnce(async (operation) => operation(db));
		const insertExecute = jest.fn().mockResolvedValue([{ id: "partner-grant" }]);
		const values = jest.fn(() => ({
			returning: jest.fn(() => ({
				execute: insertExecute,
			})),
		}));
		db.insert.mockImplementation(() => ({
			values,
		}));

		const { createPartnerAccessGrant } = await loadEntitlements();
		const result = await createPartnerAccessGrant({ userId: "partner-user" });
		expect(result).toEqual({ id: "partner-grant" });
		expect(db.insert).toHaveBeenCalled();
		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "partner-user",
				source: EntitlementGrantSource.Partner,
			}),
		);
	});

	it("finds the active partner grant used by automatic badges", async () => {
		const startsAt = new Date("2026-03-01T00:00:00.000Z");
		const now = new Date("2026-03-02T00:00:00.000Z");
		selectExecute.mockResolvedValueOnce([{ id: "partner-grant", startsAt }]);
		const { getActivePartnerAccessGrant } = await loadEntitlements();
		await expect(getActivePartnerAccessGrant("partner-user", now)).resolves.toEqual({ id: "partner-grant", startsAt });
		expect(queryBuilder.where).toHaveBeenCalledTimes(1);
		const query = new PgDialect().sqlToQuery(queryBuilder.where.mock.calls[0][0]);
		expect(query.sql).toContain('"entitlement_grants"."revoked_at" is null');
		expect(query.params).toEqual(expect.arrayContaining(["partner-user", "pro_access", "partner", now.toISOString()]));
		expect(queryBuilder.orderBy).toHaveBeenCalledTimes(1);
		expect(queryBuilder.limit).toHaveBeenCalledWith(1);
	});

	it("returns no automatic Partner badge source when no active grant matches", async () => {
		const { getActivePartnerAccessGrant } = await loadEntitlements();
		await expect(getActivePartnerAccessGrant("former-partner")).resolves.toBeNull();
	});

	it("ensures reverse trial grant for free user", async () => {
		const txSelectExecute = jest.fn().mockResolvedValue([]); // no existing grant
		const txInsertExecute = jest.fn().mockResolvedValue(undefined);
		const txExecute = jest.fn().mockResolvedValue(undefined);
		const tx = {
			execute: txExecute,
			select: jest.fn(() => ({
				from: jest.fn(() => ({
					where: jest.fn(() => ({
						limit: jest.fn(() => ({
							execute: txSelectExecute,
						})),
					})),
				})),
			})),
			insert: jest.fn(() => ({
				values: jest.fn(() => ({
					execute: txInsertExecute,
				})),
			})),
		};
		db.transaction.mockImplementationOnce(async (callback: (tx: unknown) => unknown) => callback(tx));

		const { ensureReverseTrialGrantForUser } = await loadEntitlements();
		const result = await ensureReverseTrialGrantForUser({ id: "u1", plan: Plan.Free } as PartialUser);
		expect(result).toEqual({ created: true });
		expect(txInsertExecute).toHaveBeenCalled();
	});

	it("skips reverse trial if already exists", async () => {
		const txSelectExecute = jest.fn().mockResolvedValue([{ id: "existing" }]);
		const tx = {
			execute: jest.fn(),
			select: jest.fn(() => ({
				from: jest.fn(() => ({
					where: jest.fn(() => ({
						limit: jest.fn(() => ({
							execute: txSelectExecute,
						})),
					})),
				})),
			})),
		};
		db.transaction.mockImplementationOnce(async (callback: (tx: unknown) => unknown) => callback(tx));

		const { ensureReverseTrialGrantForUser } = await loadEntitlements();
		const result = await ensureReverseTrialGrantForUser({ id: "u1", plan: Plan.Free } as PartialUser);
		expect(result).toEqual({ created: false });
	});

	it("reconciles revoked users in batch", async () => {
		db.execute.mockResolvedValueOnce({ rows: [{ locked: true }] }); // lock acquired
		selectExecute.mockResolvedValueOnce([{ id: "u1", plan: Plan.Free }]); // candidate
		selectExecute.mockResolvedValueOnce([]); // no grants for u1

		const { reconcileRevokedUsersBatch } = await loadEntitlements();
		db.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => {
			const tx = {
				select: jest.fn(() => ({
					from: jest.fn(() => ({
						where: jest.fn(() => ({
							orderBy: jest.fn(() => ({
								execute: jest.fn().mockResolvedValue([]),
							})),
						})),
					})),
				})),
				delete: jest.fn(() => ({
					where: jest.fn(() => ({
						execute: jest.fn().mockResolvedValue({ rowCount: 1 }),
					})),
					execute: jest.fn().mockResolvedValue({ rowCount: 1 }),
				})),
				update: jest.fn(() => ({
					set: jest.fn(() => ({
						where: jest.fn(() => ({
							execute: jest.fn().mockResolvedValue({ rowCount: 1 }),
						})),
					})),
				})),
			};
			return callback(tx);
		});

		const result = await reconcileRevokedUsersBatch(1, 1);
		expect(result).toEqual({ candidates: 1, reconciled: 1 });
	});

	it("picks best grant among multiple options (via resolveUserEntitlements)", async () => {
		const { resolveUserEntitlements } = await loadEntitlements();
		const now = new Date();
		const g1 = { id: "g1", source: EntitlementGrantSource.Support, startsAt: new Date(now.getTime() - 1000), endsAt: new Date(now.getTime() + 1000), entitlement: "pro_access" };
		const g2 = { id: "g2", source: EntitlementGrantSource.Support, startsAt: new Date(now.getTime() - 500), endsAt: new Date(now.getTime() + 2000), entitlement: "pro_access" };

		selectExecute.mockResolvedValue([g1, g2]);
		const result = await resolveUserEntitlements({ id: "u1", plan: Plan.Free } as PartialUser);
		expect(result.trialEndsAt).toEqual(g2.endsAt);
	});

	it("returns the effective active grant for any entitlement", async () => {
		const { getActiveEntitlementGrant } = await loadEntitlements();
		const now = new Date();
		const shorter = { id: "short", source: EntitlementGrantSource.ReverseTrial, startsAt: new Date(now.getTime() - 1000), endsAt: new Date(now.getTime() + 1000), entitlement: "runner_access" };
		const longer = { id: "long", source: EntitlementGrantSource.Support, startsAt: new Date(now.getTime() - 500), endsAt: new Date(now.getTime() + 2000), entitlement: "runner_access" };
		selectExecute.mockResolvedValue([shorter, longer]);
		await expect(getActiveEntitlementGrant("u1", "runner_access" as any, now)).resolves.toBe(longer);
	});
	it("records a free-plan capability reconciliation without deleting data", async () => {
		const { recordFreeCapabilityReconciliation } = await loadEntitlements();
		const user = { id: "u1", plan: Plan.Free };
		const entitlements = { effectivePlan: "free" } as Parameters<typeof recordFreeCapabilityReconciliation>[1];
		selectExecute
			.mockResolvedValueOnce([{ id: "overlay-1" }, { id: "overlay-2" }])
			.mockResolvedValueOnce([{ id: "playlist-1" }, { id: "playlist-2" }, { id: "playlist-3" }])
			.mockResolvedValueOnce([{ id: "gallery-1" }]);
		await expect(recordFreeCapabilityReconciliation(user as PartialUser as any, entitlements)).resolves.toEqual({
			overlays: { total: 2, active: 1, restricted: 1 },
			playlists: { total: 3, active: 1, restricted: 2 },
			galleries: { total: 1, active: 1, restricted: 0 },
		});
		expect(db.select).toHaveBeenCalledTimes(3);
		expect(db.update).toHaveBeenCalledTimes(1);
		expect(db.transaction).not.toHaveBeenCalled();
	});

	it("hasActiveProGrant returns false when hybrid disabled", async () => {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "0";
		const { hasActiveProGrant } = await loadEntitlements();
		const result = await hasActiveProGrant("u1");
		expect(result).toBe(false);
	});

	it("skips reverse trial for non-free plan", async () => {
		const { ensureReverseTrialGrantForUser } = await loadEntitlements();
		const result = await ensureReverseTrialGrantForUser({ id: "u1", plan: Plan.Pro } as PartialUser);
		expect(result).toEqual({ created: false });
	});

	it("skips batch reconciliation if lock not acquired", async () => {
		db.execute.mockResolvedValueOnce({ rows: [{ locked: false }] });
		const { reconcileRevokedUsersBatch } = await loadEntitlements();
		const result = await reconcileRevokedUsersBatch();
		expect(result).toEqual({ candidates: 0, reconciled: 0 });
	});
	it("defaults owner grants on when the rollout setting is absent", async () => {
		delete process.env.ENTITLEMENTS_HYBRID_ENABLED;
		selectExecute.mockResolvedValue([{ id: "active-owner-grant" }]);
		const { hasActiveEntitlement } = await loadEntitlements();
		await expect(hasActiveEntitlement("owner", Entitlement.ProAccess)).resolves.toBe(true);
	});
	it("disabled direct grants do not read the database", async () => {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "0";
		const { hasActiveEntitlement } = await loadEntitlements();
		await expect(hasActiveEntitlement("owner", Entitlement.ProAccess)).resolves.toBe(false);
		expect(db.select).not.toHaveBeenCalled();
	});
	it.each(["hasActiveAgencyAllocation", "hasActiveAgencyRunnerAllocation"] as const)("%s recognizes the current owner allocation", async (name) => {
		const policy = await loadEntitlements();
		selectExecute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "current-allocation" }]);
		await expect(policy[name]("owner")).resolves.toBe(false);
		await expect(policy[name]("owner")).resolves.toBe(true);
	});
	it("Runner access falls back to its own allocation without granting Pro", async () => {
		selectExecute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "runner-allocation" }]);
		const { hasActiveRunnerAccess } = await loadEntitlements();
		await expect(hasActiveRunnerAccess("owner")).resolves.toBe(true);
		expect(db.select).toHaveBeenCalledTimes(2);
	});
	it.each([
		[null, null, "later"],
		[null, "finite", "earlier"],
		["finite", null, "later"],
		["finite", "finite", "later"],
	] as const)("chooses stable effective access for %s and %s grant expiries", async (firstEnd, secondEnd, winner) => {
		const now = Date.now();
		const expiry = new Date(now + 86400000);
		const earlier = { id: "earlier", source: EntitlementGrantSource.Support, startsAt: new Date(now - 2000), endsAt: firstEnd ? expiry : null };
		const later = { id: "later", source: EntitlementGrantSource.Partner, startsAt: new Date(now - 1000), endsAt: secondEnd ? expiry : null };
		const { getActiveEntitlementGrant } = await loadEntitlements();
		selectExecute.mockResolvedValueOnce([earlier, later]).mockResolvedValueOnce([later, earlier]);
		for (let order = 0; order < 2; order++) await expect(getActiveEntitlementGrant("owner", Entitlement.ProAccess)).resolves.toMatchObject({ id: winner });
	});
	it("empty bulk ownership input performs no policy reads", async () => {
		const { resolveUserEntitlementsForUsers } = await loadEntitlements();
		await expect(resolveUserEntitlementsForUsers([])).resolves.toEqual(new Map());
		expect(db.select).not.toHaveBeenCalled();
	});
	it("bulk resolution preserves billing access and runner independence when rollout is off", async () => {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "0";
		const { resolveUserEntitlementsForUsers } = await loadEntitlements();
		const results = await resolveUserEntitlementsForUsers([
			{ id: "free-owner", plan: Plan.Free },
			{ id: "pro-owner", plan: Plan.Pro },
		]);
		expect(results.get("free-owner")).toMatchObject({ effectivePlan: "free", proAccess: false, runnerAccess: false });
		expect(results.get("pro-owner")).toMatchObject({ effectivePlan: "pro", isBillingPro: true, runnerAccess: false });
	});
	it("bulk resolution recognizes Pro-only owners without reading grant candidates", async () => {
		const { resolveUserEntitlementsForUsers } = await loadEntitlements();
		const results = await resolveUserEntitlementsForUsers([{ id: "pro-owner", plan: Plan.Pro }]);
		expect(results.get("pro-owner")).toMatchObject({ effectivePlan: "pro", isBillingPro: true });
		expect(db.select).toHaveBeenCalledTimes(2);
	});
	it("suspends owned runner runtime while retaining configuration", async () => {
		db.transaction.mockImplementation(async (callback) => callback(db));
		selectExecute.mockResolvedValueOnce([{ id: "runner-one" }, { id: "runner-two" }]).mockResolvedValueOnce([{ id: "session-one" }]);
		const { suspendRunnersForOwner } = await loadEntitlements();
		await expect(suspendRunnersForOwner("owner")).resolves.toEqual({ runners: 2, sessions: 1 });
		expect(updateBuilder.set).toHaveBeenCalledWith({ status: RunnerStatus.Offline });
		expect(updateBuilder.set).toHaveBeenCalledWith(expect.objectContaining({ desiredState: StreamState.Stopped }));
		expect(updateBuilder.set.mock.calls.at(-1)?.[0]).not.toHaveProperty("actualState");
		expect(db.delete).not.toHaveBeenCalled();
	});
	it("empty owned runner runtime needs no destructive writes", async () => {
		db.transaction.mockImplementation(async (callback) => callback(db));
		const { suspendRunnersForOwner } = await loadEntitlements();
		await expect(suspendRunnersForOwner("owner")).resolves.toEqual({ runners: 0, sessions: 0 });
		expect(db.update).not.toHaveBeenCalled();
		expect(db.delete).not.toHaveBeenCalled();
	});
	it("disabled reconciliation does not load or mutate an owner", async () => {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "0";
		const { reconcileUserEntitlements, reconcileRevokedUsersBatch } = await loadEntitlements();
		await expect(reconcileUserEntitlements("owner")).resolves.toEqual({ runners: 0, sessions: 0, resources: null });
		await expect(reconcileRevokedUsersBatch()).resolves.toEqual({ candidates: 0, reconciled: 0 });
		expect(findUser).not.toHaveBeenCalled();
	});
	it("missing reconciliation owner performs no updates", async () => {
		findUser.mockResolvedValueOnce(undefined);
		const { reconcileUserEntitlements } = await loadEntitlements();
		await expect(reconcileUserEntitlements("owner")).resolves.toEqual({ runners: 0, sessions: 0, resources: null });
		expect(db.update).not.toHaveBeenCalled();
	});
	it("billing Pro reconciliation with runner access preserves runtime and stamps the owner", async () => {
		findUser.mockResolvedValueOnce({ id: "owner", plan: Plan.Pro });
		selectExecute.mockResolvedValueOnce([{ id: "runner-grant" }]);
		const { reconcileUserEntitlements } = await loadEntitlements();
		await expect(reconcileUserEntitlements("owner")).resolves.toEqual({ runners: 0, sessions: 0, resources: null });
		expect(db.transaction).not.toHaveBeenCalled();
		expect(updateBuilder.set).toHaveBeenCalledWith(expect.objectContaining({ lastEntitlementReconciledAt: expect.any(Date) }));
		expect(db.delete).not.toHaveBeenCalled();
	});
	it("owner agency Pro access remains independent of billing and Runner", async () => {
		selectExecute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "pro-allocation" }]);
		const { resolveUserEntitlements } = await loadEntitlements();
		await expect(resolveUserEntitlements({ id: "owner", plan: Plan.Free })).resolves.toMatchObject({ effectivePlan: "pro", source: "agency", isBillingPro: false, runnerAccess: false, hasActiveGrant: false });
	});
	it("bulk agency allocations elevate only their own creator", async () => {
		selectExecute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ creatorId: "agency-owner" }]);
		const { resolveUserEntitlementsForUsers } = await loadEntitlements();
		const results = await resolveUserEntitlementsForUsers([
			{ id: "agency-owner", plan: Plan.Free },
			{ id: "other-owner", plan: Plan.Free },
		]);
		expect(results.get("agency-owner")).toMatchObject({ effectivePlan: "pro", source: "agency", isBillingPro: false, runnerAccess: false });
		expect(results.get("other-owner")).toMatchObject({ effectivePlan: "free", proAccess: false });
	});
	it("disabled grant selection returns no effective grant without a query", async () => {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "0";
		const { getActiveEntitlementGrant } = await loadEntitlements();
		await expect(getActiveEntitlementGrant("owner", Entitlement.ProAccess)).resolves.toBeNull();
		expect(db.select).not.toHaveBeenCalled();
	});
	it.each([Plan.Free, Plan.Pro])("effective Pro access prevents free reconciliation for %s billing", async (plan) => {
		const { recordFreeCapabilityReconciliation } = await loadEntitlements();
		await expect(recordFreeCapabilityReconciliation({ id: "owner", plan }, { effectivePlan: "pro" } as Parameters<typeof recordFreeCapabilityReconciliation>[1])).resolves.toBeNull();
		expect(db.select).not.toHaveBeenCalled();
		expect(db.update).not.toHaveBeenCalled();
	});
	it("disabled capability reconciliation preserves all resources", async () => {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "0";
		const { recordFreeCapabilityReconciliation } = await loadEntitlements();
		await expect(recordFreeCapabilityReconciliation({ id: "owner", plan: Plan.Free }, { effectivePlan: "free" } as Parameters<typeof recordFreeCapabilityReconciliation>[1])).resolves.toBeNull();
		expect(db.select).not.toHaveBeenCalled();
		expect(db.update).not.toHaveBeenCalled();
	});
});
