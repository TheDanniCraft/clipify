import { gt, isNull, or, sql, type SQL } from "drizzle-orm";
import { entitlementGrantsTable } from "@/db/schema";

export const PARTNER_PRO_GRACE_DAYS = 7;
/** The partnership ends on endsAt; only its Pro benefit receives the transition period. */
export function grantAccessEndsAt(grant: { source: string; entitlement: string; endsAt: Date | null }) {
	if (!grant.endsAt) return null;
	return new Date(grant.endsAt.getTime() + (grant.source === "partner" && grant.entitlement === "pro_access" ? PARTNER_PRO_GRACE_DAYS * 86400000 : 0));
}
export function grantAccessNotExpired(now: Date | SQL) {
	return or(isNull(entitlementGrantsTable.endsAt), gt(entitlementGrantsTable.endsAt, now), sql`(${entitlementGrantsTable.source} = 'partner' and ${entitlementGrantsTable.entitlement} = 'pro_access' and ${entitlementGrantsTable.endsAt} + interval '7 days' > ${now})`);
}
