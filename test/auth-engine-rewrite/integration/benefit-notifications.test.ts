/** @jest-environment node */
const values = jest.fn(),
	execute = jest.fn();
jest.mock("@/db/client", () => ({
	db: {
		select: () => {
			const chain: any = { from: () => chain, where: () => chain, limit: () => chain, execute: async () => [{ email: "alex@example.test" }] };
			return chain;
		},
		insert: () => ({
			values: (input: unknown) => {
				values(input);
				return { onConflictDoNothing: async () => [] };
			},
		}),
		execute: (...args: unknown[]) => execute(...args),
	},
}));
import { queueGrantEmails, queueCancellationEmail, queueRevokedGrantEmails } from "@/server/notifications/benefit-events";
const startsAt = new Date("2030-01-01T12:00:00Z"),
	endsAt = new Date("2030-01-08T12:00:00Z");
const grant = { id: "grant-1", userId: "alex", entitlement: "pro_access", source: "support", reason: "Thanks for reporting a bug", startsAt, endsAt };
beforeEach(() => jest.clearAllMocks());
test("a targeted seven-day gift preserves its duration, reason and stable dedupe keys", async () => {
	await queueGrantEmails(grant);
	expect(values).toHaveBeenCalledTimes(4);
	expect(values).toHaveBeenCalledWith(expect.objectContaining({ dedupeKey: "benefit:grant-1:granted", payload: expect.objectContaining({ benefit: "pro", reason: grant.reason, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }) }));
});
test("reverse trials queue start, three-day, one-day and expiry notices", async () => {
	await queueGrantEmails({ ...grant, source: "reverse_trial" });
	expect(values.mock.calls.map(([v]) => v.payload.event)).toEqual(["granted", "trial-3d", "trial-1d", "ended"]);
	expect(values.mock.calls[1][0].scheduledAt).toEqual(new Date("2030-01-05T12:00:00Z"));
	expect(values.mock.calls[2][0].scheduledAt).toEqual(new Date("2030-01-07T12:00:00Z"));
});
test("runner gifts are not labeled Pro, and billing or global grants do not generate generic gift emails", async () => {
	await queueGrantEmails({ ...grant, entitlement: "runner_access" });
	expect(values.mock.calls[0][0].payload.benefit).toBe("runner");
	values.mockClear();
	await queueGrantEmails({ ...grant, source: "billing" });
	await queueGrantEmails({ ...grant, userId: null });
	expect(values).not.toHaveBeenCalled();
});
test("confirmed runner cancellation has its own product and subscription dedupe key", async () => {
	await queueCancellationEmail({ subscriptionId: "sub-1", userId: "alex", eventCreated: 123, benefit: "runner", endsAt });
	expect(values).toHaveBeenCalledWith(expect.objectContaining({ dedupeKey: "cancellation:sub-1:123:runner", payload: expect.objectContaining({ event: "cancellation", benefit: "runner", subscriptionId: "sub-1" }) }));
});
test("explicit revocations retain the entitlement type and are queued idempotently", async () => {
	execute.mockResolvedValue({ rows: [{ id: "grant-2", entitlement: "runner_access", email: "alex@example.test", revoked_at: startsAt }] });
	await queueRevokedGrantEmails(startsAt);
	expect(values).toHaveBeenCalledWith(expect.objectContaining({ dedupeKey: `benefit:grant-2:revoked:${startsAt.getTime()}`, payload: expect.objectContaining({ benefit: "runner", event: "revoked" }) }));
});

test("backfilled trial reminders do not replay the original trial-start email", async () => {
	const { db } = await import("@/db/client");
	await queueGrantEmails({ ...grant, source: "reverse_trial" }, db, false);
	expect(values.mock.calls.map(([v]) => v.payload.event)).toEqual(["trial-3d", "trial-1d", "ended"]);
});

test("paid cancellation countdowns use the Stripe period end and stable subscription keys", async () => {
	const { queueSubscriptionCancellationReminders } = await import("@/server/notifications/benefit-events");
	await queueSubscriptionCancellationReminders({ subscriptionId: "sub", userId: "alex", endsAt });
	expect(values.mock.calls.map(([v]) => v.payload.event)).toEqual(["cancellation-30d", "cancellation-7d", "cancellation-3d", "cancellation-1d"]);
	expect(values.mock.calls[1][0].scheduledAt).toEqual(new Date("2030-01-01T12:00:00Z"));
	expect(values.mock.calls[3][0].dedupeKey).toBe(`pro-cancellation:sub:${endsAt.getTime()}:1d`);
});

test.each(["pro_access", "runner_access"])("long %s awards and trials use every shared boundary", async (entitlement) => {
	const end = new Date("2030-03-01T12:00:00Z");
	for (const source of ["support", "reverse_trial"]) {
		values.mockClear();
		await queueGrantEmails({ ...grant, entitlement, source, endsAt: end });
		expect(values.mock.calls.map(([v]) => v.payload.event)).toEqual(["granted", ...[30, 7, 3, 1].map((d) => `${source === "reverse_trial" ? "trial" : "access"}-${d}d`), "ended"]);
	}
});
test("Runner subscription countdowns have distinct product keys and every shared boundary", async () => {
	const { queueSubscriptionCancellationReminders } = await import("@/server/notifications/benefit-events");
	await queueSubscriptionCancellationReminders({ subscriptionId: "sub", userId: "alex", endsAt, benefit: "runner" });
	expect(values.mock.calls.map(([v]) => v.payload.event)).toEqual(["cancellation-30d", "cancellation-7d", "cancellation-3d", "cancellation-1d"]);
	expect(values.mock.calls.every(([v]) => v.payload.benefit === "runner" && v.dedupeKey.startsWith("runner-cancellation:"))).toBe(true);
});
