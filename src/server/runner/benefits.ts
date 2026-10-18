import "server-only";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { db, type QueryClient } from "@/db/client";
import { entitlementGrantsTable, agencyLicenseAllocationsTable, billingSubscriptionsTable, billingSubscriptionItemsTable } from "@/db/schema";
import { resolveUserEntitlements, resolveUserEntitlementsForUsers } from "@/app/lib/entitlements";
import { grantAccessEndsAt } from "@/server/entitlements/grant-period";
import { BillingProduct, Entitlement, EntitlementGrantSource, type AuthenticatedUser, type UserEntitlements } from "@types";
import type { RunnerBenefitInput } from "./capabilities";

export type RunnerBenefitOwner = Pick<AuthenticatedUser, "id" | "plan">;
type ProSource = NonNullable<RunnerBenefitInput["proSource"]>;
type RunnerSource = NonNullable<RunnerBenefitInput["runnerSource"]>;

/** Resolve only evidence for the authorized owners; never an operator's plan. */
async function resolveInputs(users: RunnerBenefitOwner[], resolved: Map<string, UserEntitlements>, client: QueryClient, now: Date) {
	const result = new Map<string, RunnerBenefitInput>();
	const paidIds = users.filter((user) => resolved.get(user.id)?.proAccess || resolved.get(user.id)?.runnerAccess).map((user) => user.id);
	for (const user of users) result.set(user.id, { proAccess: false, runnerAccess: false, validUntil: null });
	if (!paidIds.length) return result;
	const grants = await client
		.select()
		.from(entitlementGrantsTable)
		.where(and(or(inArray(entitlementGrantsTable.userId, paidIds), isNull(entitlementGrantsTable.userId)), inArray(entitlementGrantsTable.entitlement, [Entitlement.ProAccess, Entitlement.RunnerAccess])))
		.orderBy(asc(entitlementGrantsTable.id));
	const allocations = await client.select().from(agencyLicenseAllocationsTable).where(inArray(agencyLicenseAllocationsTable.creatorId, paidIds)).orderBy(asc(agencyLicenseAllocationsTable.id));
	const subscriptions = await client
		.select({ userId: billingSubscriptionsTable.userId, status: billingSubscriptionsTable.status, end: billingSubscriptionsTable.currentPeriodEnd })
		.from(billingSubscriptionsTable)
		.innerJoin(billingSubscriptionItemsTable, eq(billingSubscriptionItemsTable.subscriptionId, billingSubscriptionsTable.id))
		.where(and(inArray(billingSubscriptionsTable.userId, paidIds), eq(billingSubscriptionItemsTable.productKey, BillingProduct.Pro)))
		.orderBy(asc(billingSubscriptionsTable.id));
	const activeEnd = (end: Date | null) => end === null || end.getTime() > now.getTime();
	for (const user of users) {
		const raw = resolved.get(user.id)!;
		const pro: { end: Date | null; source: ProSource }[] = [];
		const runner: { end: Date | null; source: RunnerSource }[] = [];
		if (raw.isBillingPro) {
			const billing = subscriptions.filter((subscription) => subscription.userId === user.id);
			// Older/imported billing access may have no persisted period. Do not
			// invent a deadline; the signed snapshot horizon still requires refresh.
			if (!billing.length) pro.push({ end: null, source: "pro" });
			for (const subscription of billing) if (["active", "trialing", "past_due"].includes(subscription.status) && activeEnd(subscription.end)) pro.push({ end: subscription.end, source: "pro" });
		}
		for (const grant of grants) {
			if ((grant.userId !== null && grant.userId !== user.id) || grant.revokedAt || grant.startsAt > now) continue;
			const end = grantAccessEndsAt(grant);
			if (!activeEnd(end)) continue;
			if (raw.proAccess && grant.entitlement === Entitlement.ProAccess) pro.push({ end, source: grant.source === EntitlementGrantSource.ReverseTrial ? "trial" : "grant" });
			if (raw.runnerAccess && grant.entitlement === Entitlement.RunnerAccess) runner.push({ end, source: "legacy" });
		}
		for (const allocation of allocations) {
			if (allocation.creatorId !== user.id || !["active", "removal_scheduled"].includes(allocation.status) || allocation.effectiveAt > now || !activeEnd(allocation.endsAt)) continue;
			if (raw.proAccess && allocation.product === "creator_pro") pro.push({ end: allocation.endsAt, source: "agency" });
			if (raw.runnerAccess && allocation.product === "runner") runner.push({ end: allocation.endsAt, source: "agency" });
		}
		const ends = [...pro, ...runner].flatMap((source) => (source.end === null ? [] : [source.end.getTime()]));
		result.set(user.id, { proAccess: pro.length > 0, runnerAccess: runner.length > 0, validUntil: ends.length ? new Date(Math.min(...ends)) : null, ...(pro[0] ? { proSource: pro[0].source } : {}), ...(runner[0] ? { runnerSource: runner[0].source } : {}) });
	}
	return result;
}

export async function resolveRunnerBenefits(user: RunnerBenefitOwner, client: QueryClient = db, now = new Date()): Promise<RunnerBenefitInput> {
	const raw = await resolveUserEntitlements(user, client);
	return (await resolveInputs([user], new Map([[user.id, raw]]), client, now)).get(user.id)!;
}

export async function resolveRunnerBenefitsForUsers(users: RunnerBenefitOwner[], client?: QueryClient, now = new Date()): Promise<Map<string, RunnerBenefitInput>> {
	const raw = client ? new Map<string, UserEntitlements>() : await resolveUserEntitlementsForUsers(users);
	if (client) for (const user of users) raw.set(user.id, await resolveUserEntitlements(user, client));
	return resolveInputs(users, raw, client ?? db, now);
}
