/** @jest-environment node */
import { Plan, EntitlementGrantSource } from "@types";

const selectExecute = jest.fn();

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

const db = {
	select: jest.fn(() => queryBuilder),
	transaction: jest.fn(),
	execute: jest.fn(),
	insert: jest.fn(),
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
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "1";
	});

	it("returns billing entitlements for pro users without querying grants", async () => {
		const { resolveUserEntitlements } = await loadEntitlements();
		const result = await resolveUserEntitlements({ id: "pro-user", plan: Plan.Pro } as PartialUser as any);
		expect(result).toEqual(
			expect.objectContaining({
				effectivePlan: "pro",
				isBillingPro: true,
				source: "billing",
			}),
		);
		expect(db.select).not.toHaveBeenCalled();
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
		expect(db.select).not.toHaveBeenCalled();
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
		selectExecute.mockResolvedValueOnce([
			{
				userId: null,
				source: EntitlementGrantSource.Support,
				startsAt: new Date("2026-03-01T00:00:00.000Z"),
				endsAt: new Date("2026-03-10T00:00:00.000Z"),
				entitlement: "pro_access",
			},
		]);
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

	it("reconciles free constraints with multiple overlays and playlists", async () => {
		const { reconcileFreeConstraintsIfNeeded } = await loadEntitlements();
		const user = { id: "u1", plan: Plan.Free };
		const entitlements = { effectivePlan: "free" } as Parameters<typeof reconcileFreeConstraintsIfNeeded>[1];

		const makeChain = (data: unknown) => ({
			from: jest.fn(() => ({
				where: jest.fn(() => ({
					orderBy: jest.fn(() => ({
						execute: jest.fn().mockResolvedValue(data),
					})),
				})),
			})),
		});

		const tx = {
			select: jest
				.fn()
				.mockReturnValueOnce(
					makeChain([
						{ id: "o1", createdAt: new Date(1) },
						{ id: "o2", createdAt: new Date(2) },
					]),
				) // overlays select
				.mockReturnValueOnce(
					makeChain([
						{ id: "p1", createdAt: new Date(1) },
						{ id: "p2", createdAt: new Date(2) },
					]),
				) // playlists select
				.mockReturnValueOnce(makeChain(new Array(60).fill({ clipId: "c" }))), // clips select
			delete: jest.fn(() => ({ where: jest.fn(() => ({ execute: jest.fn().mockResolvedValue({ rowCount: 1 }) })), execute: jest.fn() })),
			update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => ({ execute: jest.fn().mockResolvedValue({ rowCount: 1 }) })) })) })),
			execute: jest.fn(),
		};

		db.transaction.mockImplementationOnce(async (callback: (tx: unknown) => unknown) => callback(tx));

		await reconcileFreeConstraintsIfNeeded(user as PartialUser as any, entitlements);
		expect(tx.delete).toHaveBeenCalledTimes(4);
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
});
