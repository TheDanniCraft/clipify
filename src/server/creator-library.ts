import "server-only";
import { z } from "zod";
import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { twitchCacheTable } from "@/db/schema";
import { TwitchCacheType } from "@types";
import { providerClipSchema } from "./resources/clip-validation";
import { authorizeCreatorOperation } from "@/auth/authorize-operation";
import { getGamesDetailsBulk, getGameDetails } from "@actions/twitch";
import { publicTwitchImageUrl } from "./resources/twitch-image";
import { filterDiscoveredClips, publicClip } from "./resources/clip-discovery";

export const inventoryQuerySchema = z
	.object({
		videoId: z.string().max(200).optional(),
		category: z.string().max(200).optional(),
		title: z.string().max(1000).optional(),
		sort: z.enum(["newest", "most_viewed"]).default("newest"),
		page: z.number().int().min(1).default(1),
		pageSize: z.number().int().min(1).max(50).default(25),
		minViews: z.number().int().nonnegative().optional(),
		minDuration: z.number().finite().nonnegative().optional(),
		maxDuration: z.number().finite().nonnegative().optional(),
		startedAt: z.string().datetime({ offset: true }).optional(),
		endedAt: z.string().datetime({ offset: true }).optional(),
		timeZone: z
			.string()
			.refine((value) => {
				try {
					new Intl.DateTimeFormat("en", { timeZone: value });
					return true;
				} catch {
					return false;
				}
			}, "Choose a valid timezone.")
			.default("UTC"),
	})
	.refine((query) => query.minDuration === undefined || query.maxDuration === undefined || query.minDuration <= query.maxDuration, { path: ["maxDuration"], message: "Maximum duration must be at least the minimum." })
	.refine((query) => !query.startedAt || !query.endedAt || Date.parse(query.startedAt) < Date.parse(query.endedAt), { path: ["endedAt"], message: "End must be after start." });

export function queryInventoryClips(clips: z.infer<typeof providerClipSchema>[], query: unknown) {
	const filters = inventoryQuerySchema.parse(query);
	const matches = filterDiscoveredClips(
		clips.filter((clip) => !filters.videoId || clip.video_id === filters.videoId),
		filters,
		filters.category,
	);
	const offset = (filters.page - 1) * filters.pageSize;
	return { items: matches.slice(offset, offset + filters.pageSize).map(publicClip), total: matches.length };
}

async function inventoryCategories(clips: z.infer<typeof providerClipSchema>[], creatorId: string, cachedOnly: boolean) {
	const categoryIds = [...new Set(clips.map((clip) => clip.game_id).filter((id): id is string => Boolean(id)))];
	const games = categoryIds.length
		? await db
				.select({ value: twitchCacheTable.value })
				.from(twitchCacheTable)
				.where(and(eq(twitchCacheTable.type, TwitchCacheType.Game), inArray(twitchCacheTable.key, categoryIds)))
				.execute()
		: [];
	const cachedGames = games.flatMap((row) => {
		try {
			const game = z.object({ id: z.string(), name: z.string(), box_art_url: z.string().optional() }).safeParse(JSON.parse(row.value));
			return game.success ? [game.data] : [];
		} catch {
			return [];
		}
	});
	const missing = categoryIds.filter((id) => !cachedGames.some((game) => game.id === id));
	const fetched = missing.length && !cachedOnly ? await getGamesDetailsBulk(missing, creatorId).catch(() => []) : [];
	const categories = [...cachedGames, ...fetched].filter((game) => categoryIds.includes(game.id)).map((game) => ({ id: game.id, name: game.name, artworkUrl: publicTwitchImageUrl(game.box_art_url?.replace("{width}", "40").replace("{height}", "56")) }));
	return categories;
}

export async function readCreatorLibrary(creatorId: string, query: unknown = {}, cachedOnly = false) {
	const decision = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:read" });
	if (!decision.allowed) return { ok: false as const, code: decision.code };
	const parsed = inventoryQuerySchema.safeParse(query);
	if (!parsed.success) return { ok: false as const, code: "INVALID_INPUT", fieldErrors: parsed.error.flatten().fieldErrors };
	try {
		// shortcut: Scan the creator cache; move filters into SQL when inventories exceed the 10k-clip latency target.
		const rows = await db
			.select({ key: twitchCacheTable.key, value: twitchCacheTable.value, fetchedAt: twitchCacheTable.fetchedAt })
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, TwitchCacheType.Clip), or(sql`starts_with(${twitchCacheTable.key}, ${`clip:${creatorId}:`})`, eq(twitchCacheTable.key, `clip-sync:${creatorId}`)), cachedOnly ? undefined : or(isNull(twitchCacheTable.expiresAt), gt(twitchCacheTable.expiresAt, new Date()))))
			.execute();
		const clips = new Map<string, z.infer<typeof providerClipSchema>>();
		let complete = false;
		let invalid = false;
		let fetchedAt: string | null = null;
		for (const row of rows) {
			const value = JSON.parse(row.value);
			if (row.key === `clip-sync:${creatorId}`) {
				complete = value.backfillComplete === true;
				continue;
			}
			if (value.unavailable) continue;
			const clip = providerClipSchema.safeParse(value.clip ?? value);
			if (!clip.success || clip.data.broadcaster_id !== creatorId) {
				invalid = true;
				continue;
			}
			clips.set(clip.data.id, clip.data);
			const time = row.fetchedAt.toISOString();
			if (!fetchedAt || time > fetchedAt) fetchedAt = time;
		}
		const categories = await inventoryCategories([...clips.values()], creatorId, cachedOnly);
		return { ok: true as const, clips: [...clips.values()], filters: parsed.data, categories, complete: complete && !invalid, fetchedAt };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}

export async function readCreatorInventory(creatorId: string, query: unknown = {}, cachedOnly = false) {
	const library = await readCreatorLibrary(creatorId, query, cachedOnly);
	if (!library.ok) return library;
	return { ok: true as const, ...queryInventoryClips(library.clips, library.filters), categories: library.categories, complete: library.complete, fetchedAt: library.fetchedAt };
}

export async function canPreviewInventoryClip(input: { creatorId: string; contextCreatorId: string; clipId: string }, readClip: () => Promise<{ id: string; broadcaster_id: string } | null | undefined>) {
	if (input.contextCreatorId !== input.creatorId) return false;
	const decision = await authorizeCreatorOperation({ creatorId: input.creatorId, resourceOwnerId: input.creatorId, permission: "creator:read" });
	if (!decision.allowed) return false;
	const clip = await readClip();
	return clip?.id === input.clipId && clip.broadcaster_id === input.creatorId;
}

export async function readCreatorClipDetail(creatorId: string, clipId: string, cachedOnly = false) {
	const decision = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:read" });
	if (!decision.allowed) return { ok: false as const, code: decision.code };
	try {
		const [row] = await db
			.select({ value: twitchCacheTable.value, fetchedAt: twitchCacheTable.fetchedAt })
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, TwitchCacheType.Clip), eq(twitchCacheTable.key, `clip:${creatorId}:${clipId}`), cachedOnly ? undefined : or(isNull(twitchCacheTable.expiresAt), gt(twitchCacheTable.expiresAt, new Date()))))
			.execute();
		if (!row) return { ok: false as const, code: "NOT_FOUND" };
		const stored = JSON.parse(row.value);
		const parsed = providerClipSchema.safeParse(stored.clip ?? stored);
		if (stored.unavailable || !parsed.success || parsed.data.id !== clipId || parsed.data.broadcaster_id !== creatorId) return { ok: false as const, code: "NOT_FOUND" };
		const clip = parsed.data;
		let categoryName: string | null = null;
		if (clip.game_id && !cachedOnly) {
			const [game] = await db
				.select({ value: twitchCacheTable.value })
				.from(twitchCacheTable)
				.where(and(eq(twitchCacheTable.type, TwitchCacheType.Game), eq(twitchCacheTable.key, clip.game_id)))
				.execute();
			if (game) {
				const parsedGame = z.object({ name: z.string() }).safeParse(JSON.parse(game.value));
				if (parsedGame.success) categoryName = parsedGame.data.name;
			}
			if (!categoryName) categoryName = (await getGameDetails(clip.game_id, creatorId).catch(() => null))?.name ?? null;
		}
		return { ok: true as const, clip: publicClip(clip), categoryName, fetchedAt: row.fetchedAt.toISOString() };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
