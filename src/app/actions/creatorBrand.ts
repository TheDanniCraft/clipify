"use server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { userContentStatesTable, overlaysTable } from "@/db/schema";
import { authorizeCreatorOperation } from "@/auth/authorize-operation";
import { validateBrandFont } from "@/server/brand-font-render";
import { consumeAppRateLimit } from "@/server/rate-limit";
import { resolveUserEntitlements } from "@lib/entitlements";
import { creatorBrandSchema } from "@lib/overlayMetadata";
import { CREATOR_BRAND_KEY, readCreatorBrand } from "@/server/creator-brand";
const validId = (value: string) => typeof value === "string" && value.length > 0 && value.length <= 200;
export async function getCreatorBrand(creatorId: string) {
	if (!validId(creatorId)) return { ok: false as const, code: "INVALID_INPUT" };
	const grant = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:read" });
	if (!grant.allowed) return { ok: false as const, code: grant.code };
	try {
		const [stored, entitlements] = await Promise.all([readCreatorBrand(creatorId), resolveUserEntitlements(grant.creator)]);
		const canEdit = grant.accessPath === "owner" || (await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:update" })).allowed;
		return { ok: true as const, ...stored, canEdit, canRemoveWatermark: entitlements.proAccess };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
export async function saveCreatorBrand(creatorId: string, input: unknown, expectedRevision: number) {
	const parsed = creatorBrandSchema.safeParse(input);
	if (!validId(creatorId) || !parsed.success || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return { ok: false as const, code: "INVALID_INPUT" };
	const grant = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:update" });
	if (!grant.allowed) return { ok: false as const, code: grant.code };
	try {
		if (!parsed.data.watermark && !(await resolveUserEntitlements(grant.creator)).proAccess) return { ok: false as const, code: "PRO_REQUIRED" };
		if (!(await consumeAppRateLimit({ key: "brand-save", points: 30, duration: 60, identifier: creatorId })).success) return { ok: false as const, code: "RATE_LIMITED" };
		try {
			await validateBrandFont(parsed.data, AbortSignal.timeout(15000));
		} catch {
			return { ok: false as const, code: "FONT_UNAVAILABLE" };
		}
		const revision = expectedRevision + 1;
		const state = JSON.stringify({ brand: parsed.data, revision });
		// A stale first save must not create a fresh row after a deleted/conflicting revision.
		if (expectedRevision > 0 && (await readCreatorBrand(creatorId)).revision !== expectedRevision) return { ok: false as const, code: "CONFLICT" };
		const rows = await db
			.insert(userContentStatesTable)
			.values({ userId: creatorId, contentKey: CREATOR_BRAND_KEY, state, updatedAt: new Date() })
			.onConflictDoUpdate({ target: [userContentStatesTable.userId, userContentStatesTable.contentKey], set: { state, updatedAt: new Date() }, setWhere: sql`(${userContentStatesTable.state}::jsonb->>'revision')::integer = ${expectedRevision}` })
			.returning({ state: userContentStatesTable.state });
		return rows.length ? { ok: true as const, brand: parsed.data, revision } : { ok: false as const, code: "CONFLICT" };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
export async function getBrandOverlaySources(creatorId: string) {
	if (!validId(creatorId)) return { ok: false as const, code: "INVALID_INPUT" };
	const grant = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "overlay:read" });
	if (!grant.allowed) return { ok: false as const, code: grant.code };
	try {
		const overlays = await db
			.select({ id: overlaysTable.id, name: overlaysTable.name, progressBarStartColor: overlaysTable.progressBarStartColor, progressBarEndColor: overlaysTable.progressBarEndColor, themeFontFamily: overlaysTable.themeFontFamily, themeTextColor: overlaysTable.themeTextColor, themeBackgroundColor: overlaysTable.themeBackgroundColor, themeAccentColor: overlaysTable.themeAccentColor, borderSize: overlaysTable.borderSize, borderRadius: overlaysTable.borderRadius })
			.from(overlaysTable)
			.where(eq(overlaysTable.ownerId, creatorId))
			.limit(100)
			.execute();
		return { ok: true as const, overlays };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
