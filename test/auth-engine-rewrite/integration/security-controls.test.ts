/** @jest-environment node */
import { consumeRateLimit, type RateLimitRepository, type RateLimitState } from "@/auth/rate-limit";
import { appendAuditEvent, type AuditEvent } from "@/auth/audit";
import { claimNotifications, completeNotification, enqueueNotification, failNotification, type NotificationOutboxRepository, type NotificationOutboxState } from "@/server/notifications/outbox";
import { ControlledClock } from "../../support/auth-engine-rewrite/time";

class MemoryRateLimits implements RateLimitRepository {
	state: RateLimitState = { counters: [] };
	async transaction<T>(operation: (draft: RateLimitState) => Promise<T>) {
		const draft = structuredClone(this.state);
		const result = await operation(draft);
		this.state = draft;
		return result;
	}
}

class MemoryOutbox implements NotificationOutboxRepository {
	state: NotificationOutboxState = { notifications: [] };
	async transaction<T>(operation: (draft: NotificationOutboxState) => Promise<T>) {
		const draft = structuredClone(this.state);
		const result = await operation(draft);
		this.state = draft;
		return result;
	}
}

describe("TDD-US3-003 shared security controls", () => {
	it.each(["identity", "network"] as const)("throttles the shared %s signal with retry timing", async (signal) => {
		const repository = new MemoryRateLimits();
		const clock = new ControlledClock();
		const input = { identityKey: signal === "identity" ? "user-1" : "user-variable", networkKey: signal === "network" ? "network-1" : "network-variable", action: "invitation", limit: 2, windowMs: 60_000, now: clock.now() };
		expect(await consumeRateLimit(repository, input)).toMatchObject({ allowed: true });
		expect(await consumeRateLimit(repository, input)).toMatchObject({ allowed: true });
		expect(await consumeRateLimit(repository, input)).toEqual({ allowed: false, code: "RATE_LIMITED", retryAfterSeconds: 60 });
	});

	it("recovers exactly when the shared window expires", async () => {
		const repository = new MemoryRateLimits();
		const clock = new ControlledClock();
		const input = { identityKey: "user-1", networkKey: "network-1", action: "recovery", limit: 1, windowMs: 60_000, now: clock.now() };
		await consumeRateLimit(repository, input);
		clock.advance(60_000);
		await expect(consumeRateLimit(repository, { ...input, now: clock.now() })).resolves.toMatchObject({ allowed: true });
	});

	it("atomically deduplicates notification intent without secret payload fields", async () => {
		const repository = new MemoryOutbox();
		const input = { eventType: "invitation" as const, recipient: "member@example.invalid", templateVersion: "v1", locale: "en", payload: { organizationName: "Creator team", invitationToken: "must-not-persist" }, scheduledAt: new Date(), dedupeKey: "invite:1" };
		const first = await enqueueNotification(repository, input);
		const second = await enqueueNotification(repository, input);
		expect(second.id).toBe(first.id);
		expect(repository.state.notifications).toHaveLength(1);
		expect(JSON.stringify(repository.state)).not.toContain("must-not-persist");
		expect(repository.state.notifications[0]?.payload).toMatchObject({ invitationToken: "[REDACTED]" });
	});

	it("allows only one worker to claim an active lease", async () => {
		const repository = new MemoryOutbox();
		const clock = new ControlledClock();
		await enqueueNotification(repository, { eventType: "welcome", recipient: "member@example.invalid", templateVersion: "v1", locale: "en", payload: {}, scheduledAt: clock.now(), dedupeKey: "welcome:1" });
		const first = await claimNotifications(repository, { workerId: "worker-a", now: clock.now(), leaseMs: 30_000, limit: 10 });
		const second = await claimNotifications(repository, { workerId: "worker-b", now: clock.now(), leaseMs: 30_000, limit: 10 });
		expect(first).toHaveLength(1);
		expect(second).toEqual([]);
	});

	it("records sent delivery state and a redacted provider identifier", async () => {
		const repository = new MemoryOutbox();
		const clock = new ControlledClock();
		await enqueueNotification(repository, { eventType: "security", recipient: "member@example.invalid", templateVersion: "v1", locale: "en", payload: {}, scheduledAt: clock.now(), dedupeKey: "security:1" });
		const [claimed] = await claimNotifications(repository, { workerId: "worker-a", now: clock.now(), leaseMs: 30_000, limit: 1 });
		await completeNotification(repository, { id: claimed!.id, workerId: "worker-a", providerMessageId: "provider-1", now: clock.now() });
		expect(repository.state.notifications[0]).toMatchObject({ status: "sent", providerMessageId: "provider-1" });
	});

	it("retries transient failure and dead-letters permanent failure", async () => {
		const repository = new MemoryOutbox();
		const clock = new ControlledClock();
		for (const [key, permanent] of [
			["retry", false],
			["dead", true],
		] as const) {
			await enqueueNotification(repository, { eventType: "agency-access", recipient: "member@example.invalid", templateVersion: "v1", locale: "en", payload: {}, scheduledAt: clock.now(), dedupeKey: key });
			const [claimed] = await claimNotifications(repository, { workerId: key, now: clock.now(), leaseMs: 30_000, limit: 1 });
			await failNotification(repository, { id: claimed!.id, workerId: key, permanent, error: "Authorization: Bearer secret-token", now: clock.now() });
		}
		expect(repository.state.notifications.find((item) => item.dedupeKey === "retry")).toMatchObject({ status: "retry", lastError: "[REDACTED]" });
		expect(repository.state.notifications.find((item) => item.dedupeKey === "dead")).toMatchObject({ status: "dead", lastError: "[REDACTED]" });
	});

	it.each(["welcome", "invitation", "security", "agency-access"] as const)("supports the %s notification class", async (eventType) => {
		const repository = new MemoryOutbox();
		await enqueueNotification(repository, { eventType, recipient: "member@example.invalid", templateVersion: "v1", locale: "en", payload: {}, scheduledAt: new Date(), dedupeKey: `${eventType}:1` });
		expect(repository.state.notifications[0]?.eventType).toBe(eventType);
	});

	it.each(["invitation", "membership", "role", "agency-link", "allocation", "sensitive-integration", "account-deletion"] as const)("writes a redacted append-only %s audit outcome", async (actionClass) => {
		const events: AuditEvent[] = [];
		const event = appendAuditEvent(events, { actionClass, action: `${actionClass}:update`, outcome: "denied", reason: "PERMISSION_DENIED", correlationId: "correlation-1", metadata: { accessToken: "secret", safe: "value" }, occurredAt: new Date() });
		expect(events).toHaveLength(1);
		expect(event.metadata).toEqual({ accessToken: "[REDACTED]", safe: "value" });
	});
});
