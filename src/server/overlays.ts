import "server-only";

import { db } from "@/db/client";
import { editorsTable, overlaysTable, usersTable } from "@/db/schema";
import { validateAuth } from "@actions/auth";
import { AuthenticatedUser, Overlay } from "@types";
import { and, eq } from "drizzle-orm";

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
	if (!secret) {
		console.warn(`Missing overlay secret for overlay id: ${overlayId}`);
		return null;
	}

	const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.id, overlayId)).limit(1).execute();
	const overlay = overlays[0];
	if (!overlay || !overlay.secret || overlay.secret !== secret) {
		console.warn(`Invalid overlay secret for overlay id: ${overlayId}`);
		return null;
	}
	const ownerRows = await db.select({ disabled: usersTable.disabled }).from(usersTable).where(eq(usersTable.id, overlay.ownerId)).limit(1).execute();
	if (ownerRows[0]?.disabled) return null;

	return overlay;
}

export async function getAllOverlayIdsByOwnerInternal(ownerId: string): Promise<string[]> {
	const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, ownerId)).execute();
	return overlays.map((overlay) => overlay.id);
}

export async function getAllOverlaysByOwnerInternal(ownerId: string): Promise<Overlay[]> {
	return await db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, ownerId)).execute();
}
