import { randomUUID } from "node:crypto";
import { redactSecurityValue } from "@/auth/audit";

export type NotificationClass = "welcome" | "invitation" | "security" | "agency-access" | "agency-allocation" | "account-lifecycle";
export type NotificationStatus = "pending" | "claimed" | "sent" | "retry" | "dead";

export interface NotificationRecord {
	id: string;
	eventType: NotificationClass;
	recipient: string;
	templateVersion: string;
	locale: string;
	payload: Record<string, unknown>;
	scheduledAt: Date;
	status: NotificationStatus;
	attempts: number;
	claimedBy?: string;
	claimExpiresAt?: Date;
	providerMessageId?: string;
	lastError?: string;
	dedupeKey: string;
}

export interface NotificationOutboxState {
	notifications: NotificationRecord[];
}

export interface NotificationOutboxRepository {
	transaction<T>(operation: (state: NotificationOutboxState) => Promise<T>): Promise<T>;
}

export async function enqueueNotification(repository: NotificationOutboxRepository, input: Omit<NotificationRecord, "id" | "status" | "attempts" | "payload"> & { payload: Record<string, unknown> }) {
	return repository.transaction(async (state) => {
		const existing = state.notifications.find((notification) => notification.dedupeKey === input.dedupeKey);
		if (existing) return existing;
		const record: NotificationRecord = {
			...input,
			id: randomUUID(),
			status: "pending",
			attempts: 0,
			payload: redactSecurityValue(input.payload) as Record<string, unknown>,
		};
		state.notifications.push(record);
		return record;
	});
}

export async function claimNotifications(repository: NotificationOutboxRepository, input: { workerId: string; now: Date; leaseMs: number; limit: number }) {
	return repository.transaction(async (state) => {
		const now = input.now.getTime();
		const eligible = state.notifications
			.filter((notification) => {
				if (notification.scheduledAt.getTime() > now) return false;
				if (notification.status === "pending" || notification.status === "retry") return true;
				return notification.status === "claimed" && Boolean(notification.claimExpiresAt && notification.claimExpiresAt.getTime() <= now);
			})
			.sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())
			.slice(0, input.limit);
		for (const notification of eligible) {
			notification.status = "claimed";
			notification.claimedBy = input.workerId;
			notification.claimExpiresAt = new Date(now + input.leaseMs);
			notification.attempts += 1;
		}
		return structuredClone(eligible);
	});
}

export async function completeNotification(repository: NotificationOutboxRepository, input: { id: string; workerId: string; providerMessageId: string; now: Date }) {
	return repository.transaction(async (state) => {
		const notification = ownedClaim(state, input.id, input.workerId);
		notification.status = "sent";
		notification.providerMessageId = input.providerMessageId.slice(0, 200);
		notification.claimedBy = undefined;
		notification.claimExpiresAt = undefined;
		return notification;
	});
}

export async function failNotification(repository: NotificationOutboxRepository, input: { id: string; workerId: string; permanent: boolean; error: string; now: Date; maxAttempts?: number }) {
	return repository.transaction(async (state) => {
		const notification = ownedClaim(state, input.id, input.workerId);
		const maxAttempts = input.maxAttempts ?? 3;
		notification.status = input.permanent || notification.attempts >= maxAttempts ? "dead" : "retry";
		notification.lastError = String(redactSecurityValue(input.error)).slice(0, 500);
		notification.scheduledAt = notification.status === "retry" ? new Date(input.now.getTime() + Math.min(60_000 * 2 ** notification.attempts, 60 * 60 * 1000)) : input.now;
		notification.claimedBy = undefined;
		notification.claimExpiresAt = undefined;
		return notification;
	});
}

function ownedClaim(state: NotificationOutboxState, id: string, workerId: string) {
	const notification = state.notifications.find((candidate) => candidate.id === id);
	if (!notification || notification.status !== "claimed" || notification.claimedBy !== workerId) throw new Error("NOTIFICATION_CLAIM_LOST");
	return notification;
}

export async function enqueueDatabaseNotification(input: { eventType: NotificationClass; recipient: string; authorityOrganizationId?: string; templateVersion: string; locale: string; payload: Record<string, unknown>; scheduledAt: Date; dedupeKey: string }) {
	const [{ db }, { notificationOutboxTable }] = await Promise.all([import("@/db/client"), import("@/db/schema")]);
	const [record] = await db
		.insert(notificationOutboxTable)
		.values({ ...input, payload: redactSecurityValue(input.payload) as Record<string, unknown> })
		.onConflictDoUpdate({ target: notificationOutboxTable.dedupeKey, set: { dedupeKey: input.dedupeKey } })
		.returning();
	return record;
}

export async function claimDatabaseNotifications(input: { workerId: string; now: Date; leaseMs: number; limit: number }) {
	const [{ db }, { sql }] = await Promise.all([import("@/db/client"), import("drizzle-orm")]);
	const claimExpiresAt = new Date(input.now.getTime() + input.leaseMs);
	const result = await db.execute(sql`
		WITH candidates AS (
			SELECT "id" FROM "notification_outbox"
			WHERE "scheduled_at" <= ${input.now}
				AND ("status" IN ('pending', 'retry') OR ("status" = 'claimed' AND "claim_expires_at" <= ${input.now}))
			ORDER BY "scheduled_at", "id"
			FOR UPDATE SKIP LOCKED
			LIMIT ${input.limit}
		)
		UPDATE "notification_outbox" AS outbox
		SET "status" = 'claimed', "claimed_by" = ${input.workerId}, "claim_expires_at" = ${claimExpiresAt}, "attempts" = outbox."attempts" + 1, "updated_at" = ${input.now}
		FROM candidates
		WHERE outbox."id" = candidates."id"
		RETURNING outbox.*
	`);
	return result.rows;
}

export async function completeDatabaseNotification(input: { id: string; workerId: string; providerMessageId: string; now: Date }) {
	const [{ db }, { sql }] = await Promise.all([import("@/db/client"), import("drizzle-orm")]);
	const result = await db.execute(sql`
		UPDATE "notification_outbox" SET "status" = 'sent', "provider_message_id" = ${input.providerMessageId.slice(0, 200)}, "claimed_by" = NULL, "claim_expires_at" = NULL, "updated_at" = ${input.now}
		WHERE "id" = ${input.id}::uuid AND "status" = 'claimed' AND "claimed_by" = ${input.workerId}
		RETURNING *
	`);
	if (result.rows.length !== 1) throw new Error("NOTIFICATION_CLAIM_LOST");
	return result.rows[0];
}

export async function failDatabaseNotification(input: { id: string; workerId: string; permanent: boolean; error: string; now: Date; maxAttempts?: number; onDeadLetter?: (record: Record<string, unknown>) => Promise<void> }) {
	const [{ db }, { sql }] = await Promise.all([import("@/db/client"), import("drizzle-orm")]);
	const maxAttempts = input.maxAttempts ?? 3;
	const lastError = String(redactSecurityValue(input.error)).slice(0, 500);
	const result = await db.execute(sql`
		UPDATE "notification_outbox"
		SET
			"status" = CASE WHEN ${input.permanent} OR "attempts" >= ${maxAttempts} THEN 'dead'::"notification_status" ELSE 'retry'::"notification_status" END,
			"last_error" = ${lastError},
			"scheduled_at" = CASE WHEN ${input.permanent} OR "attempts" >= ${maxAttempts} THEN ${input.now}::timestamptz ELSE ${new Date(input.now.getTime() + 2 * 60_000)}::timestamptz END,
			"claimed_by" = NULL,
			"claim_expires_at" = NULL,
			"updated_at" = ${input.now}::timestamptz
		WHERE "id" = ${input.id}::uuid AND "status" = 'claimed' AND "claimed_by" = ${input.workerId}
		RETURNING *
	`);
	if (result.rows.length !== 1) throw new Error("NOTIFICATION_CLAIM_LOST");
	const record = result.rows[0] as Record<string, unknown>;
	if (record.status === "dead") await input.onDeadLetter?.(record);
	return record;
}
