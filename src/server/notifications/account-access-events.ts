import { db, type QueryClient } from "@/db/client";
import { notificationOutboxTable } from "@/db/schema";
/** Queue inside the access-change transaction so delivery failure cannot lose the notice. */
export async function queueAccountAccessEmail(input: { userId: string; email: string; name: string; disabled: boolean; automatic?: boolean; reason?: string; changedAt: Date }, client: QueryClient = db) {
	if (!input.email) return;
	await client
		.insert(notificationOutboxTable)
		.values({ eventType: "account-access", recipient: input.email, templateVersion: "account-access-v1", locale: "en", payload: { userId: input.userId, name: input.name, disabled: input.disabled, automatic: !!input.automatic, reason: input.reason ?? "", changedAt: input.changedAt.toISOString() }, scheduledAt: input.changedAt, dedupeKey: `account-access:${input.userId}:${input.disabled ? "disabled" : "enabled"}:${input.changedAt.getTime()}` })
		.onConflictDoNothing({ target: notificationOutboxTable.dedupeKey });
}
