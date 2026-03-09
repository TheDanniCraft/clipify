/** @jest-environment node */
export {};

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
};

jest.mock("@/db/client", () => ({
	db,
}));

async function loadEntitlements() {
	jest.resetModules();
	return import("@/app/lib/entitlements");
}

describe("lib/entitlements", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "1";
	});

	it("returns billing entitlements for pro users without querying grants", async () => {
		const { resolveUserEntitlements } = await loadEntitlements();
		const result = await resolveUserEntitlements({ id: "pro-user", plan: "pro" } as never);
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
		const result = await resolveUserEntitlements({ id: "free-user", plan: "free" } as never);
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
				source: "reverse_trial",
				startsAt: new Date("2026-03-01T00:00:00.000Z"),
				endsAt: new Date("2026-03-10T00:00:00.000Z"),
			},
		]);
		const { resolveUserEntitlements } = await loadEntitlements();
		const result = await resolveUserEntitlements({ id: "free-user", plan: "free" } as never);
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
				source: "system",
				startsAt: new Date("2026-03-01T00:00:00.000Z"),
				endsAt: new Date("2026-03-10T00:00:00.000Z"),
			},
		]);
		const { resolveUserEntitlementsForUsers } = await loadEntitlements();
		const result = await resolveUserEntitlementsForUsers(
			[
				{ id: "pro-user", plan: "pro" },
				{ id: "free-user", plan: "free" },
			] as never,
		);

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
});
