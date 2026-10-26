/** @jest-environment node */
export {};

const validateAuth = jest.fn();
const authorizeCreatorOperation = jest.fn();
const listAuthorizedCreatorOperations = jest.fn();
const findEnrollment = jest.fn();
const findRunner = jest.fn();
const update = jest.fn();

jest.mock("@actions/auth", () => ({ validateAuth: (...args: unknown[]) => validateAuth(...args) }));
jest.mock("@/auth/authorize-operation", () => ({
	authorizeCreatorOperation: (...args: unknown[]) => authorizeCreatorOperation(...args),
	listAuthorizedCreatorOperations: (...args: unknown[]) => listAuthorizedCreatorOperations(...args),
}));
jest.mock("@/db/client", () => ({
	db: {
		query: { runnerEnrollmentsTable: { findFirst: (...args: unknown[]) => findEnrollment(...args) }, runnersTable: { findFirst: (...args: unknown[]) => findRunner(...args) } },
		update: (...args: unknown[]) => update(...args),
	},
}));

describe("runner enrollment credentials", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		validateAuth.mockResolvedValue({ id: "editor" });
		findEnrollment.mockResolvedValue({ id: "enrollment", runnerId: "runner", userCode: "ABCD-1234", expiresAt: new Date(Date.now() + 60_000) });
		findRunner.mockResolvedValue({ id: "runner", ownerId: "creator", name: "Runner" });
		authorizeCreatorOperation.mockImplementation(async ({ permission }) => ({ allowed: permission === "runner:control" }));
		const where = jest.fn().mockResolvedValue(undefined);
		const set = jest.fn().mockReturnValue({ where });
		update.mockReturnValue({ set });
	});

	it("rejects a controller who cannot read runner credentials", async () => {
		const { submitRunnerSelection } = await import("@/app/runner/enroll/actions");
		const form = new FormData();
		form.set("code", "ABCD-1234");
		form.set("runnerId", "runner");

		await expect(submitRunnerSelection({ status: "idle" }, form)).resolves.toEqual({ status: "unauthorized" });
		expect(authorizeCreatorOperation).toHaveBeenCalledWith(expect.objectContaining({ permission: "runner-credential:read" }));
		expect(update).not.toHaveBeenCalled();
	});

	it("approves when both control and credential access are granted", async () => {
		authorizeCreatorOperation.mockResolvedValue({ allowed: true });
		const { submitRunnerSelection } = await import("@/app/runner/enroll/actions");
		const form = new FormData();
		form.set("code", "ABCD-1234");
		form.set("runnerId", "runner");

		await expect(submitRunnerSelection({ status: "idle" }, form)).resolves.toEqual({ status: "approved", runnerId: "runner" });
		expect(update).toHaveBeenCalledTimes(2);
	});
});
