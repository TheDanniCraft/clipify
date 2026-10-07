import "server-only";
import { z } from "zod";
import { and, eq, asc, gt } from "drizzle-orm";
import { galleriesTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import type { DatabaseClient } from "@/db/client";
import { galleryFields } from "@/server/mcp/workflows/schemas";
import { workflowOperation, type WorkflowContext } from "./workflow";
import { encodePageCursor, decodePageCursor } from "@/server/mcp/pagination";
const output = z.object({ ...galleryFields, id: z.uuid(), ownerId: z.string().min(1), name: z.string().min(1).max(120), published: z.boolean(), configurationRevision: z.number().int().positive(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
export function galleryDto(row: typeof galleriesTable.$inferSelect) {
	const { ownerId, ...value } = output.parse({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), liveCustomStart: row.liveCustomStart?.toISOString() ?? null, liveCustomEnd: row.liveCustomEnd?.toISOString() ?? null });
	return { ...value, creatorId: ownerId };
}
async function galleryRecord(context: WorkflowContext, galleryId: string, lock = false) {
	const query = context.tx
		.select()
		.from(galleriesTable)
		.where(and(eq(galleriesTable.id, galleryId), eq(galleriesTable.ownerId, context.creatorId)))
		.limit(1);
	const [row] = await (lock ? query.for("update") : query);
	if (!row) throw new Error("RESOURCE_UNAVAILABLE");
	return row;
}
export function listGalleries(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"list_galleries",
		input,
		async (input, { tx }) => {
			const context = `${principal.grantId}:${principal.generation}:galleries:${input.creatorId}`;
			const after = input.cursor ? decodePageCursor(input.cursor, context) : undefined;
			if (after && !z.uuid().safeParse(after).success) throw new Error("INVALID_INPUT");
			const rows = await tx
				.select()
				.from(galleriesTable)
				.where(and(eq(galleriesTable.ownerId, input.creatorId), after ? gt(galleriesTable.id, after) : undefined))
				.orderBy(asc(galleriesTable.id))
				.limit(input.limit + 1);
			const items = rows.slice(0, input.limit).map(galleryDto);
			return { items, nextCursor: rows.length > input.limit ? encodePageCursor(items.at(-1)!.id, context) : null };
		},
		client,
	);
}

import { resolveRetainedResourceAccess } from "@/server/entitlements/resource-access";
export function getGalleryForPrincipal(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"get_gallery",
		input,
		async (input, context) => {
			const row = await galleryRecord(context, input.galleryId);
			const access = await resolveRetainedResourceAccess({ kind: "gallery", ownerId: input.creatorId, resourceId: row.id, client: context.tx });
			return { gallery: galleryDto(row), capabilities: { advanced: context.pro, update: access.update, runtime: access.runtime } };
		},
		client,
	);
}

import { workflowRetry } from "./workflow";
import { lockGalleryCreationQuota } from "./gallery-quota-lock";
import { CreationQuotaError } from "./quota";
import { FREE_GALLERY_LIMIT } from "@lib/gallery";
export function createGalleryForPrincipal(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"create_gallery",
		input,
		async (input, context) =>
			workflowRetry(context, "create_gallery", input, async () => {
				if (!context.pro) {
					await lockGalleryCreationQuota(context.tx, input.creatorId);
					const rows = await context.tx.select({ id: galleriesTable.id }).from(galleriesTable).where(eq(galleriesTable.ownerId, input.creatorId));
					if (rows.length >= FREE_GALLERY_LIMIT) throw new CreationQuotaError(rows.length, FREE_GALLERY_LIMIT);
				}
				const [row] = await context.tx.insert(galleriesTable).values({ ownerId: input.creatorId, name: input.name }).returning();
				return galleryDto(row);
			}),
		client,
	);
}

import { playlistsTable } from "@/db/schema";
import { normalizeGalleryUpdatePatch, type GalleryPatch } from "@lib/gallery";
import { nextConfigurationRevision } from "./revisions";
const paidFields = new Set(["includeCategories", "excludeCategories", "minimumViews", "minimumDuration", "maximumDuration", "titleBlacklist", "creatorAllowlist", "creatorBlocklist", "theme", "accentColor", "backgroundMode", "backgroundColor", "cardSurfaceColor", "textColor", "cardRadius", "gap", "thumbnailTreatment", "modalBackdrop", "desktopModalWidth"]);
async function persistGalleryPatch(context: WorkflowContext, galleryId: string, expectedRevision: number, patch: GalleryPatch) {
	const current = await galleryRecord(context, galleryId, true);
	const revision = nextConfigurationRevision(current.configurationRevision, expectedRevision);
	const access = await resolveRetainedResourceAccess({ kind: "gallery", ownerId: context.creatorId, resourceId: current.id, client: context.tx });
	if (!access.update) throw new Error("FEATURE_RESTRICTED");
	if (!context.pro) {
		for (const [key, value] of Object.entries(patch)) if (paidFields.has(key) && JSON.stringify(value) !== JSON.stringify(current[key as keyof typeof current])) throw new Error("FEATURE_RESTRICTED");
		if (patch.liveSort === "stable_random" || patch.liveTimeWindow === "custom" || patch.liveCustomStart || patch.liveCustomEnd || (patch.liveResultLimit ?? 0) > 50) throw new Error("FEATURE_RESTRICTED");
	}
	const normalized = normalizeGalleryUpdatePatch(current, patch, context.pro);
	if (normalized.source === "curated" && normalized.playlistId) {
		const [playlist] = await context.tx
			.select({ id: playlistsTable.id })
			.from(playlistsTable)
			.where(and(eq(playlistsTable.id, normalized.playlistId), eq(playlistsTable.ownerId, context.creatorId)))
			.limit(1);
		if (!playlist) throw new Error("RESOURCE_UNAVAILABLE");
	}
	if (normalized.published && normalized.source === "curated" && !normalized.playlistId) throw new Error("INVALID_INPUT");
	context.assertCurrent();
	const [saved] = await context.tx
		.update(galleriesTable)
		.set({ ...normalized, configurationRevision: revision, updatedAt: new Date() })
		.where(and(eq(galleriesTable.id, current.id), eq(galleriesTable.ownerId, context.creatorId)))
		.returning();
	return galleryDto(saved);
}
export function updateGalleryForPrincipal(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"update_gallery",
		input,
		(input, context) => {
			const { liveCustomStart, liveCustomEnd, ...fields } = input.patch;
			const patch: GalleryPatch = { ...fields, ...(liveCustomStart !== undefined ? { liveCustomStart: liveCustomStart ? new Date(liveCustomStart) : null } : {}), ...(liveCustomEnd !== undefined ? { liveCustomEnd: liveCustomEnd ? new Date(liveCustomEnd) : null } : {}) };
			return persistGalleryPatch(context, input.galleryId, input.expectedRevision, patch);
		},
		client,
	);
}

export function deleteGalleryForPrincipal(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"delete_gallery",
		input,
		async (input, context) => {
			const row = await galleryRecord(context, input.galleryId, true);
			nextConfigurationRevision(row.configurationRevision, input.expectedRevision);
			await context.tx.delete(galleriesTable).where(and(eq(galleriesTable.id, row.id), eq(galleriesTable.ownerId, input.creatorId)));
			return { galleryId: row.id, deleted: true };
		},
		client,
	);
}

import { authorizeTrustedCreatorOperation } from "@/auth/authorize-operation";
export function publishGalleryForPrincipal(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"publish_gallery",
		input,
		async (input, context) => {
			if (!(await authorizeTrustedCreatorOperation({ principal, creatorId: input.creatorId, permission: "gallery:update", client: context.tx })).allowed) throw new Error("ACCESS_DENIED");
			return persistGalleryPatch(context, input.galleryId, input.expectedRevision, { published: input.published });
		},
		client,
	);
}

import { getMcpConfiguration } from "@/server/mcp/config";
import { CLIPIFY_ELEMENTS_HELP_URL } from "@lib/constants";
export function getGalleryEmbed(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"get_gallery_embed",
		input,
		async (input, context) => {
			const row = await galleryRecord(context, input.galleryId);
			const access = await resolveRetainedResourceAccess({ kind: "gallery", ownerId: input.creatorId, resourceId: row.id, client: context.tx });
			const origin = getMcpConfiguration().origin;
			const scriptTag = `<script type="module" src="${origin}/elements/v1/clipify.js"></script>`;
			const element = `<clipify-gallery gallery-id="${row.id}"></clipify-gallery>`;
			return { galleryId: row.id, published: row.published, ready: row.published && access.runtime, scriptTag, element, html: `${scriptTag}\n${element}`, installationGuide: CLIPIFY_ELEMENTS_HELP_URL, dashboardPreviewUrl: `${origin}/dashboard/galleries/${row.id}`, previewRequiresBrowserSignIn: true };
		},
		client,
	);
}

import { normalizeGalleryPatch, downgradeGalleryPatch, resolveLiveGalleryClips } from "@lib/gallery";
import { getPlaylistRuntimeClipsForOwnerServer } from "@actions/database";
import { getCachedClipsByOwner } from "@actions/twitch";
import { publicClip } from "./clip-discovery";
import { providerClipSchema } from "./clip-validation";
import type { Gallery } from "@types";
export function getGalleryPreviewForPrincipal(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"get_gallery_preview",
		input,
		async (input, context) => {
			const row = await galleryRecord(context, input.galleryId);
			const access = await resolveRetainedResourceAccess({ kind: "gallery", ownerId: input.creatorId, resourceId: row.id, client: context.tx });
			const effective: Gallery = context.pro ? row : { ...row, ...normalizeGalleryPatch(row, {}, false), ...downgradeGalleryPatch(row, true) };
			const clips = !access.runtime ? [] : effective.source === "curated" ? (effective.playlistId ? await getPlaylistRuntimeClipsForOwnerServer(input.creatorId, effective.playlistId) : []) : resolveLiveGalleryClips(effective, await getCachedClipsByOwner(input.creatorId));
			const key = `${principal.grantId}:${principal.generation}:gallery-preview:${row.id}:${row.configurationRevision}`;
			const offset = input.cursor ? Number(decodePageCursor(input.cursor, key)) : 0;
			if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100_000) throw new Error("INVALID_INPUT");
			const safe = clips.flatMap((clip) => {
				const parsed = providerClipSchema.safeParse(clip);
				return parsed.success ? [publicClip(parsed.data)] : [];
			});
			const items = safe.slice(offset, offset + input.limit);
			return { galleryId: row.id, gallery: galleryDto(effective), items, showAttribution: !context.pro, runtimeAllowed: access.runtime, nextCursor: offset + items.length < safe.length ? encodePageCursor(String(offset + items.length), key) : null };
		},
		client,
	);
}

import { overlaysTable } from "@/db/schema";
export function getOverlayEmbed(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"get_overlay_embed",
		input,
		async (input, { tx }) => {
			const [overlay] = await tx
				.select({ id: overlaysTable.id, secret: overlaysTable.secret, status: overlaysTable.status })
				.from(overlaysTable)
				.where(and(eq(overlaysTable.id, input.overlayId), eq(overlaysTable.ownerId, input.creatorId)))
				.limit(1);
			if (!overlay) throw new Error("RESOURCE_UNAVAILABLE");
			const url = new URL(`/overlay/${overlay.id}`, getMcpConfiguration().origin);
			url.searchParams.set("secret", overlay.secret);
			return { overlayId: overlay.id, purpose: input.purpose, url: url.href, status: overlay.status, containsCredential: true, public: false, instructions: "Use this private URL as an OBS browser source. For public websites use get_player_embed; never publish the OBS secret." };
		},
		client,
	);
}

export function getPlayerEmbed(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"get_player_embed",
		input,
		async (input, { tx, pro }) => {
			const [overlay] = await tx
				.select({ id: overlaysTable.id, status: overlaysTable.status })
				.from(overlaysTable)
				.where(and(eq(overlaysTable.id, input.overlayId), eq(overlaysTable.ownerId, input.creatorId)))
				.limit(1);
			if (!overlay) throw new Error("RESOURCE_UNAVAILABLE");
			const origin = getMcpConfiguration().origin;
			const url = new URL(`/embed/${overlay.id}`, origin);
			for (const key of ["muted", "autoplay", "showBanner", "showOverlay"] as const) if (input[key]) url.searchParams.set(key, "true");
			const attributes = `${input.muted ? " muted" : ""}${input.autoplay ? " autoplay" : ""}${input.showBanner ? " show-banner" : ""}${input.showOverlay ? " show-overlay" : ""}`;
			const element = `<clipify-player player-id="${overlay.id}"${attributes}></clipify-player>`;
			const scriptTag = `<script type="module" src="${origin}/elements/v1/clipify.js"></script>`;
			const iframe = `<iframe src="${url.href.replaceAll("&", "&amp;")}" title="Clipify player" allow="autoplay" loading="lazy" referrerpolicy="strict-origin" style="width:100%;aspect-ratio:16/9;border:0"></iframe>`;
			return { overlayId: overlay.id, format: input.format, public: true, url: url.href, element, scriptTag, html: input.format === "iframe" ? iframe : `${scriptTag}\n${element}`, showAttribution: !pro, installationGuide: CLIPIFY_ELEMENTS_HELP_URL, status: overlay.status };
		},
		client,
	);
}
