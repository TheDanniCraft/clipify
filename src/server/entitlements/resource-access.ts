import "server-only";

import { asc, eq } from "drizzle-orm";
import { db, type QueryClient } from "@/db/client";
import { galleriesTable, overlaysTable, playlistsTable, usersTable } from "@/db/schema";
import { resolveUserEntitlements } from "@lib/entitlements";
import { decideRetainedResourceAccess, type RetainedResourceAccess } from "./resource-policy";

export type RetainedResourceKind = "overlay" | "playlist" | "gallery";

async function firstFreeResourceIds(kind: RetainedResourceKind, ownerId: string, client: QueryClient) {
	switch (kind) {
		case "overlay":
			return (await client.select({ id: overlaysTable.id }).from(overlaysTable).where(eq(overlaysTable.ownerId, ownerId)).orderBy(asc(overlaysTable.createdAt), asc(overlaysTable.id)).limit(1).execute()).map((row) => row.id);
		case "playlist":
			return (await client.select({ id: playlistsTable.id }).from(playlistsTable).where(eq(playlistsTable.ownerId, ownerId)).orderBy(asc(playlistsTable.createdAt), asc(playlistsTable.id)).limit(1).execute()).map((row) => row.id);
		case "gallery":
			return (await client.select({ id: galleriesTable.id }).from(galleriesTable).where(eq(galleriesTable.ownerId, ownerId)).orderBy(asc(galleriesTable.createdAt), asc(galleriesTable.id)).limit(1).execute()).map((row) => row.id);
	}
}

export async function resolveRetainedResourceAccess(input: { kind: RetainedResourceKind; ownerId: string; resourceId: string; effectivePlan?: "free" | "pro"; client?: QueryClient }): Promise<RetainedResourceAccess> {
	const client = input.client ?? db;
	let effectivePlan = input.effectivePlan;
	if (!effectivePlan) {
		const [owner] = await client.select({ id: usersTable.id, plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, input.ownerId)).limit(1).execute();
		if (!owner) return decideRetainedResourceAccess({ effectivePlan: "free", resourceId: input.resourceId, freeResourceIds: [] });
		effectivePlan = (await resolveUserEntitlements(owner)).effectivePlan;
	}
	if (effectivePlan === "pro") return decideRetainedResourceAccess({ effectivePlan, resourceId: input.resourceId, freeResourceIds: [] });
	return decideRetainedResourceAccess({ effectivePlan, resourceId: input.resourceId, freeResourceIds: await firstFreeResourceIds(input.kind, input.ownerId, client) });
}

export { decideRetainedResourceAccess } from "./resource-policy";
