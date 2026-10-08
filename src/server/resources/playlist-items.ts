import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db, type DatabaseClient, type TransactionClient } from "@/db/client";
import { auditEventsTable, playlistClipsTable, playlistsTable } from "@/db/schema";
import { authorizeTrustedCreatorOperation, type TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { FREE_PLAYLIST_CLIP_LIMIT } from "@lib/constants";
import type { TwitchClip } from "@types";
import { resolveRetainedResourceAccess } from "@/server/entitlements/resource-access";
import { authorizeLockedMutation } from "./mutation";
import { nextConfigurationRevision } from "./revisions";
import { resolveValidatedPlaylistClips } from "./clip-validation";
import { CreationQuotaError } from "./quota";

const saveInput = z
	.object({
		creatorId: z.string().min(1),
		playlistId: z.string().uuid(),
		clipIds: z.array(z.string().min(1).max(200)),
		mode: z.enum(["append", "replace", "remove"]),
		expectedRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		name: z.string().trim().min(1).max(120).optional(),
		requirePro: z.boolean().default(false),
	})
	.strict();

type BrowserSelectionResult = { clips: TwitchClip[]; configurationRevision: number; name: string };
type ItemProjection<T> = { tool: "add_playlist_items" | "remove_playlist_items" | "commit_playlist_import"; skipAudit?: boolean; projectResult: (playlist: typeof playlistsTable.$inferSelect, client: TransactionClient) => Promise<T> };

export function savePlaylistItemSelection(principal: TrustedCreatorPrincipal, rawInput: unknown, client?: DatabaseClient | TransactionClient): Promise<BrowserSelectionResult>;
export function savePlaylistItemSelection<T>(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient | TransactionClient, projection: ItemProjection<T>): Promise<T>;
/** Browser and MCP edits share one locked transaction; result projection also precedes commit. */
export async function savePlaylistItemSelection(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient | TransactionClient = db, projection?: ItemProjection<unknown>) {
	const parsed = saveInput.safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	const ids = [...new Set(input.clipIds)];
	const decision = await authorizeTrustedCreatorOperation({ principal, creatorId: input.creatorId, permission: "playlist-items:manage", client });
	if (!decision.allowed) throw new Error("ACCESS_DENIED");
	if (input.name !== undefined && !(await authorizeTrustedCreatorOperation({ principal, creatorId: input.creatorId, permission: "playlist:update", client })).allowed) throw new Error("ACCESS_DENIED");
	const [preflight] = await client
		.select()
		.from(playlistsTable)
		.where(and(eq(playlistsTable.id, input.playlistId), eq(playlistsTable.ownerId, input.creatorId)))
		.limit(1);
	if (!preflight) throw new Error("RESOURCE_UNAVAILABLE");
	nextConfigurationRevision(preflight.configurationRevision, input.expectedRevision);
	const preflightAccess = await resolveRetainedResourceAccess({ kind: "playlist", ownerId: input.creatorId, resourceId: input.playlistId, client });
	if (!preflightAccess.update || (input.requirePro && preflightAccess.effectivePlan !== "pro")) throw new Error("FEATURE_RESTRICTED");
	const previous = await client.select({ clipId: playlistClipsTable.clipId }).from(playlistClipsTable).where(eq(playlistClipsTable.playlistId, input.playlistId));
	const existingIds = new Set(previous.map((row) => row.clipId));
	const newIds = input.mode === "remove" ? [] : ids.filter((id) => !existingIds.has(id));
	// Existing clip metadata stays server-owned. Resolve only new references, before locks.
	const validated = newIds.length ? await resolveValidatedPlaylistClips(input.creatorId, newIds) : [];
	const newClips = new Map(validated.map((clip) => [clip.id, clip]));
	return client.transaction(async (tx) => {
		const authorization = await authorizeLockedMutation(principal, input.creatorId, "playlist-items:manage", tx);
		if (input.name !== undefined && !(await authorizeTrustedCreatorOperation({ principal, creatorId: input.creatorId, permission: "playlist:update", client: tx })).allowed) throw new Error("ACCESS_DENIED");
		const [current] = await tx
			.select()
			.from(playlistsTable)
			.where(and(eq(playlistsTable.id, input.playlistId), eq(playlistsTable.ownerId, input.creatorId)))
			.limit(1)
			.for("update");
		if (!current) throw new Error("RESOURCE_UNAVAILABLE");
		const revision = nextConfigurationRevision(current.configurationRevision, input.expectedRevision);
		const access = await resolveRetainedResourceAccess({ kind: "playlist", ownerId: input.creatorId, resourceId: current.id, client: tx });
		if (!access.update || (input.requirePro && access.effectivePlan !== "pro")) throw new Error("FEATURE_RESTRICTED");
		const rows = await tx.select().from(playlistClipsTable).where(eq(playlistClipsTable.playlistId, current.id)).orderBy(asc(playlistClipsTable.position), asc(playlistClipsTable.clipId));
		const stored = new Map(rows.map((row) => [row.clipId, row.clipData]));
		if (input.mode === "remove" && ids.some((id) => !stored.has(id))) throw new Error("INVALID_INPUT");
		const removed = new Set(ids);
		const nextIds = input.mode === "remove" ? rows.filter((row) => !removed.has(row.clipId)).map((row) => row.clipId) : input.mode === "append" ? [...rows.map((row) => row.clipId), ...ids.filter((id) => !stored.has(id))] : ids;
		if (input.mode !== "remove" && access.effectivePlan === "free" && nextIds.length > FREE_PLAYLIST_CLIP_LIMIT) throw new CreationQuotaError(rows.length, FREE_PLAYLIST_CLIP_LIMIT);
		const nextRows = nextIds.map((id, position) => {
			const clipData = stored.get(id) ?? (newClips.has(id) ? JSON.stringify(newClips.get(id)) : undefined);
			if (clipData === undefined) throw new Error("INVALID_INPUT");
			return { playlistId: current.id, clipId: id, position, clipData };
		});
		function projectStoredClips() {
			const clips = projection
				? []
				: nextRows.map((row) => {
						let value: unknown;
						try {
							value = JSON.parse(row.clipData);
						} catch {
							throw new Error("INVALID_INPUT");
						}
						if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_INPUT");
						const raw = value as { clip?: unknown; id?: unknown };
						const clip = raw.clip && typeof raw.clip === "object" ? raw.clip : raw;
						if ((clip as { id?: unknown }).id !== row.clipId) throw new Error("INVALID_INPUT");
						return clip as TwitchClip;
					});
			return { clips };
		}
		const { clips } = projectStoredClips();
		authorization.assertAuthorityCurrent();
		await tx.delete(playlistClipsTable).where(eq(playlistClipsTable.playlistId, current.id));
		if (nextRows.length) await tx.insert(playlistClipsTable).values(nextRows);
		await tx
			.update(playlistsTable)
			.set({ configurationRevision: revision, updatedAt: new Date(), ...(input.name !== undefined ? { name: input.name } : {}) })
			.where(eq(playlistsTable.id, current.id));
		async function recordPlaylistItemMutation() {
			if (!projection?.skipAudit)
				await tx.insert(auditEventsTable).values({
					actorUserId: principal.authUserId,
					...(principal.kind === "session" ? { actorSessionId: principal.sessionId } : {}),
					targetType: "playlist",
					targetId: current.id,
					action: principal.kind === "oauth" ? `sensitive-integration:mcp.${projection?.tool ?? "save_playlist_items"}` : input.requirePro ? "playlist.items.import" : "playlist.items.save",
					outcome: "success",
					correlationId: randomUUID(),
					occurredAt: new Date(),
					metadata: { creatorId: input.creatorId, revision, ...(projection ? { tool: projection.tool } : {}), ...(principal.kind === "oauth" ? { clientId: principal.clientId, grantId: principal.grantId, generation: principal.generation } : {}) },
				});
		}
		await recordPlaylistItemMutation();
		const result = projection ? await projection.projectResult({ ...current, name: input.name ?? current.name, configurationRevision: revision }, tx) : { clips, configurationRevision: revision, name: input.name ?? current.name };
		authorization.assertAuthorityCurrent();
		return result;
	});
}
