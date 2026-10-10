import { eq } from "drizzle-orm";
import { db, type QueryClient } from "@/db/client";
import { notificationOutboxTable, usersTable } from "@/db/schema";
import type { ProMembershipEmail } from "./templates/pro-membership";

async function queueProEmail(userId: string, payload: Omit<ProMembershipEmail, "name"> & { subscriptionId?: string; invoiceId?: string }, dedupeKey: string, client: QueryClient) {
	const [user] = await client.select({ email: usersTable.email, name: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
	if (!user?.email) return false;
	const inserted = await client
		.insert(notificationOutboxTable)
		.values({ eventType: "pro-membership", templateVersion: "pro-membership-v1", recipient: user.email, locale: "en", payload: { ...payload, userId, name: user.name }, dedupeKey, scheduledAt: new Date() })
		.onConflictDoNothing({ target: notificationOutboxTable.dedupeKey })
		.returning({ id: notificationOutboxTable.id });
	return inserted.length > 0;
}
/** Invoice-ID deduplication covers webhook replay and recovery success. No zero-value/trial invoices. */
export async function queueProPaymentEmail(input: { userId: string; subscriptionId: string; invoiceId: string; amountPaid: number; billingReason: string | null }, client: QueryClient = db) {
	if (input.amountPaid <= 0 || !["subscription_create", "subscription_cycle"].includes(input.billingReason ?? "")) return;
	const first = await queueProEmail(input.userId, { type: "pro-membership", event: "first-pro", invoiceId: input.invoiceId, subscriptionId: input.subscriptionId }, `first-paid-pro:${input.userId}`, client);
	if (!first) {
		const [original] = await client
			.select({ payload: notificationOutboxTable.payload })
			.from(notificationOutboxTable)
			.where(eq(notificationOutboxTable.dedupeKey, `first-paid-pro:${input.userId}`))
			.limit(1);
		if (original?.payload.invoiceId === input.invoiceId) return;
		if (input.billingReason === "subscription_create" && original?.payload.subscriptionId !== input.subscriptionId) await queueProEmail(input.userId, { type: "pro-membership", event: "welcome-back", invoiceId: input.invoiceId, subscriptionId: input.subscriptionId }, `pro-welcome-back:${input.subscriptionId}`, client);
	}
	if (!first && input.billingReason === "subscription_cycle") await queueProEmail(input.userId, { type: "pro-membership", event: "renewal", invoiceId: input.invoiceId, subscriptionId: input.subscriptionId }, `pro-renewal:${input.invoiceId}`, client);
}
export async function queuePaymentRecoveryEnded(input: { userId: string; subscriptionId: string; eventCreated: number }, client: QueryClient = db) {
	await queueProEmail(input.userId, { type: "pro-membership", event: "payment-ended", subscriptionId: input.subscriptionId }, `pro-payment-ended:${input.subscriptionId}:${input.eventCreated}`, client);
}
