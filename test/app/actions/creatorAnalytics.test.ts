/** @jest-environment node */
export {};

const validateAuth = jest.fn();
const resolveUserEntitlements = jest.fn();
const getFeatureAccess = jest.fn();
const selectRows: unknown[][] = [];
const dbSelect = jest.fn(() => {
	const chain: Record<string, jest.Mock> = {};
	for (const method of ["from", "where", "limit"]) chain[method] = jest.fn(() => chain);
	chain.execute = jest.fn().mockImplementation(async () => selectRows.shift() ?? []);
	return chain;
});
const dbInsert = jest.fn(() => {
	const chain: Record<string, jest.Mock> = {};
	for (const method of ["values", "onConflictDoUpdate"]) chain[method] = jest.fn(() => chain);
	chain.execute = jest.fn().mockResolvedValue(undefined);
	return chain;
});

jest.mock("@actions/auth", () => ({ validateAuth: (...args: unknown[]) => validateAuth(...args) }));
jest.mock("@/db/client", () => ({ db: { select: () => dbSelect(), insert: () => dbInsert(), update: jest.fn() } }));
jest.mock("@lib/entitlements", () => ({ resolveUserEntitlements: (...args: unknown[]) => resolveUserEntitlements(...args) }));
jest.mock("@lib/featureAccess", () => ({ getFeatureAccess: (...args: unknown[]) => getFeatureAccess(...args) }));

describe("creator analytics exports", () => {
	const previousApiKey = process.env.PLAUSIBLE_API_KEY;

	beforeEach(() => {
		jest.clearAllMocks();
		selectRows.length = 0;
		process.env.PLAUSIBLE_API_KEY = "test-key";
		validateAuth.mockResolvedValue({ id: "owner", username: "Alice" });
		resolveUserEntitlements.mockResolvedValue({ effectivePlan: "pro" });
		getFeatureAccess.mockReturnValue({ allowed: true });
		global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [], meta: { time_labels: [] } }) });
	});

	afterAll(() => {
		process.env.PLAUSIBLE_API_KEY = previousApiKey;
	});

	it("creates every selected CSV from one analytics refresh", async () => {
		selectRows.push([{ id: "owner", username: "Alice", plan: "pro" }], []);
		const { exportCreatorAnalyticsBundle } = await import("@actions/creatorAnalytics");
		const result = await exportCreatorAnalyticsBundle({ ownerId: "owner", range: { start: "2026-08-01", end: "2026-08-02" }, datasets: ["daily", "locations", "daily"] });
		expect(result).toHaveLength(2);
		expect(result?.map((entry) => entry.filename)).toEqual(["clipify-Alice-daily-2026-08-01_2026-08-02.csv", "clipify-Alice-locations-2026-08-01_2026-08-02.csv"]);
		expect(global.fetch).toHaveBeenCalledTimes(7);
		expect(dbInsert).toHaveBeenCalledTimes(1);
	});

	it("rejects empty and unsupported dataset selections before loading an owner", async () => {
		const { exportCreatorAnalyticsBundle } = await import("@actions/creatorAnalytics");
		await expect(exportCreatorAnalyticsBundle({ ownerId: "owner", datasets: [] })).resolves.toBeNull();
		await expect(exportCreatorAnalyticsBundle({ ownerId: "owner", datasets: ["unknown" as never] })).resolves.toBeNull();
		expect(dbSelect).not.toHaveBeenCalled();
		expect(global.fetch).not.toHaveBeenCalled();
	});
});
