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

type BenefitSource<T extends string> = { end: Date | null; source: T };
type BenefitSources = { pro: BenefitSource<ProSource>[]; runner: BenefitSource<RunnerSource>[] };
type Grant = typeof entitlementGrantsTable.$inferSelect;
type Allocation = typeof agencyLicenseAllocationsTable.$inferSelect;
type Subscription = { userId: string; status: string; end: Date | null };

function accessPeriodActive(end: Date | null, now: Date) {
	return end === null || end.getTime() > now.getTime();
}
function billingSources(userId: string, raw: UserEntitlements, subscriptions: Subscription[], now: Date): BenefitSource<ProSource>[] {
	if (!raw.isBillingPro) return [];
	const billing = subscriptions.filter((row) => row.userId === userId);
	// Imported billing access may have no period; signed snapshots still require refresh.
	if (!billing.length) return [{ end: null, source: "pro" }];
	return billing.filter((row) => ["active", "trialing", "past_due"].includes(row.status) && accessPeriodActive(row.end, now)).map((row) => ({ end: row.end, source: "pro" }));
}
function grantApplies(grant: Grant, userId: string, now: Date) {
	return (grant.userId === null || grant.userId === userId) && !grant.revokedAt && grant.startsAt <= now && accessPeriodActive(grantAccessEndsAt(grant), now);
}
function grantSources(userId: string, raw: UserEntitlements, grants: Grant[], now: Date): BenefitSources {
	const sources: BenefitSources = { pro: [], runner: [] };
	for (const grant of grants) {
		if (!grantApplies(grant, userId, now)) continue;
		const end = grantAccessEndsAt(grant);
		if (raw.proAccess && grant.entitlement === Entitlement.ProAccess) sources.pro.push({ end, source: grant.source === EntitlementGrantSource.ReverseTrial ? "trial" : "grant" });
		if (raw.runnerAccess && grant.entitlement === Entitlement.RunnerAccess) sources.runner.push({ end, source: "legacy" });
	}
	return sources;
}
function allocationApplies(allocation: Allocation, userId: string, now: Date) {
	return allocation.creatorId === userId && ["active", "removal_scheduled"].includes(allocation.status) && allocation.effectiveAt <= now && accessPeriodActive(allocation.endsAt, now);
}
function agencySources(userId: string, raw: UserEntitlements, allocations: Allocation[], now: Date): BenefitSources {
	const sources: BenefitSources = { pro: [], runner: [] };
	for (const allocation of allocations) {
		if (!allocationApplies(allocation, userId, now)) continue;
		if (raw.proAccess && allocation.product === "creator_pro") sources.pro.push({ end: allocation.endsAt, source: "agency" });
		if (raw.runnerAccess && allocation.product === "runner") sources.runner.push({ end: allocation.endsAt, source: "agency" });
	}
	return sources;
}
function benefitFromSources(pro: BenefitSource<ProSource>[], runner: BenefitSource<RunnerSource>[]): RunnerBenefitInput {
	const ends = [...pro, ...runner].flatMap((source) => (source.end === null ? [] : [source.end.getTime()]));
	return { proAccess: pro.length > 0, runnerAccess: runner.length > 0, validUntil: ends.length ? new Date(Math.min(...ends)) : null, ...(pro[0] ? { proSource: pro[0].source } : {}), ...(runner[0] ? { runnerSource: runner[0].source } : {}) };
}

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
	for (const user of users) {
		const raw = resolved.get(user.id)!;
		const grantsForOwner = grantSources(user.id, raw, grants, now);
		const agency = agencySources(user.id, raw, allocations, now);
		result.set(user.id, benefitFromSources([...billingSources(user.id, raw, subscriptions, now), ...grantsForOwner.pro, ...agency.pro], [...grantsForOwner.runner, ...agency.runner]));
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
