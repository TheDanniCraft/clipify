import { reminderIsCurrent } from "./reminder-schedule";
import { hasContinuingPro, hasContinuingBenefit } from "./access-context";
import { grantAccessEndsAt } from "@/server/entitlements/grant-period";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accountDeletionRequestsTable, agencyLicenseAllocationsTable, entitlementGrantsTable, billingSubscriptionsTable, usersTable } from "@/db/schema";
import type { DeliveryRecord } from "./delivery";

async function accountNoticeApplies(record: DeliveryRecord): Promise<boolean> {
	const [user] = await db
		.select({ id: usersTable.id, disabled: usersTable.disabled })
		.from(usersTable)
		.where(eq(usersTable.id, String(record.payload.userId)))
		.limit(1);
	return !!user && (record.event_type !== "account-access" || user.disabled === record.payload.disabled);
}

async function proMembershipNoticeApplies(record: DeliveryRecord, now: Date): Promise<boolean> {
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

async function billingNoticeApplies(record: DeliveryRecord, now: Date): Promise<boolean> {
	const [subscription] = await db
		.select()
		.from(billingSubscriptionsTable)
		.where(eq(billingSubscriptionsTable.id, String(record.payload.subscriptionId)))
		.limit(1);
	if (!subscription) return false;
	const event = String(record.payload.event);
	if (event.startsWith("cancellation-")) return cancellationBillingNoticeApplies(record, subscription, event, now);
	return subscription.cancelAtPeriodEnd || subscription.status === "canceled";
}

async function cancellationBillingNoticeApplies(record: DeliveryRecord, subscription: typeof billingSubscriptionsTable.$inferSelect, event: string, now: Date) {
	if (event === "cancellation-0d") return endedSubscriptionNoticeApplies(record, subscription, now);
	if (!subscription.cancelAtPeriodEnd || !["active", "trialing", "past_due"].includes(subscription.status) || !subscription.currentPeriodEnd) return false;
	if (record.payload.endsAt !== subscription.currentPeriodEnd.toISOString()) return false;
	const days = Number(event.slice("cancellation-".length, -1));
	const remaining = subscription.currentPeriodEnd.getTime() - now.getTime();
	if (remaining > days * 86400000 || remaining <= (days - 1) * 86400000) return false;
	return !(await hasContinuingBenefit(record.payload.benefit === "runner" ? "runner" : "pro", subscription.userId, subscription.currentPeriodEnd));
}

async function endedSubscriptionNoticeApplies(record: DeliveryRecord, subscription: typeof billingSubscriptionsTable.$inferSelect, now: Date) {
	return subscription.status === "canceled" && !(await hasContinuingBenefit(record.payload.benefit === "runner" ? "runner" : "pro", subscription.userId, now));
}

async function entitlementNoticeApplies(record: DeliveryRecord, now: Date): Promise<boolean> {
	const [grant] = await db
		.select()
		.from(entitlementGrantsTable)
		.where(eq(entitlementGrantsTable.id, String(record.payload.grantId)))
		.limit(1);
	if (!grant) return false;
	if (record.payload.event === "revoked") return revokedBenefitNoticeApplies(record, now, grant);
	if (grant.revokedAt || !benefitPayloadMatches(record, grant)) return false;
	const partner = grant.source === "partner" && grant.entitlement === "pro_access";
	record.payload.partner = partner;
	return activeBenefitNoticeApplies(record, now, grant, partner);
}

type BenefitGrant = typeof entitlementGrantsTable.$inferSelect;
async function revokedBenefitNoticeApplies(record: DeliveryRecord, now: Date, grant: BenefitGrant): Promise<boolean> {
	if (!grant.revokedAt || record.dedupe_key.split(":").at(-1) !== String(grant.revokedAt.getTime())) return false;
	record.payload.partner = grant.source === "partner" && grant.entitlement === "pro_access";
	if (grant.userId) record.payload[grant.entitlement === "runner_access" ? "runnerContinues" : "proContinues"] = await hasContinuingBenefit(grant.entitlement === "runner_access" ? "runner" : "pro", grant.userId, now, grant.id);
	return true;
}

function optionalPayloadMatches(value: unknown, current: unknown) {
	return value === undefined || value === current;
}
function benefitPayloadMatches(record: DeliveryRecord, grant: BenefitGrant) {
	return record.payload.endsAt === (grant.endsAt?.toISOString() ?? null) && grant.source !== "billing" && optionalPayloadMatches(record.payload.trial, grant.source === "reverse_trial") && optionalPayloadMatches(record.payload.benefit, grant.entitlement === "runner_access" ? "runner" : "pro") && optionalPayloadMatches(record.payload.partner, grant.source === "partner" && grant.entitlement === "pro_access");
}
function partnerEndingNoticeApplies(grant: BenefitGrant, now: Date, event: string, partner: boolean) {
	if (!partner || !grant.endsAt) return false;
	const days = Number(event.slice("partner-ending-".length, -1));
	return reminderIsCurrent(grant.endsAt, now, days);
}
function startedBenefitNoticeApplies(grant: BenefitGrant, accessEnd: Date | null, now: Date) {
	return grant.startsAt <= now && (!accessEnd || accessEnd > now);
}
function scheduledPartnerNoticeApplies(grant: BenefitGrant, now: Date, partner: boolean) {
	return partner && !!grant.endsAt && grant.endsAt > now;
}
function endedPartnerNoticeApplies(grant: BenefitGrant, accessEnd: Date | null, now: Date, partner: boolean) {
	return partner && !!grant.endsAt && grant.endsAt <= now && !!accessEnd && accessEnd > now;
}
async function endedBenefitNoticeApplies(record: DeliveryRecord, grant: BenefitGrant, accessEnd: Date | null, now: Date) {
	if (!accessEnd || accessEnd > now) return false;
	if (grant.userId) record.payload[grant.entitlement === "runner_access" ? "runnerContinues" : "proContinues"] = await hasContinuingBenefit(grant.entitlement === "runner_access" ? "runner" : "pro", grant.userId, now, grant.id);
	return true;
}
async function benefitReminderApplies(grant: BenefitGrant, accessEnd: Date | null, now: Date, event: string) {
	if (!accessEnd || accessEnd <= now) return false;
	const days = Number(event.split("-").at(-1)?.replace("d", ""));
	// Skip stale countdowns; suppress sales emails when another source survives this access period.
	if (accessEnd.getTime() - now.getTime() > days * 86400000 || accessEnd.getTime() - now.getTime() <= (days - 1) * 86400000) return false;
	if (grant.userId && (await hasContinuingBenefit(grant.entitlement === "runner_access" ? "runner" : "pro", grant.userId, accessEnd, grant.id))) return false;
	return true;
}
async function activeBenefitNoticeApplies(record: DeliveryRecord, now: Date, grant: BenefitGrant, partner: boolean): Promise<boolean> {
	const accessEnd = grantAccessEndsAt(grant),
		event = String(record.payload.event);
	if (event.startsWith("partner-ending-")) return partnerEndingNoticeApplies(grant, now, event, partner);
	if (event === "partner-scheduled") return scheduledPartnerNoticeApplies(grant, now, partner);
	if (["granted", "updated", "restored"].includes(event)) return startedBenefitNoticeApplies(grant, accessEnd, now);
	if (event === "partner-ended") return endedPartnerNoticeApplies(grant, accessEnd, now, partner);
	if (event === "ended") return endedBenefitNoticeApplies(record, grant, accessEnd, now);
	return benefitReminderApplies(grant, accessEnd, now, event);
}

async function lifecycleNoticeApplies(record: DeliveryRecord, now: Date): Promise<boolean> {
	const requestId = record.dedupe_key.split(":")[1];
	const [request] = await db.select().from(accountDeletionRequestsTable).where(eq(accountDeletionRequestsTable.id, requestId)).limit(1);
	if (!request) return false;
	const boundary = record.payload.boundary;
	if (boundary === "recovery") return request.status === "recovered";
	if (request.status === "recovered" || request.status === "cancelled" || request.status === "purged") return false;
	if (boundary === "suspension" && request.requestedAt.getTime() === request.suspensionAt.getTime()) return false;
	if (boundary === "request") return true;
	return lifecycleCountdownApplies(request, now, boundary);
}

function lifecycleCountdownApplies(request: typeof accountDeletionRequestsTable.$inferSelect, now: Date, boundary: unknown) {
	// Do not send expired restore links or a backlog of obsolete countdowns.
	if (!request.purgeEligibleAt || now >= request.purgeEligibleAt) return false;
	const days = ({ "30d": 30, "7d": 7, "3d": 3, "1d": 1 } as Record<string, number>)[String(boundary)];
	return days === undefined || request.purgeEligibleAt.getTime() - now.getTime() > (days - 1) * 86400000;
}

async function agencyNoticeApplies(record: DeliveryRecord, now: Date): Promise<boolean> {
	const allocationId = record.dedupe_key.split(":")[1];
	const [allocation] = await db.select().from(agencyLicenseAllocationsTable).where(eq(agencyLicenseAllocationsTable.id, allocationId)).limit(1);
	if (!allocation) return false;
	record.payload.product = allocation.product;
	if (record.payload.boundary === "granted") return allocation.status === "active" || allocation.status === "removal_scheduled";
	if (record.payload.boundary === "ended") return allocation.status === "ended" && !(await hasContinuingBenefit(allocation.product === "runner" ? "runner" : "pro", allocation.creatorId, now));
	return agencyRemovalNoticeApplies(record, allocation, now);
}

async function agencyRemovalNoticeApplies(record: DeliveryRecord, allocation: typeof agencyLicenseAllocationsTable.$inferSelect, now: Date) {
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

const eligibilityChecks: Record<string, (record: DeliveryRecord, now: Date) => Promise<boolean>> = {
	badge: accountNoticeApplies,
	"account-access": accountNoticeApplies,
	"pro-membership": proMembershipNoticeApplies,
	billing: billingNoticeApplies,
	entitlement: entitlementNoticeApplies,
	"account-lifecycle": lifecycleNoticeApplies,
	"agency-allocation": agencyNoticeApplies,
};
export async function notificationStillApplies(record: DeliveryRecord, now: Date): Promise<boolean> {
	const check = eligibilityChecks[record.event_type];
	return check ? check(record, now) : true;
}
