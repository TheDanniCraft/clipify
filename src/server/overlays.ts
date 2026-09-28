import "server-only";

import { db } from "@/db/client";
import { creatorAccountsTable, editorsTable, overlaysTable, usersTable } from "@/db/schema";
import { validateAuth } from "@actions/auth";
import { AuthenticatedUser, Overlay } from "@types";
import { and, eq } from "drizzle-orm";
import { evaluateOverlayRuntimeAccess, type OverlayRuntimeChannel, type OverlayRuntimeDecision } from "@/server/overlay-runtime";

export async function canEditOwnerInternal(editorId: string, ownerId: string): Promise<boolean> {
	if (editorId === ownerId) return true;

	const editorRows = await db
		.select()
		.from(editorsTable)
		.where(and(eq(editorsTable.editorId, editorId), eq(editorsTable.userId, ownerId)))
		.limit(1)
		.execute();

	return !!editorRows?.[0];
}

export async function requireOverlayAccessInternal(overlayId: string): Promise<{ user: AuthenticatedUser; overlay: Overlay } | null> {
	const user = await validateAuth(false);
	if (!user) {
		console.warn("Unauthenticated request");
		return null;
	}

	const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.id, overlayId)).limit(1).execute();
	const overlay = overlays[0];
	if (!overlay) return null;

	if (!(await canEditOwnerInternal(user.id, overlay.ownerId))) {
		console.warn(`Unauthorized overlay access for user id: ${user.id} on overlay id: ${overlayId}`);
		return null;
	}

	return { user, overlay };
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
	const accountRows = (await db.select({ status: creatorAccountsTable.status }).from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, overlay.ownerId)).limit(1).execute()) ?? [];
	const accountStatus = accountRows[0]?.status;
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
