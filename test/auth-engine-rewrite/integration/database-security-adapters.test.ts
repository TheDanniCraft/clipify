/** @jest-environment node */

const execute = jest.fn();
const transaction = jest.fn(async (operation: (tx: { execute: typeof execute }) => Promise<unknown>) => operation({ execute }));
const returning = jest.fn();
const onConflictDoUpdate = jest.fn(() => ({ returning }));
const values = jest.fn(() => ({ onConflictDoUpdate }));
const insert = jest.fn(() => ({ values }));

jest.mock("@/db/client", () => ({ db: { execute, transaction, insert } }));
jest.mock("@/db/schema", () => ({ notificationOutboxTable: { dedupeKey: "notification_outbox.dedupe_key" } }));
jest.mock("drizzle-orm", () => ({
	sql: (strings: TemplateStringsArray, ...parameters: unknown[]) => ({ strings: [...strings], parameters }),
}));

import { consumeDatabaseRateLimit } from "@/auth/rate-limit";
import { claimDatabaseNotifications, completeDatabaseNotification, enqueueDatabaseNotification, failDatabaseNotification } from "@/server/notifications/outbox";

describe("TDD-US3-006 database security adapters", () => {
	const now = new Date("2026-09-29T00:00:00.000Z");

	beforeEach(() => {
		jest.clearAllMocks();
		process.env.RATE_LIMIT_HASH_SECRET = "test-only-rate-limit-secret";
	});

	afterAll(() => {
		delete process.env.RATE_LIMIT_HASH_SECRET;
	});

	it("fails closed when the database limiter hash secret is absent", async () => {
		delete process.env.RATE_LIMIT_HASH_SECRET;
		await expect(consumeDatabaseRateLimit({ identityKey: "USER@Example.Test", networkKey: "127.0.0.1", action: "sign-in", limit: 2, windowMs: 60_000, now })).rejects.toThrow("RATE_LIMIT_HASH_SECRET must be injected by Infisical");
		expect(transaction).not.toHaveBeenCalled();
	});

	it("consumes both normalized signals and returns the tightest remaining allowance", async () => {
		execute.mockResolvedValueOnce({ rows: [{ count: 1, expires_at: new Date(now.getTime() + 60_000) }] }).mockResolvedValueOnce({ rows: [{ count: 2, expires_at: new Date(now.getTime() + 60_000) }] });
		await expect(consumeDatabaseRateLimit({ identityKey: " USER@Example.Test ", networkKey: " 127.0.0.1 ", action: "sign-in", limit: 3, windowMs: 60_000, now })).resolves.toEqual({ allowed: true, remaining: 1 });
		expect(execute).toHaveBeenCalledTimes(2);
	});

	it("returns the longest retry delay when either persisted signal exceeds its limit", async () => {
		execute.mockResolvedValueOnce({ rows: [{ count: 4, expires_at: new Date(now.getTime() + 1_500) }] }).mockResolvedValueOnce({ rows: [{ count: 5, expires_at: new Date(now.getTime() + 4_200) }] });
		await expect(consumeDatabaseRateLimit({ identityKey: "user", networkKey: "network", action: "otp", limit: 3, windowMs: 60_000, now })).resolves.toEqual({ allowed: false, code: "RATE_LIMITED", retryAfterSeconds: 5 });
	});

	it("enqueues a redacted notification through the database upsert", async () => {
		returning.mockResolvedValueOnce([{ id: "notification-1", status: "pending" }]);
		await expect(
			enqueueDatabaseNotification({
				eventType: "security",
				recipient: "member@example.test",
				templateVersion: "identity-security-v1",
				locale: "en",
				payload: { token: "secret-token", safe: "value" },
				scheduledAt: now,
				dedupeKey: "security:1",
			}),
		).resolves.toEqual({ id: "notification-1", status: "pending" });
		expect(values).toHaveBeenCalledWith(expect.objectContaining({ payload: { token: "[REDACTED]", safe: "value" } }));
		expect(onConflictDoUpdate).toHaveBeenCalledWith(expect.objectContaining({ set: { dedupeKey: "security:1" } }));
	});

	it("claims due database notifications with a bounded lease", async () => {
		execute.mockResolvedValueOnce({ rows: [{ id: "notification-1", status: "claimed" }] });
		await expect(claimDatabaseNotifications({ workerId: "worker-1", now, leaseMs: 30_000, limit: 10 })).resolves.toEqual([{ id: "notification-1", status: "claimed" }]);
	});

	it("completes only a claim owned by the worker", async () => {
		execute.mockResolvedValueOnce({ rows: [{ id: "notification-1", status: "sent" }] });
		await expect(completeDatabaseNotification({ id: "00000000-0000-0000-0000-000000000001", workerId: "worker-1", providerMessageId: "x".repeat(250), now })).resolves.toMatchObject({ status: "sent" });
		execute.mockResolvedValueOnce({ rows: [] });
		await expect(completeDatabaseNotification({ id: "00000000-0000-0000-0000-000000000001", workerId: "worker-2", providerMessageId: "provider-1", now })).rejects.toThrow("NOTIFICATION_CLAIM_LOST");
	});

	it("retries transient failures and invokes dead-letter handling for terminal failures", async () => {
		execute.mockResolvedValueOnce({ rows: [{ id: "notification-1", status: "retry", last_error: "token=[REDACTED]" }] });
		await expect(failDatabaseNotification({ id: "00000000-0000-0000-0000-000000000001", workerId: "worker-1", permanent: false, error: "token=secret", now })).resolves.toMatchObject({ status: "retry" });

		const onDeadLetter = jest.fn();
		execute.mockResolvedValueOnce({ rows: [{ id: "notification-2", status: "dead" }] });
		await expect(failDatabaseNotification({ id: "00000000-0000-0000-0000-000000000002", workerId: "worker-1", permanent: true, error: "permanent", now, maxAttempts: 5, onDeadLetter })).resolves.toMatchObject({ status: "dead" });
		expect(onDeadLetter).toHaveBeenCalledWith(expect.objectContaining({ id: "notification-2" }));
	});

	it("casts failure scheduling timestamps so Postgres does not infer the CASE as text", async () => {
		execute.mockResolvedValueOnce({ rows: [{ id: "notification-1", status: "retry" }] });
		await failDatabaseNotification({ id: "00000000-0000-0000-0000-000000000001", workerId: "worker-1", permanent: false, error: "transient", now });
		const query = execute.mock.calls[0][0] as { strings: string[]; parameters: unknown[] };
		const nowIndexes = query.parameters.flatMap((parameter, index) => (parameter instanceof Date ? [index] : []));
		expect(nowIndexes).toHaveLength(3);
		for (const index of nowIndexes) expect(query.strings[index + 1].startsWith("::timestamptz")).toBe(true);
		expect(query.parameters[nowIndexes[1]]).toEqual(new Date(now.getTime() + 2 * 60_000));
	});

	it("rejects a lost failure claim without calling dead-letter handling", async () => {
		const onDeadLetter = jest.fn();
		execute.mockResolvedValueOnce({ rows: [] });
		await expect(failDatabaseNotification({ id: "00000000-0000-0000-0000-000000000003", workerId: "worker-1", permanent: true, error: "lost", now, onDeadLetter })).rejects.toThrow("NOTIFICATION_CLAIM_LOST");
		expect(onDeadLetter).not.toHaveBeenCalled();
	});
});
