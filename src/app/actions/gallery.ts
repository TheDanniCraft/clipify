"use server";

import { validateAuth } from "@actions/auth";
import { getPlaylistClipsForOwnerServer } from "@actions/database";
import { getCachedClipByOwner, getCachedClipsByOwner, getTwitchClipPlaybackUrl } from "@actions/twitch";
import { db } from "@/db/client";
import { editorsTable, galleriesTable, playlistsTable, usersTable } from "@/db/schema";
import { FREE_GALLERY_LIMIT, downgradeGalleryPatch, normalizeGalleryPatch, resolveLiveGalleryClips, type GalleryPatch } from "@lib/gallery";
import { canResolvePublicClipPlayback } from "@actions/rateLimit";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { Gallery, TwitchClip } from "@types";
import { resolveUserEntitlements } from "@lib/entitlements";
import { getFeatureAccess } from "@lib/featureAccess";

async function canEditOwner(userId: string, ownerId: string) {
	if (userId === ownerId) return true;
	const rows = await db
		.select({ userId: editorsTable.userId })
		.from(editorsTable)
		.where(and(eq(editorsTable.userId, ownerId), eq(editorsTable.editorId, userId)))
		.limit(1)
		.execute();
	return Boolean(rows[0]);
}

async function ownerIsPro(ownerId: string) {
	const rows = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, ownerId)).limit(1).execute();
	if (!rows[0]) return false;
	// validateAuth already resolves trials/grants for the active owner. Public reads intentionally
	// use the persisted plan; downgrade reconciliation removes Pro-only public configuration.
	return (await resolveUserEntitlements({ id: ownerId, plan: rows[0].plan })).effectivePlan === "pro";
}

async function requireGalleryAccess(galleryId: string) {
	const user = await validateAuth();
	if (!user) return null;
	const rows = await db.select().from(galleriesTable).where(eq(galleriesTable.id, galleryId)).limit(1).execute();
	const gallery = rows[0];
	if (!gallery || !(await canEditOwner(user.id, gallery.ownerId))) return null;
	return { user, gallery, isPro: user.id === gallery.ownerId ? getFeatureAccess(user, "gallery_advanced").allowed : await ownerIsPro(gallery.ownerId) };
}

async function validatePlaylist(ownerId: string, playlistId: string | null) {
	if (!playlistId) return false;
	const rows = await db
		.select({ id: playlistsTable.id })
		.from(playlistsTable)
		.where(and(eq(playlistsTable.id, playlistId), eq(playlistsTable.ownerId, ownerId)))
		.limit(1)
		.execute();
	return Boolean(rows[0]);
}

async function resolveClips(gallery: Gallery): Promise<TwitchClip[]> {
	if (gallery.source === "curated") {
		if (!gallery.playlistId) return [];
		return getPlaylistClipsForOwnerServer(gallery.ownerId, gallery.playlistId);
	}
	return resolveLiveGalleryClips(gallery, await getCachedClipsByOwner(gallery.ownerId));
}

export async function getAllGalleries(userId: string) {
	const user = await validateAuth();
	if (!user || user.id !== userId) return null;
	const editorRows = await db.select({ ownerId: editorsTable.userId }).from(editorsTable).where(eq(editorsTable.editorId, userId)).execute();
	const ownerIds = Array.from(new Set([userId, ...editorRows.map((row) => row.ownerId)]));
	return db.select().from(galleriesTable).where(inArray(galleriesTable.ownerId, ownerIds)).orderBy(asc(galleriesTable.createdAt)).execute();
}

export async function getGallery(galleryId: string) {
	const context = await requireGalleryAccess(galleryId);
	return context?.gallery ?? null;
}

export async function getGalleryPreview(galleryId: string) {
	const context = await requireGalleryAccess(galleryId);
	if (!context) return null;
	const owners = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, context.gallery.ownerId)).limit(1).execute();
	const effectiveGallery = context.isPro ? context.gallery : ({ ...context.gallery, ...normalizeGalleryPatch(context.gallery, {}, false), ...downgradeGalleryPatch(context.gallery, true) } as Gallery);
	return {
		gallery: effectiveGallery,
		clips: await resolveClips(effectiveGallery),
		ownerName: owners[0]?.username ?? "Clipify creator",
		showAttribution: !context.isPro,
		canUseAdvanced: Boolean(context.isPro),
	};
}

export async function getGalleryDraftPreview(galleryId: string, patch: GalleryPatch) {
	const context = await requireGalleryAccess(galleryId);
	if (!context) return null;
	const normalized = normalizeGalleryPatch(context.gallery, patch, Boolean(context.isPro));
	const effectiveGallery = { ...context.gallery, ...normalized } as Gallery;
	if (effectiveGallery.source === "curated" && effectiveGallery.playlistId && !(await validatePlaylist(effectiveGallery.ownerId, effectiveGallery.playlistId))) return null;
	return { clips: await resolveClips(effectiveGallery) };
}

export async function getGalleryPreviewPlayer(galleryId: string, clipId: string) {
	const bundle = await getGalleryPreview(galleryId);
	if (!bundle) return null;
	let clips = bundle.clips;
	let selectedIndex = clips.findIndex((clip) => clip.id === clipId);
	if (selectedIndex < 0) {
		const draftClip = await getCachedClipByOwner(bundle.gallery.ownerId, clipId);
		if (!draftClip) return null;
		clips = [draftClip];
		selectedIndex = 0;
	}
	let playbackUrl: string | null = null;
	try {
		const clip = clips[selectedIndex];
		playbackUrl = (await getTwitchClipPlaybackUrl(clip.id, clip.broadcaster_id)) ?? null;
	} catch {
		playbackUrl = null;
	}
	return { ...bundle, clips, selectedIndex, playbackUrl };
}

export async function createGallery(ownerId: string, name = "My clip gallery") {
	const user = await validateAuth();
	if (!user || !(await canEditOwner(user.id, ownerId))) return null;
	const isPro = user.id === ownerId ? getFeatureAccess(user, "multi_gallery").allowed : await ownerIsPro(ownerId);
	return db.transaction(async (tx) => {
		if (!isPro) {
			await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`clipify:free-gallery:${ownerId}`}, 0))`);
			const existing = await tx.select({ id: galleriesTable.id }).from(galleriesTable).where(eq(galleriesTable.ownerId, ownerId)).execute();
			if (existing.length >= FREE_GALLERY_LIMIT) throw new Error("Free plan allows one gallery");
		}
		const rows = await tx
			.insert(galleriesTable)
			.values({ ownerId, name: name.trim().slice(0, 120) || "My clip gallery" })
			.returning()
			.execute();
		return rows[0] ?? null;
	});
}

export async function saveGallery(galleryId: string, patch: GalleryPatch) {
	const context = await requireGalleryAccess(galleryId);
	if (!context) return null;
	const normalized = normalizeGalleryPatch(context.gallery, patch, Boolean(context.isPro));
	if (normalized.source === "curated" && normalized.playlistId && !(await validatePlaylist(context.gallery.ownerId, normalized.playlistId))) {
		throw new Error("The selected playlist must belong to the gallery owner");
	}
	if (normalized.published && normalized.source === "curated" && !normalized.playlistId) {
		throw new Error("Choose a playlist before publishing a curated gallery");
	}
	const rows = await db
		.update(galleriesTable)
		.set({ ...normalized, updatedAt: new Date() })
		.where(eq(galleriesTable.id, galleryId))
		.returning()
		.execute();
	revalidatePath(`/dashboard/galleries/${galleryId}`);
	revalidatePath(`/gallery/${galleryId}`);
	return rows[0] ?? null;
}

export async function deleteGallery(galleryId: string) {
	const context = await requireGalleryAccess(galleryId);
	if (!context) return false;
	await db.delete(galleriesTable).where(eq(galleriesTable.id, galleryId)).execute();
	revalidatePath("/dashboard");
	return true;
}

export async function getPublicGallery(galleryId: string) {
	const rows = await db
		.select({ gallery: galleriesTable, owner: { id: usersTable.id, username: usersTable.username, avatar: usersTable.avatar, disabled: usersTable.disabled, plan: usersTable.plan } })
		.from(galleriesTable)
		.innerJoin(usersTable, eq(galleriesTable.ownerId, usersTable.id))
		.where(eq(galleriesTable.id, galleryId))
		.limit(1)
		.execute();
	const row = rows[0];
	if (!row || !row.gallery.published || row.owner.disabled) return null;
	const isPro = (await resolveUserEntitlements({ id: row.owner.id, plan: row.owner.plan })).effectivePlan === "pro";
	const effectiveGallery = isPro ? row.gallery : ({ ...row.gallery, ...normalizeGalleryPatch(row.gallery, {}, false), ...downgradeGalleryPatch(row.gallery, true) } as Gallery);
	return { gallery: effectiveGallery, owner: row.owner, clips: await resolveClips(effectiveGallery), showAttribution: !isPro };
}

export async function getPublicGalleryPlayer(galleryId: string, clipId: string) {
	const bundle = await getPublicGallery(galleryId);
	if (!bundle) return null;
	const index = bundle.clips.findIndex((clip) => clip.id === clipId);
	if (index < 0) return null;
	const clip = bundle.clips[index];
	let playbackUrl: string | null = null;
	try {
		playbackUrl = (await getTwitchClipPlaybackUrl(clip.id, clip.broadcaster_id, { authorizeFetch: () => canResolvePublicClipPlayback(bundle.owner.id) })) ?? null;
	} catch {
		playbackUrl = null;
	}
	return { ...bundle, selectedIndex: index, playbackUrl };
}
