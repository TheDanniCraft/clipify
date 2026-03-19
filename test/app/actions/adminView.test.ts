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

function mockSelectRows(rows: any[]) {
	const chain = {
		from: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		orderBy: jest.fn().mockReturnThis(),
		limit: jest.fn().mockReturnThis(),
		offset: jest.fn().mockReturnThis(),
		execute: jest.fn().mockResolvedValue(rows),
	};
	dbSelect.mockReturnValue(chain);
	return chain;
}

describe("actions/adminView", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.resetModules();
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

	it("returns candidate users for empty admin queries", async () => {
		validateAdminAuth.mockResolvedValue({ id: "admin-1" });
		mockSelectRows([{ id: "1", username: "alice", role: "user", plan: "free" }]);

		const { getAdminViewCandidates } = await import("@/app/actions/adminView");
		await expect(getAdminViewCandidates(" ")).resolves.toEqual([{ id: "1", username: "alice", role: "user", plan: "free" }]);
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

	describe("getAdminExplorerPage", () => {
		it("returns empty state when caller is not admin", async () => {
			validateAdminAuth.mockResolvedValue(false);
			const { getAdminExplorerPage } = await import("@/app/actions/adminView");
			const result = await getAdminExplorerPage("");
			expect(result).toEqual({
				users: [],
				page: 1,
				totalPages: 1,
				totalRows: 0,
			});
		});

		it("returns paginated users without query", async () => {
			validateAdminAuth.mockResolvedValue({ id: "admin-1" });
			const { getAdminExplorerPage } = await import("@/app/actions/adminView");

			// Mock count
			dbSelect.mockReturnValueOnce({
				from: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue([{ count: 50 }]),
			});

			// Mock data
			mockSelectRows([{ id: "1", username: "alice" }]);

			const result = await getAdminExplorerPage("", 2, 20);
			expect(result.totalRows).toBe(50);
			expect(result.totalPages).toBe(3);
			expect(result.page).toBe(2);
			expect(result.users).toHaveLength(1);
		});

		it("returns paginated users with query", async () => {
			validateAdminAuth.mockResolvedValue({ id: "admin-1" });
			const { getAdminExplorerPage } = await import("@/app/actions/adminView");

			// Mock count
			dbSelect.mockReturnValueOnce({
				from: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue([{ count: 5 }]),
			});

			// Mock data
			mockSelectRows([{ id: "1", username: "alice" }]);

			const result = await getAdminExplorerPage("ali", 1, 20);
			expect(result.totalRows).toBe(5);
			expect(result.totalPages).toBe(1);
			expect(result.users).toHaveLength(1);
		});

		it("handles edge cases for pagination (toPositiveInt coverage)", async () => {
			validateAdminAuth.mockResolvedValue({ id: "admin-1" });
			const { getAdminExplorerPage } = await import("@/app/actions/adminView");

			// Mock count
			dbSelect.mockReturnValueOnce({
				from: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue([{ count: 10 }]),
			});

			// Mock data
			mockSelectRows([]);

			// requestedPage = -1 should fallback to 1, pageSize = 0 should fallback to 25
			const result = await getAdminExplorerPage("", -1, 0);
			expect(result.page).toBe(1);
		});

		it("handles requested page beyond total pages", async () => {
			validateAdminAuth.mockResolvedValue({ id: "admin-1" });
			const { getAdminExplorerPage } = await import("@/app/actions/adminView");

			// Mock count
			dbSelect.mockReturnValueOnce({
				from: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue([{ count: 10 }]),
			});

			// Mock data
			mockSelectRows([]);

			const result = await getAdminExplorerPage("", 100, 5);
			expect(result.page).toBe(2); // totalRows=10, pageSize=5 => totalPages=2
		});
	});
});
