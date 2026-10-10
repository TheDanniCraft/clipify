import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createMcpPostgresFixture } from "../mcp/postgres";
import { notificationOutboxTable } from "@/db/schema";

let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
let fail: typeof import("@/server/notifications/outbox").failDatabaseNotification;
const now = new Date("2040-01-01T12:00:00Z");
before(async () => {
	fixture = await createMcpPostgresFixture();
	globalThis.__dbPool = fixture.pool;
	fail = (await import("@/server/notifications/outbox")).failDatabaseNotification;
});
after(async () => {
	delete globalThis.__dbPool;
	await fixture?.close();
});

for (const scenario of [
	{ name: "transient failure", permanent: false, attempts: 1, status: "retry", delay: 120000 },
	{ name: "obsolete notification", permanent: true, attempts: 1, status: "dead", delay: 0 },
	{ name: "exhausted retries", permanent: false, attempts: 3, status: "dead", delay: 0 },
]) {
	test(`PostgreSQL records ${scenario.name} and releases its claim`, async () => {
		const [record] = await fixture.db
			.insert(notificationOutboxTable)
			.values({ eventType: "welcome", recipient: "fixture@example.invalid", templateVersion: "identity-security-v1", locale: "en", payload: {}, scheduledAt: now, dedupeKey: scenario.name, status: "claimed", attempts: scenario.attempts, claimedBy: "fixture-worker", claimExpiresAt: new Date(now.getTime() + 300000) })
			.returning();
		const result = await fail({ id: record.id, workerId: "fixture-worker", permanent: scenario.permanent, error: "fixture delivery failure", now });
		assert.equal(result.status, scenario.status);
		assert.equal(new Date(String(result.scheduled_at)).getTime(), now.getTime() + scenario.delay);
		assert.equal(result.claimed_by, null);
		assert.equal(result.claim_expires_at, null);
		assert.equal(result.last_error, "fixture delivery failure");
	});
}
