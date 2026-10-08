import "server-only";
import { and, asc, eq, gt } from "drizzle-orm";
import { db, type QueryClient } from "@/db/client";
import { overlaysTable } from "@/db/schema";
import { authorizeTrustedCreatorOperation, type TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import type { Permission } from "@/auth/permissions";

/** Browser and OAuth lists share live read authority and owner-bound persistence. */
export async function listOverlayRecords(creatorId: string, options: { principal: TrustedCreatorPrincipal; permission?: "overlay:read" | "overlay-secret:read"; afterId?: string | (() => string); limit?: number }, client: QueryClient = db) {
	if (!options?.principal) throw new Error("AUTHENTICATION_REQUIRED");
	const authority = { creatorId, resourceOwnerId: creatorId, permission: options.permission ?? "overlay:read" };
	const decision = await authorizeTrustedCreatorOperation({ ...authority, principal: options.principal, client });
	if (!decision.allowed) throw new Error("ACCESS_DENIED");
	const afterId = typeof options.afterId === "function" ? options.afterId() : options.afterId;
	const query = client
		.select()
		.from(overlaysTable)
		.where(and(eq(overlaysTable.ownerId, creatorId), afterId ? gt(overlaysTable.id, afterId) : undefined));
	return options.limit === undefined ? query.execute() : query.orderBy(asc(overlaysTable.id)).limit(options.limit).execute();
}

/** Known-owner MCP reads authorize before lookup; browser ID reads retain their existing permission boundary. */
export async function readOverlayRecord(overlayId: string, options: { principal: TrustedCreatorPrincipal; creatorId?: string; permission?: Permission }, client: QueryClient = db) {
	if (!options?.principal) throw new Error("AUTHENTICATION_REQUIRED");
	const lookup = () =>
		client
			.select()
			.from(overlaysTable)
			.where(and(eq(overlaysTable.id, overlayId), options.creatorId ? eq(overlaysTable.ownerId, options.creatorId) : undefined))
			.limit(1)
			.execute();
	let overlay: typeof overlaysTable.$inferSelect | undefined;
	if (!options.creatorId) [overlay] = await lookup();
	const creatorId = options.creatorId ?? overlay?.ownerId;
	if (!creatorId) throw new Error("RESOURCE_UNAVAILABLE");
	const authority = { creatorId, resourceOwnerId: creatorId, permission: options.permission ?? "overlay:read" };
	const decision = await authorizeTrustedCreatorOperation({ ...authority, principal: options.principal, client });
	if (!decision.allowed) throw new Error("ACCESS_DENIED");
	if (!overlay) [overlay] = await lookup();
	if (!overlay) throw new Error("RESOURCE_UNAVAILABLE");
	return { overlay, decision };
}
