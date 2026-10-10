import { reminderIsCurrent } from "./reminder-schedule";
import { hasContinuingPro, hasContinuingBenefit } from "./access-context";
import { grantAccessEndsAt } from "@/server/entitlements/grant-period";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accountDeletionRequestsTable, agencyLicenseAllocationsTable, entitlementGrantsTable, billingSubscriptionsTable, usersTable } from "@/db/schema";
import type { DeliveryRecord } from "./delivery";

export async function notificationStillApplies(record: DeliveryRecord, now: Date): Promise<boolean> {
	if (record.event_type === "badge" || record.event_type === "account-access") {
		const [user] = await db
			.select({ id: usersTable.id })
			.from(usersTable)
			.where(eq(usersTable.id, String(record.payload.userId)))
			.limit(1);
		return !!user;
	}
	if (record.event_type === "pro-membership") {
		const [user] = await db
			.select({ id: usersTable.id, plan: usersTable.plan })
			.from(usersTable)
			.where(eq(usersTable.id, String(record.payload.userId)))
			.limit(1);
		if (!user) return false;
		if (record.payload.event === "payment-ended") {
			const [subscription] = await db
				.select()
				.from(billingSubscriptionsTable)
				.where(eq(billingSubscriptionsTable.id, String(record.payload.subscriptionId)))
				.limit(1);
			if (!subscription || !["canceled", "unpaid"].includes(subscription.status)) return false;
			if (await hasContinuingPro(user.id, now)) return false;
			record.payload.proContinues = false;
		}
		if (record.payload.event === "welcome-back") return hasContinuingPro(user.id, now);
		return record.payload.event !== "first-pro" || user.plan === "pro";
	}
	if (record.event_type === "billing") {
		const [subscription] = await db
			.select()
			.from(billingSubscriptionsTable)
			.where(eq(billingSubscriptionsTable.id, String(record.payload.subscriptionId)))
			.limit(1);
		if (!subscription) return false;
		const event = String(record.payload.event);
		if (event.startsWith("cancellation-")) {
			if (event === "cancellation-0d") return subscription.status === "canceled" && !(await hasContinuingBenefit(record.payload.benefit === "runner" ? "runner" : "pro", subscription.userId, now));
			if (!subscription.cancelAtPeriodEnd || !["active", "trialing", "past_due"].includes(subscription.status) || !subscription.currentPeriodEnd) return false;
			if (record.payload.endsAt !== subscription.currentPeriodEnd.toISOString()) return false;
			const days = Number(event.slice("cancellation-".length, -1));
			const remaining = subscription.currentPeriodEnd.getTime() - now.getTime();
			if (remaining > days * 86400000 || remaining <= (days - 1) * 86400000) return false;
			return !(await hasContinuingBenefit(record.payload.benefit === "runner" ? "runner" : "pro", subscription.userId, subscription.currentPeriodEnd));
		}
		return subscription.cancelAtPeriodEnd || subscription.status === "canceled";
	}
	if (record.event_type === "entitlement") {
		const [grant] = await db
			.select()
			.from(entitlementGrantsTable)
			.where(eq(entitlementGrantsTable.id, String(record.payload.grantId)))
			.limit(1);
		if (!grant) return false;
		if (record.payload.event === "revoked") {
			if (!grant.revokedAt || record.dedupe_key.split(":").at(-1) !== String(grant.revokedAt.getTime())) return false;
			record.payload.partner = grant.source === "partner" && grant.entitlement === "pro_access";
			if (grant.userId) record.payload[grant.entitlement === "runner_access" ? "runnerContinues" : "proContinues"] = await hasContinuingBenefit(grant.entitlement === "runner_access" ? "runner" : "pro", grant.userId, now, grant.id);
			return true;
		}
		if (grant.revokedAt) return false;
		if (record.payload.endsAt !== (grant.endsAt?.toISOString() ?? null)) return false;
		if (grant.source === "billing") return false;
		if (record.payload.trial !== undefined && record.payload.trial !== (grant.source === "reverse_trial")) return false;
		if (record.payload.benefit !== undefined && record.payload.benefit !== (grant.entitlement === "runner_access" ? "runner" : "pro")) return false;
		const partner = grant.source === "partner" && grant.entitlement === "pro_access";
		if (record.payload.partner !== undefined && record.payload.partner !== partner) return false;
		record.payload.partner = partner;
		const accessEnd = grantAccessEndsAt(grant);
		const event = String(record.payload.event);
		if (event.startsWith("partner-ending-")) {
			if (!partner || !grant.endsAt) return false;
			const days = Number(event.slice("partner-ending-".length, -1));
			const remaining = grant.endsAt.getTime() - now.getTime();
			return remaining <= days * 86400000 && remaining > (days - 1) * 86400000;
		}
		if (event === "partner-scheduled") return partner && !!grant.endsAt && grant.endsAt > now;
		if (["granted", "updated", "restored"].includes(event)) return grant.startsAt <= now && (!accessEnd || accessEnd > now);
		if (event === "partner-ended") return partner && !!grant.endsAt && grant.endsAt <= now && !!accessEnd && accessEnd > now;
		if (event === "ended") {
			if (!accessEnd || accessEnd > now) return false;
			if (grant.userId) record.payload[grant.entitlement === "runner_access" ? "runnerContinues" : "proContinues"] = await hasContinuingBenefit(grant.entitlement === "runner_access" ? "runner" : "pro", grant.userId, now, grant.id);
			return true;
		}
		if (!accessEnd || accessEnd <= now) return false;
		const days = Number(event.split("-").at(-1)?.replace("d", ""));
		// Skip stale countdowns; suppress sales emails when another source survives this access period.
		if (accessEnd.getTime() - now.getTime() > days * 86400000 || accessEnd.getTime() - now.getTime() <= (days - 1) * 86400000) return false;
		if (grant.userId && (await hasContinuingBenefit(grant.entitlement === "runner_access" ? "runner" : "pro", grant.userId, accessEnd, grant.id))) return false;
		return true;
	}
	if (record.event_type === "account-lifecycle") {
		const requestId = record.dedupe_key.split(":")[1];
		const [request] = await db.select().from(accountDeletionRequestsTable).where(eq(accountDeletionRequestsTable.id, requestId)).limit(1);
		if (!request) return false;
		const boundary = record.payload.boundary;
		if (boundary === "recovery") return request.status === "recovered";
		if (request.status === "recovered" || request.status === "cancelled" || request.status === "purged") return false;
		if (boundary === "suspension" && request.requestedAt.getTime() === request.suspensionAt.getTime()) return false;
		if (boundary === "request") return true;
		// Do not send expired restore links or a backlog of obsolete countdowns.
		if (!request.purgeEligibleAt || now >= request.purgeEligibleAt) return false;
		const days = ({ "30d": 30, "7d": 7, "3d": 3, "1d": 1 } as Record<string, number>)[String(boundary)];
		return days === undefined || request.purgeEligibleAt.getTime() - now.getTime() > (days - 1) * 86400000;
	}
	if (record.event_type === "agency-allocation") {
		const allocationId = record.dedupe_key.split(":")[1];
		const [allocation] = await db.select().from(agencyLicenseAllocationsTable).where(eq(agencyLicenseAllocationsTable.id, allocationId)).limit(1);
		if (!allocation) return false;
		record.payload.product = allocation.product;
		if (record.payload.boundary === "granted") return allocation.status === "active" || allocation.status === "removal_scheduled";
		if (record.payload.boundary === "ended") return allocation.status === "ended" && !(await hasContinuingBenefit(allocation.product === "runner" ? "runner" : "pro", allocation.creatorId, now));
		if (allocation.status !== "removal_scheduled" || !allocation.endsAt || allocation.endsAt <= now) return false;
		const boundary = String(record.payload.boundary);
		if (boundary.startsWith("removal-") && boundary !== "removal-scheduled") {
			if (record.payload.effectiveAt !== allocation.endsAt.toISOString()) return false;
			const days = Number(boundary.slice("removal-".length, -1));
			if (!reminderIsCurrent(allocation.endsAt, now, days)) return false;
			return !(await hasContinuingBenefit(allocation.product === "runner" ? "runner" : "pro", allocation.creatorId, allocation.endsAt));
		}
		return true;
	}
	return true;
}
