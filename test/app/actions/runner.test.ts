/** @jest-environment node */

import { StreamMode } from "@/app/lib/types";

const mockValidateAuth = jest.fn();
const mockHasActiveEntitlement = jest.fn();
const mockRevalidatePath = jest.fn();
const mockEditorFindFirst = jest.fn();
const mockOwnerFindFirst = jest.fn();
const mockRunnerFindFirst = jest.fn();
const mockOverlayFindFirst = jest.fn();
const mockUpdateReturning = jest.fn();

const mockUpdateBuilder = {
	set: jest.fn(),
	where: jest.fn(),
	returning: jest.fn(),
};

mockUpdateBuilder.set.mockReturnValue(mockUpdateBuilder);
mockUpdateBuilder.where.mockReturnValue(mockUpdateBuilder);
mockUpdateBuilder.returning.mockImplementation((...args: unknown[]) => mockUpdateReturning(...args));

const mockDb = {
	query: {
		editorsTable: { findFirst: (...args: unknown[]) => mockEditorFindFirst(...args) },
		usersTable: { findFirst: (...args: unknown[]) => mockOwnerFindFirst(...args) },
		runnersTable: { findFirst: (...args: unknown[]) => mockRunnerFindFirst(...args) },
		overlaysTable: { findFirst: (...args: unknown[]) => mockOverlayFindFirst(...args) },
	},
	update: jest.fn(() => mockUpdateBuilder),
};

jest.mock("@/db/client", () => ({
	db: mockDb,
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => mockValidateAuth(...args),
}));

jest.mock("@lib/entitlements", () => ({
	hasActiveEntitlement: (...args: unknown[]) => mockHasActiveEntitlement(...args),
}));

jest.mock("@lib/runnerArtifacts", () => ({
	getRunnerVersionInfo: jest.fn(),
}));

jest.mock("next/cache", () => ({
	revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

describe("actions/runner", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockValidateAuth.mockResolvedValue({ id: "owner-1" });
		mockOwnerFindFirst.mockResolvedValue({ id: "owner-1" });
		mockHasActiveEntitlement.mockResolvedValue(true);
		mockRunnerFindFirst.mockResolvedValue({ id: "runner-1", ownerId: "owner-1" });
		mockOverlayFindFirst.mockResolvedValue({ id: "overlay-1", ownerId: "owner-1" });
	});

	it("updates an existing stream session for the authorized owner", async () => {
		mockUpdateReturning.mockResolvedValue([{ id: "session-1" }]);
		const { upsertStreamSession } = await import("@/app/actions/runner");

		const result = await upsertStreamSession({
			id: "session-1",
			ownerId: "owner-1",
			runnerId: "runner-1",
			overlayId: "overlay-1",
			mode: StreamMode.AlwaysOn,
			streamKey: "",
			rtmpUrl: "rtmp://custom.example/live",
		});

		expect(result).toEqual({ success: true });
		expect(mockUpdateReturning).toHaveBeenCalledWith({ id: expect.anything() });
		expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/runners");
	});

	it("does not update a stream session when the id is not owned by the authorized owner", async () => {
		mockUpdateReturning.mockResolvedValue([]);
		const { upsertStreamSession } = await import("@/app/actions/runner");

		const result = await upsertStreamSession({
			id: "session-owned-by-someone-else",
			ownerId: "owner-1",
			runnerId: "runner-1",
			overlayId: "overlay-1",
			mode: StreamMode.AlwaysOn,
			streamKey: "",
			rtmpUrl: "rtmp://custom.example/live",
		});

		expect(result).toEqual({ success: false, error: "Stream session not found", code: "NOT_FOUND" });
		expect(mockRevalidatePath).not.toHaveBeenCalled();
	});
});
