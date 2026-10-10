/** @jest-environment node */
const admin = jest.fn(),
	read = jest.fn(),
	writes = jest.fn(),
	queue = jest.fn(),
	badgeQueue = jest.fn();
const revokeQueue = jest.fn();
const transaction = jest.fn();
jest.mock("@actions/auth", () => ({ validateAdminAuth: (...args: unknown[]) => admin(...args) }));
jest.mock("@/db/client", () => ({ db: { transaction: (...args: unknown[]) => transaction(...args) } }));
jest.mock("@/server/notifications/benefit-events", () => ({ queueGrantEmails: (...args: unknown[]) => queue(...args), queueGrantRevocation: (...args: unknown[]) => revokeQueue(...args) }));
jest.mock("@/server/notifications/badge-events", () => ({ queueBadgeEmail: (...args: unknown[]) => badgeQueue(...args) }));
import { grantAdminAwards, revokeAdminAward } from "@/app/actions/admin-benefits";
const input = { userIds: ["alex"], operationId: "b00d83be-88f3-4f54-b572-7123f2fcda55", kind: "pro_access" as const, days: 7, reason: "Thanks for your help" };
const tx = {
	select: () => ({ from: () => ({ where: () => ({ for: read }) }) }),
	insert: () => ({
		values: (value: unknown) => {
			writes(value);
			return { onConflictDoNothing: () => ({ returning: async () => (queue.mock.calls.length ? [] : [{ id: "grant", userId: "alex" }]) }) };
		},
	}),
};
beforeEach(() => {
	jest.clearAllMocks();
	admin.mockResolvedValue({ id: "admin" });
	read.mockResolvedValue([{ id: "alex" }]);
	transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
});
test("only administrators can award benefits", async () => {
	admin.mockResolvedValue(null);
	await expect(grantAdminAwards(input)).rejects.toThrow("ADMIN_REQUIRED");
	expect(transaction).not.toHaveBeenCalled();
});
test("rejects duplicate recipients, invalid durations and automatic Partner badges before writing", async () => {
	await expect(grantAdminAwards({ ...input, userIds: ["alex", "alex"] })).rejects.toThrow("INVALID_RECIPIENTS");
	await expect(grantAdminAwards({ ...input, days: 0 })).rejects.toThrow("INVALID_DURATION");
	await expect(grantAdminAwards({ ...input, kind: "badge", badge: "partner" })).rejects.toThrow("BADGE_IS_AUTOMATIC_OR_UNKNOWN");
	expect(transaction).not.toHaveBeenCalled();
});
test("bulk awards continue after a missing user and queue only successful grants", async () => {
	read.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "alex" }]);
	const result = await grantAdminAwards({ ...input, userIds: ["missing", "alex"] });
	expect(result.results).toEqual([
		{ userId: "missing", status: "failed", error: "USER_NOT_FOUND" },
		{ userId: "alex", status: "granted" },
	]);
	expect(queue).toHaveBeenCalledTimes(1);
	expect(writes).toHaveBeenCalledWith(expect.objectContaining({ entitlement: "pro_access", source: "support", reason: input.reason, externalReference: `admin:admin:${input.operationId}:alex` }));
});
test("retrying the same operation does not queue another grant notification", async () => {
	await grantAdminAwards(input);
	await expect(grantAdminAwards(input)).resolves.toEqual({ results: [{ userId: "alex", status: "unchanged" }] });
	expect(queue).toHaveBeenCalledTimes(1);
});
test("runner access is a distinct entitlement and supports no expiry", async () => {
	await grantAdminAwards({ ...input, kind: "runner_access", days: null });
	expect(writes).toHaveBeenCalledWith(expect.objectContaining({ entitlement: "runner_access", endsAt: null }));
});

test("admin partnership ending sets its end date and preserves seven days of Pro", async () => {
	const partner = { id: "grant", userId: "alex", entitlement: "pro_access", source: "partner", startsAt: new Date("2020-01-01"), endsAt: null, revokedAt: null, reason: null };
	read.mockResolvedValueOnce([{ id: "alex" }]).mockResolvedValueOnce([partner]);
	const set = jest.fn();
	const localTx = {
		...tx,
		update: () => ({
			set: (values: any) => {
				set(values);
				return { where: () => ({ returning: async () => [{ ...partner, ...values }] }) };
			},
		}),
	};
	transaction.mockImplementation(async (operation: any) => operation(localTx));
	await expect(revokeAdminAward({ userId: "alex", grantId: "grant" })).resolves.toEqual({ changed: true });
	expect(set).toHaveBeenCalledWith({ endsAt: expect.any(Date), updatedAt: expect.any(Date) });
	expect(queue).toHaveBeenCalledWith(expect.objectContaining({ source: "partner", revokedAt: null }), localTx, false);
	expect(revokeQueue).not.toHaveBeenCalled();
});
test("ending an already-ended partnership does not extend its grace", async () => {
	read.mockResolvedValueOnce([{ id: "alex" }]).mockResolvedValueOnce([{ source: "partner", entitlement: "pro_access", endsAt: new Date("2020-01-01") }]);
	await expect(revokeAdminAward({ userId: "alex", grantId: "grant" })).resolves.toEqual({ changed: false });
	expect(queue).not.toHaveBeenCalled();
});
