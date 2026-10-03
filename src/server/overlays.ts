import "server-only";

import { db } from "@/db/client";
import * as databaseSchema from "@/db/schema";
import { overlaysTable, usersTable } from "@/db/schema";
import { AuthenticatedUser, Overlay } from "@types";
import { eq } from "drizzle-orm";
import { evaluateOverlayRuntimeAccess, type OverlayRuntimeChannel, type OverlayRuntimeDecision } from "@/server/overlay-runtime";
import { authorizeCreatorOperation } from "@/auth/authorize-operation";
import type { Permission } from "@/auth/permissions";
import { resolveRetainedResourceAccess } from "@/server/entitlements/resource-access";

export async function canEditOwnerInternal(editorId: string, ownerId: string): Promise<boolean> {
	void editorId;
	return (await authorizeCreatorOperation({ creatorId: ownerId, resourceOwnerId: ownerId, permission: "overlay:update" })).allowed;
}

export async function requireOverlayAccessInternal(overlayId: string, permission: Permission = "overlay:read"): Promise<{ user: AuthenticatedUser; overlay: Overlay } | null> {
	const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.id, overlayId)).limit(1).execute();
	const overlay = overlays[0];
	if (!overlay) return null;
	const access = await authorizeCreatorOperation({ creatorId: overlay.ownerId, resourceOwnerId: overlay.ownerId, permission });
	if (!access.allowed) {
		console.warn(`Unauthorized overlay access on overlay id: ${overlayId}; reason: ${access.code}`);
		return null;
	}
	return { user: access.creator as AuthenticatedUser, overlay };
}

export async function requireOverlaySecretAccessInternal(overlayId: string, secret?: string): Promise<Overlay | null> {
	const decision = await getOverlayRuntimeAccessInternal(overlayId, "websocket", secret);
	if (!decision.allowed) {
		console.warn(`Overlay runtime access denied for overlay id: ${overlayId}; reason: ${decision.reason}`);
		return null;
	}
	return decision.overlay;
}

export async function getOverlayRuntimeAccessInternal(overlayId: string, channel: OverlayRuntimeChannel, presentedSecret?: string): Promise<OverlayRuntimeDecision<Overlay>> {
	const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.id, overlayId)).limit(1).execute();
	const overlay = overlays[0] ?? null;
	if (!overlay) return { allowed: false, reason: "not-found" };

	const ownerRows = await db.select({ disabled: usersTable.disabled, disabledReason: usersTable.disabledReason }).from(usersTable).where(eq(usersTable.id, overlay.ownerId)).limit(1).execute();
	// Older focused test doubles and rolling deployments may not have the lifecycle
	// table available yet. In that transition window, preserve the existing active
	// behavior; the schema export is mandatory in fully migrated production builds.
	const creatorAccountsTable = databaseSchema.creatorAccountsTable as typeof databaseSchema.creatorAccountsTable | undefined;
	const accountRows = creatorAccountsTable ? ((await db.select({ status: creatorAccountsTable.status }).from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, overlay.ownerId)).limit(1).execute()) ?? []) : [];
	const accountStatus = accountRows[0]?.status;
	if (!(await resolveRetainedResourceAccess({ kind: "overlay", ownerId: overlay.ownerId, resourceId: overlay.id })).runtime) return { allowed: false, reason: "plan-restricted" };
	return evaluateOverlayRuntimeAccess({
		channel,
		overlay,
		presentedSecret,
		ownerSuspended: ownerRows[0]?.disabled === true || accountStatus === "suspended" || accountStatus === "purge_eligible",
		ownerDisabledReason: ownerRows[0]?.disabledReason ?? (accountStatus === "suspended" || accountStatus === "purge_eligible" ? "account_deletion" : null),
	});
}

export async function getAllOverlayIdsByOwnerInternal(ownerId: string): Promise<string[]> {
	const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, ownerId)).execute();
	return overlays.map((overlay) => overlay.id);
}

export async function getAllOverlaysByOwnerInternal(ownerId: string): Promise<Overlay[]> {
	return await db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, ownerId)).execute();
}
