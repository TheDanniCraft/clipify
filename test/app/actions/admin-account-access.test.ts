/** @jest-environment node */
export {};
const admin = jest.fn();
const deliver = jest.fn();
const transaction = jest.fn();
jest.mock("@actions/auth", () => ({ validateAdminAuth: (...args: unknown[]) => admin(...args) }));
jest.mock("@/server/notifications/account-access-events", () => ({ queueAccountAccessEmail: (...args: unknown[]) => deliver(...args) }));
jest.mock("@/db/client", () => ({ db: { transaction: (...args: unknown[]) => transaction(...args) } }));
const read = jest.fn();
const update = jest.fn();
const audit = jest.fn();
const tx = {
	select: () => ({ from: () => ({ where: () => ({ for: read }) }) }),
	update: () => ({
		set: (value: unknown) => {
			update(value);
			return { where: async () => {} };
		},
	}),
	insert: () => ({ values: audit }),
};
beforeEach(() => {
	jest.clearAllMocks();
	admin.mockResolvedValue({ id: "admin" });
	deliver.mockResolvedValue(undefined);
	read.mockResolvedValue([{ id: "user", username: "Alex", email: "alex@example.com", disabled: false }]);
	transaction.mockImplementation((callback: (value: typeof tx) => unknown) => callback(tx));
});
it("rejects non-admins before touching the database or sending email", async () => {
	admin.mockResolvedValue(false);
	const { setAdminAccountAccess } = await import("@/app/actions/admin-account-access");
	await expect(setAdminAccountAccess({ userId: "user", disabled: true, reason: "Reason" })).rejects.toThrow("ADMIN_REQUIRED");
	expect(transaction).not.toHaveBeenCalled();
	expect(deliver).not.toHaveBeenCalled();
});
it("rejects self disablement and missing reasons", async () => {
	const { setAdminAccountAccess } = await import("@/app/actions/admin-account-access");
	await expect(setAdminAccountAccess({ userId: "admin", disabled: true, reason: "Reason" })).rejects.toThrow("CANNOT_DISABLE_OWN_ACCOUNT");
	await expect(setAdminAccountAccess({ userId: "user", disabled: true, reason: " " })).rejects.toThrow("DISABLE_REASON_REQUIRED");
	expect(transaction).not.toHaveBeenCalled();
});
it("disables access, pauses overlays, audits the change and atomically queues the stated reason", async () => {
	const { setAdminAccountAccess } = await import("@/app/actions/admin-account-access");
	await expect(setAdminAccountAccess({ userId: "user", disabled: true, reason: " Policy violation " })).resolves.toEqual({ changed: true, notificationQueued: true });
	expect(update).toHaveBeenCalledWith(expect.objectContaining({ disabled: true, disableType: "manual", disabledReason: "Policy violation" }));
	expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "paused" }));
	expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "account.disable", metadata: { administratorId: "admin", disabled: true } }));
	expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ email: "alex@example.com", reason: "Policy violation", disabled: true }), tx);
});
it("enables access without resuming overlays", async () => {
	read.mockResolvedValue([{ id: "user", username: "Alex", email: "alex@example.com", disabled: true }]);
	const { setAdminAccountAccess } = await import("@/app/actions/admin-account-access");
	await setAdminAccountAccess({ userId: "user", disabled: false });
	expect(update).toHaveBeenCalledTimes(1);
	expect(update).toHaveBeenCalledWith(expect.objectContaining({ disabled: false, disabledReason: null }));
	expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ disabled: false }), tx);
});
it("does not duplicate email for unchanged access", async () => {
	const { setAdminAccountAccess } = await import("@/app/actions/admin-account-access");
	await expect(setAdminAccountAccess({ userId: "user", disabled: false })).resolves.toEqual({ changed: false, notificationQueued: false });
	expect(update).not.toHaveBeenCalled();
	expect(deliver).not.toHaveBeenCalled();
});
it("fails the transaction when the durable notice cannot be queued", async () => {
	deliver.mockRejectedValue(new Error("Provider down"));
	const { setAdminAccountAccess } = await import("@/app/actions/admin-account-access");
	await expect(setAdminAccountAccess({ userId: "user", disabled: true, reason: "Reason" })).rejects.toThrow("Provider down");
	expect(update).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }));
});
