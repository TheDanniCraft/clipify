import "server-only";
import { CreationQuotaError } from "./quota";
import { browserOverlayPatchSchema } from "./overlay-configuration";
import { randomUUID } from "node:crypto";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { createOverlayForPrincipal, deleteOverlay, updateOverlayRecord, updateOwnerOverlayVolume } from "./overlays";
import type { Overlay } from "@types";
import { db } from "@/db/client";
import { overlaysTable } from "@/db/schema";
import { eq } from "drizzle-orm";
/** Browser action adapter preserves its result while sharing backend quota enforcement. */
export async function createBrowserOverlay(creatorId: string): Promise<Overlay | null> {
	const principal = await getVerifiedSessionPrincipal();
	if (!principal) return null;
	try {
		const overlay = await createOverlayForPrincipal(principal, { creatorId, name: "New Overlay", retryKey: randomUUID() });
		if (!("ownerId" in overlay)) throw new Error("SERVICE_UNAVAILABLE");
		return overlay;
	} catch (error) {
		if (error instanceof Error && ["PLAN_LIMIT_REACHED", "ACCESS_DENIED"].includes(error.message)) return null;
		throw new Error("Failed to create overlay");
	}
}

/** Return current backend quota details without disclosing private resource state. */
export async function createBrowserOverlayWithFeedback(creatorId: string, requestHeaders?: Headers): Promise<{ overlay: Overlay | null; error: { code: "PLAN_LIMIT_REACHED"; usage: number; limit: number } | { code: "ACCESS_DENIED" | "SERVICE_UNAVAILABLE" } | null }> {
	const principal = await getVerifiedSessionPrincipal(requestHeaders);
	if (!principal) return { overlay: null, error: { code: "ACCESS_DENIED" } };
	try {
		const overlay = await createOverlayForPrincipal(principal, { creatorId, name: "New Overlay", retryKey: randomUUID() });
		if (!("ownerId" in overlay)) return { overlay: null, error: { code: "SERVICE_UNAVAILABLE" } };
		return { overlay, error: null };
	} catch (error) {
		if (error instanceof CreationQuotaError) return { overlay: null, error: { code: "PLAN_LIMIT_REACHED", usage: error.usage, limit: error.limit } };
		return { overlay: null, error: { code: error instanceof Error && error.message === "ACCESS_DENIED" ? "ACCESS_DENIED" : "SERVICE_UNAVAILABLE" } };
	}
}

/** Delete only the overlay revision the verified browser session actually read. */
export async function deleteBrowserOverlay(overlayId: string, expectedRevision?: number, requestHeaders?: Headers): Promise<boolean> {
	if (!Number.isSafeInteger(expectedRevision) || (expectedRevision ?? 0) < 1) return false;
	try {
		const principal = await getVerifiedSessionPrincipal(requestHeaders);
		if (!principal) return false;
		const [current] = await db.select().from(overlaysTable).where(eq(overlaysTable.id, overlayId)).limit(1);
		if (!current) return false;
		const result = await deleteOverlay(principal, { creatorId: current.ownerId, overlayId, expectedRevision });
		return result.deletedId === overlayId;
	} catch {
		return false;
	}
}

/** Session identity and owner are derived on the server, never from the patch. */
export async function saveBrowserOverlay(overlayId: string, patch: unknown, expectedRevision?: number, requestHeaders?: Headers): Promise<Overlay | null> {
	if (!Number.isSafeInteger(expectedRevision) || (expectedRevision ?? 0) < 1) return null;
	try {
		const principal = await getVerifiedSessionPrincipal(requestHeaders);
		if (!principal) return null;
		const [current] = await db.select().from(overlaysTable).where(eq(overlaysTable.id, overlayId)).limit(1);
		if (!current) return null;
		const parsed = browserOverlayPatchSchema.safeParse(patch);
		if (!parsed.success) return null;
		// Full editor snapshots include unchanged paid settings. Only actual changes
		// reach the shared policy; a changed paid setting still requires current Pro.
		const changed = Object.fromEntries(Object.entries(parsed.data).filter(([key, value]) => value !== undefined && JSON.stringify(value) !== JSON.stringify(current[key as keyof Overlay])));
		return await updateOverlayRecord(principal, { creatorId: current.ownerId, overlayId, patch: Object.keys(changed).length ? changed : { name: current.name }, expectedRevision });
	} catch {
		return null;
	}
}

/** Owner-wide volume always derives a current session and checks the owner policy. */
export async function setBrowserOverlayVolume(creatorId: string, volume: number, requestHeaders?: Headers): Promise<number | null> {
	try {
		const principal = await getVerifiedSessionPrincipal(requestHeaders);
		if (!principal) return null;
		return await updateOwnerOverlayVolume(principal, creatorId, volume);
	} catch {
		return null;
	}
}
