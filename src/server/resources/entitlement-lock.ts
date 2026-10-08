import "server-only";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import type { TransactionClient } from "@/db/client";
import { entitlementGrantsTable, agencyLicenseAllocationsTable } from "@/db/schema";
import { Entitlement } from "@types";

/** Call after creator/owner and applicable agency link locks, before reading the effective plan. */
export async function lockOwnerProEntitlements(creatorId: string, client: TransactionClient) {
	await client
		.select({ id: entitlementGrantsTable.id })
		.from(entitlementGrantsTable)
		.where(and(eq(entitlementGrantsTable.entitlement, Entitlement.ProAccess), or(eq(entitlementGrantsTable.userId, creatorId), isNull(entitlementGrantsTable.userId))))
		.orderBy(asc(entitlementGrantsTable.id))
		.for("share");
	await client
		.select({ id: agencyLicenseAllocationsTable.id })
		.from(agencyLicenseAllocationsTable)
		.where(and(eq(agencyLicenseAllocationsTable.creatorId, creatorId), eq(agencyLicenseAllocationsTable.product, "creator_pro")))
		.orderBy(asc(agencyLicenseAllocationsTable.id))
		.for("share");
}
