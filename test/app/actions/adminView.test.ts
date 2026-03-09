/** @jest-environment node */
export {};

const validateAdminAuth = jest.fn();
const startAdminView = jest.fn();
const clearAdminView = jest.fn();
const dbSelect = jest.fn();

jest.mock("@actions/auth", () => ({
	validateAdminAuth: (...args: unknown[]) => validateAdminAuth(...args),
	startAdminView: (...args: unknown[]) => startAdminView(...args),
	clearAdminView: (...args: unknown[]) => clearAdminView(...args),
}));

jest.mock("@/db/client", () => ({
	db: {
		select: (...args: unknown[]) => dbSelect(...args),
	},
}));

function mockSelectRows(rows: unknown[]) {
	dbSelect.mockReturnValue({
		from: () => ({
			where: () => ({
				orderBy: () => ({
					limit: () => ({
						execute: async () => rows,
					}),
				}),
			}),
			orderBy: () => ({
				limit: () => ({
					execute: async () => rows,
				}),
			}),
		}),
	});
}

describe("actions/adminView", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns empty list when caller is not admin", async () => {
		validateAdminAuth.mockResolvedValue(false);
		const { getAdminViewCandidates } = await import("@/app/actions/adminView");
		await expect(getAdminViewCandidates("alice")).resolves.toEqual([]);
		expect(dbSelect).not.toHaveBeenCalled();
	});

	it("returns candidate users for admin queries", async () => {
		validateAdminAuth.mockResolvedValue({ id: "admin-1" });
		mockSelectRows([{ id: "1", username: "alice", role: "user", plan: "free" }]);

		const { getAdminViewCandidates } = await import("@/app/actions/adminView");
		await expect(getAdminViewCandidates("ali")).resolves.toEqual([{ id: "1", username: "alice", role: "user", plan: "free" }]);
	});

	it("proxies switch and stop actions", async () => {
		startAdminView.mockResolvedValue({ ok: true });
		clearAdminView.mockResolvedValue(undefined);
		const { switchAdminView, stopAdminView } = await import("@/app/actions/adminView");

		await expect(switchAdminView("user-2")).resolves.toEqual({ ok: true });
		await stopAdminView();

		expect(startAdminView).toHaveBeenCalledWith("user-2");
		expect(clearAdminView).toHaveBeenCalledTimes(1);
	});
});
