/* istanbul ignore file */
"use server";

import axios from "axios";
import { AuthenticatedUser, Game, Overlay, OverlayType, RewardStatus, TwitchApiResponse, TwitchAppAccessTokenResponse, TwitchCacheType, TwitchClip, TwitchClipResponse, TwitchReward, TwitchRewardResponse, TwitchTokenApiResponse, TwitchUserResponse } from "@types";
import { deleteTwitchCacheByPrefix, deleteTwitchCacheKeys, getAccessToken, getAccessTokenServer, getOverlayBySecret, getOverlayPublic, getPlaylistClipsForOwnerServer, getTwitchCache, getTwitchCacheBatch, getTwitchCacheByPrefixEntries, getTwitchCacheEntry, getTwitchCacheStale, getTwitchCacheStaleBatch, setTwitchCache, setTwitchCacheBatch } from "@actions/database";
import { getBaseUrl, isPreview } from "@actions/utils";
import { isTitleBlocked } from "@/app/utils/regexFilter";
import { dbPool } from "@/db/client";
import { REWARD_NOT_FOUND } from "@lib/twitchErrors";
import { validateAuth } from "@actions/auth";
import { TWITCH_CLIPS_LAUNCH_MS } from "@lib/constants";

export async function logTwitchError(context: string, error: unknown) {
	if (axios.isAxiosError(error) && error.response) {
		console.error("%s:", context, error.response.data);
	} else {
		console.error("%s:", context, error);
	}
}

type EventSubSubscription = {
	id: string;
	type: string;
	status: string;
	condition?: Record<string, string>;
	transport?: {
		method?: string;
		callback?: string;
	};
};

type ClipSyncState = {
	lastIncrementalSyncAt?: string;
	lastBackfillSyncAt?: string;
	backfillCursor?: string;
	backfillWindowEnd?: string;
	backfillWindowSizeMs?: number;
	backfillComplete?: boolean;
	rateLimitedUntil?: string;
};

type CachedClipValue = {
	clip: TwitchClip;
	unavailable?: boolean;
	lastSeenAt?: string;
	lastValidatedAt?: string;
};

type ClipForceRefreshState = {
	lastForcedAt?: string;
};

const CLIP_SYNC_INCREMENTAL_INTERVAL_MS = 60 * 1000;
const CLIP_SYNC_BACKFILL_INTERVAL_MS = 60 * 1000;
const CLIP_SYNC_RECENT_WINDOW_DAYS = 7;
const CLIP_SYNC_REQUEST_BUDGET_PER_RUN = Math.min(200, Math.max(1, parsePositiveInt(process.env.CLIP_SYNC_REQUEST_BUDGET_PER_RUN, 50)));
const CLIP_SYNC_RECENT_MAX_PAGES_PER_RUN = Math.min(500, Math.max(1, parsePositiveInt(process.env.CLIP_SYNC_RECENT_MAX_PAGES_PER_RUN, 200)));
function parsePositiveInt(value: string | undefined, fallback: number) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.floor(parsed);
}
const CLIP_VALIDATION_STALE_MS = Math.max(5 * 60 * 1000, parsePositiveInt(process.env.CLIP_VALIDATION_STALE_MS, 6 * 60 * 60 * 1000));
const CLIP_FORCE_REFRESH_COOLDOWN_MS = Math.max(60 * 60 * 1000, parsePositiveInt(process.env.CLIP_FORCE_REFRESH_COOLDOWN_MS, 6 * 60 * 60 * 1000));
const CLIP_CACHE_PREFIX = (ownerId: string) => `clip:${ownerId}:`;
const CLIP_SYNC_STATE_KEY = (ownerId: string) => `clip-sync:${ownerId}`;
const CLIP_FORCE_REFRESH_KEY = (ownerId: string) => `clip-sync-force:${ownerId}`;

function toClipCacheKey(ownerId: string, clipId: string) {
	return `${CLIP_CACHE_PREFIX(ownerId)}${clipId}`;
}

function parseCachedClipValue(value: CachedClipValue | TwitchClip | null | undefined): TwitchClip | null {
/* istanbul ignore next */
	if (!value || typeof value !== "object") return null;
	if ("clip" in value && value.clip) return value.clip;
	if ("id" in value && typeof value.id === "string") return value as TwitchClip;
	return null;
}

function getRateLimitResumeAt(error: unknown, nowMs: number): string | null {
	if (!axios.isAxiosError(error) || error.response?.status !== 429) return null;
	const retryAfterRaw = error.response?.headers?.["retry-after"];
	const resetRaw = error.response?.headers?.["ratelimit-reset"];

/* istanbul ignore next */
	const retryAfterSeconds = Number.parseInt(Array.isArray(retryAfterRaw) ? retryAfterRaw[0] : (retryAfterRaw ?? "").toString(), 10);
/* istanbul ignore next */
	if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
		return new Date(nowMs + retryAfterSeconds * 1000).toISOString();
	}

/* istanbul ignore next */
	const resetSeconds = Number.parseInt(Array.isArray(resetRaw) ? resetRaw[0] : (resetRaw ?? "").toString(), 10);
/* istanbul ignore next */
	if (Number.isFinite(resetSeconds) && resetSeconds > 0) {
/* istanbul ignore next */
		return new Date(resetSeconds * 1000).toISOString();
	}

	// Fallback: back off one minute when Twitch does not provide explicit headers.
/* istanbul ignore next */
	return new Date(nowMs + 60_000).toISOString();
}

async function getClipSyncState(ownerId: string): Promise<ClipSyncState> {
	const state = await getTwitchCache<ClipSyncState>(TwitchCacheType.Clip, CLIP_SYNC_STATE_KEY(ownerId));
/* istanbul ignore next */
	return state ?? {};
}

async function setClipSyncState(ownerId: string, state: ClipSyncState) {
	await setTwitchCache(TwitchCacheType.Clip, CLIP_SYNC_STATE_KEY(ownerId), state);
}

async function getClipForceRefreshState(ownerId: string): Promise<ClipForceRefreshState> {
	const state = await getTwitchCache<ClipForceRefreshState>(TwitchCacheType.Clip, CLIP_FORCE_REFRESH_KEY(ownerId));
/* istanbul ignore next */
	return state ?? {};
}

async function setClipForceRefreshState(ownerId: string, state: ClipForceRefreshState) {
	await setTwitchCache(TwitchCacheType.Clip, CLIP_FORCE_REFRESH_KEY(ownerId), state);
}

/* istanbul ignore next */
export async function getCachedClipsByOwner(ownerId: string, limit?: number): Promise<TwitchClip[]> {
	const boundedLimit = typeof limit === "number" ? Math.max(1, Math.floor(limit)) : undefined;
	const entries = await getTwitchCacheByPrefixEntries<CachedClipValue | TwitchClip>(TwitchCacheType.Clip, CLIP_CACHE_PREFIX(ownerId), boundedLimit);
	const deduped = new Map<string, TwitchClip>();
	for (const entry of entries) {
		const value = entry.value as CachedClipValue | TwitchClip;
		if ((value as CachedClipValue).unavailable) {
			const lastValidatedAt = (value as CachedClipValue).lastValidatedAt;
/* istanbul ignore next */
			const parsed = lastValidatedAt ? Date.parse(lastValidatedAt) : Number.NaN;
			const stale = !Number.isFinite(parsed) || Date.now() - parsed >= CLIP_VALIDATION_STALE_MS;
			if (!stale) continue;
		}
		const clip = parseCachedClipValue(entry.value);
		if (!clip?.id) continue;
		if (deduped.has(clip.id)) continue;
		deduped.set(clip.id, clip);
/* istanbul ignore next */
		if (boundedLimit && deduped.size >= boundedLimit) break;
	}
	return Array.from(deduped.values());
}

async function internalSearchTwitchGames(query: string, authUserId: string): Promise<Game[]> {
	const token = await getAccessToken(authUserId);
/* istanbul ignore next */
	if (!token) return [];

	try {
		const [searchResponse, exactResponse] = await Promise.all([
			axios.get<TwitchApiResponse<Game>>("https://api.twitch.tv/helix/search/categories", {
				headers: {
					Authorization: `Bearer ${token.accessToken}`,
/* istanbul ignore next */
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
				params: { query, first: 100 },
			}),
			axios.get<TwitchApiResponse<Game>>("https://api.twitch.tv/helix/games", {
				headers: {
					Authorization: `Bearer ${token.accessToken}`,
/* istanbul ignore next */
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
				params: { name: query },
			}),
		]);

		const searchGames = searchResponse.data.data;
		const exactGames = exactResponse.data.data;

		// Merge and deduplicate
		const map = new Map<string, Game>();
		for (const game of exactGames) map.set(game.id, game);
		for (const game of searchGames) map.set(game.id, game);
		const games = Array.from(map.values());

		const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
/* istanbul ignore next */
		if (games.length > 0) {
			await setTwitchCacheBatch(
				TwitchCacheType.Game,
				games.map((game) => ({ key: game.id, value: game })),
				CACHE_TTL_SECONDS,
			);
		}

		// Cache the query result list as well
		await setTwitchCache(TwitchCacheType.GameQuery, query.trim().toLowerCase(), games, CACHE_TTL_SECONDS);

		return games;
	} catch (error) {
/* istanbul ignore next */
		logTwitchError("Error searching Twitch games", error);
/* istanbul ignore next */
		return [];
	}
}

export async function getTwitchGames(query: string, authUserId: string): Promise<Game[]> {
	const normalizedQuery = query.trim().toLowerCase();
/* istanbul ignore next */
	if (!normalizedQuery) return [];

	const entry = await getTwitchCacheEntry<Game[]>(TwitchCacheType.GameQuery, normalizedQuery);

	const FRESH_THRESHOLD_MS = 1000 * 60 * 1; // 1 minute
	const STALE_THRESHOLD_MS = 1000 * 60 * 60 * 24; // 24 hours

/* istanbul ignore next */
	if (entry.hit && entry.value && entry.fetchedAt) {
/* istanbul ignore next */
		const ageMs = Date.now() - entry.fetchedAt.getTime();

/* istanbul ignore next */
		if (ageMs < FRESH_THRESHOLD_MS) {
			// Very fresh - return immediately
/* istanbul ignore next */
			return entry.value;
		}

/* istanbul ignore next */
		if (ageMs < STALE_THRESHOLD_MS) {
			// Stale but usable - return immediately and refresh in background for next time
/* istanbul ignore next */
			internalSearchTwitchGames(query, authUserId).catch((err) => {
/* istanbul ignore next */
				console.error("Background Twitch game search refresh failed:", err);
			});
/* istanbul ignore next */
			return entry.value;
		}
		// Too old - fall through to foreground fetch
	}

	return internalSearchTwitchGames(query, authUserId);
}

async function upsertClipsByOwner(ownerId: string, clips: TwitchClip[]) {
	if (clips.length === 0) return;
	const nowIso = new Date().toISOString();
	await setTwitchCacheBatch(
		TwitchCacheType.Clip,
		clips.map((clip) => ({
			key: toClipCacheKey(ownerId, clip.id),
			value: { clip, lastSeenAt: nowIso, lastValidatedAt: nowIso } satisfies CachedClipValue,
		})),
	);
}

export async function resolvePlayableClip(ownerId: string, clip: TwitchClip): Promise<TwitchClip | null> {
	const key = toClipCacheKey(ownerId, clip.id);
	const cached = await getTwitchCache<CachedClipValue | TwitchClip>(TwitchCacheType.Clip, key);
	const nowIso = new Date().toISOString();
/* istanbul ignore next */
	const cachedValue = cached && typeof cached === "object" ? (cached as CachedClipValue | TwitchClip) : null;
	const cachedClip = parseCachedClipValue(cachedValue);
	const isStaleValidation = (lastValidatedAt?: string): boolean => {
/* istanbul ignore next */
		if (!lastValidatedAt) return true;
		const timestamp = Date.parse(lastValidatedAt);
/* istanbul ignore next */
		if (!Number.isFinite(timestamp)) return true;
		return Date.now() - timestamp >= CLIP_VALIDATION_STALE_MS;
	};

	if (cachedValue && "unavailable" in cachedValue && (cachedValue as CachedClipValue).unavailable) {
		const lastValidatedAt = (cachedValue as CachedClipValue).lastValidatedAt;
		const stale = isStaleValidation(lastValidatedAt);
/* istanbul ignore next */
		if (!stale) return null;
	}

/* istanbul ignore next */
	const lastValidatedAt = cachedValue && "lastValidatedAt" in (cachedValue as CachedClipValue) ? (cachedValue as CachedClipValue).lastValidatedAt : undefined;
	const stale = isStaleValidation(lastValidatedAt);
	if (!stale) {
		return cachedClip ?? clip;
	}

	const fresh = await getTwitchClip(clip.id, ownerId);
	if (!fresh) {
		await setTwitchCache(TwitchCacheType.Clip, key, {
/* istanbul ignore next */
			clip: cachedClip ?? clip,
			unavailable: true,
			lastSeenAt: (cachedValue as CachedClipValue | null)?.lastSeenAt ?? nowIso,
			lastValidatedAt: nowIso,
		} satisfies CachedClipValue);
		return null;
	}

	await setTwitchCache(TwitchCacheType.Clip, key, {
		clip: fresh,
		unavailable: false,
		lastSeenAt: nowIso,
		lastValidatedAt: nowIso,
	} satisfies CachedClipValue);
	return fresh;
}

async function fetchClipPage(ownerId: string, accessToken: string, first: number, after?: string, startedAt?: string, endedAt?: string) {
	const url = "https://api.twitch.tv/helix/clips";
	const response = await axios.get<TwitchApiResponse<TwitchClipResponse>>(url, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Client-Id": process.env.TWITCH_CLIENT_ID || "",
		},
		params: {
			broadcaster_id: ownerId,
			first,
			after,
			started_at: startedAt,
			ended_at: endedAt,
		},
	});
	return { clips: response.data.data, cursor: response.data.pagination?.cursor };
}

async function listEventSubSubscriptions(type?: string): Promise<EventSubSubscription[]> {
	const url = "https://api.twitch.tv/helix/eventsub/subscriptions";
	const token = await getAppAccessToken();

	if (!token) {
		console.error("No app access token found");
		return [];
	}

	const all: EventSubSubscription[] = [];
	let cursor: string | undefined;

	do {
		try {
			const response = await axios.get<TwitchApiResponse<EventSubSubscription>>(url, {
				headers: {
					Authorization: `Bearer ${token.access_token}`,
/* istanbul ignore next */
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
				params: {
					first: 100,
					type,
					after: cursor,
				},
			});
			all.push(...response.data.data);
			cursor = response.data.pagination?.cursor;
		} catch (error) {
			logTwitchError("Error listing EventSub subscriptions", error);
			break;
		}
	} while (cursor);

	return all;
}

async function deleteEventSubSubscription(id: string): Promise<boolean> {
	const url = "https://api.twitch.tv/helix/eventsub/subscriptions";
	const token = await getAppAccessToken();

	if (!token) {
		console.error("No app access token found");
		return false;
	}

	try {
		await axios.delete(url, {
			headers: {
				Authorization: `Bearer ${token.access_token}`,
/* istanbul ignore next */
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				id,
			},
		});
		return true;
	} catch (error) {
		logTwitchError("Error deleting EventSub subscription", error);
		return false;
	}
}

async function clearEventSubSubscriptionsByTypeAndCondition({ type, conditionMatch }: { type: string; conditionMatch: Record<string, string> }): Promise<number> {
	const subscriptions = await listEventSubSubscriptions(type);

	const targets = subscriptions.filter((sub) => {
/* istanbul ignore next */
		if (sub.type !== type) return false;
/* istanbul ignore next */
		if (!sub.condition) return false;
		for (const [key, value] of Object.entries(conditionMatch)) {
/* istanbul ignore next */
			if (sub.condition[key] !== value) return false;
		}
		return true;
	});

	if (targets.length === 0) return 0;

	let deleted = 0;
	for (const target of targets) {
		if (await deleteEventSubSubscription(target.id)) {
			deleted += 1;
		}
	}
	return deleted;
}

export async function exchangeAccesToken(code: string): Promise<TwitchTokenApiResponse | null> {
	const url = "https://id.twitch.tv/oauth2/token";
	const baseUrl = await getBaseUrl();

	let callbackUrl = new URL("/callback", baseUrl).toString();
	if ((await isPreview()) && process.env.PREVIEW_CALLBACK_URL) {
		callbackUrl = new URL(process.env.PREVIEW_CALLBACK_URL).toString();
	}

	try {
		const response = await axios.post<TwitchTokenApiResponse>(url, null, {
			params: {
/* istanbul ignore next */
				client_id: process.env.TWITCH_CLIENT_ID || "",
/* istanbul ignore next */
				client_secret: process.env.TWITCH_CLIENT_SECRET || "",
				code: code,
				grant_type: "authorization_code",
				redirect_uri: callbackUrl,
			},
		});
		return response.data;
	} catch (error) {
		logTwitchError("Error exchanging access token", error);
		return null;
	}
}

export async function refreshAccessToken(refreshToken: string): Promise<TwitchTokenApiResponse | null> {
	const result = await refreshAccessTokenWithContext(refreshToken);
	return result.token;
}

export type RefreshAccessTokenResult = {
	token: TwitchTokenApiResponse | null;
	invalidRefreshToken: boolean;
	status?: number;
	message?: string;
};

export async function refreshAccessTokenWithContext(refreshToken: string, userId?: string): Promise<RefreshAccessTokenResult> {
	const url = "https://id.twitch.tv/oauth2/token";
	try {
		const response = await axios.post<TwitchTokenApiResponse>(url, null, {
			params: {
/* istanbul ignore next */
				client_id: process.env.TWITCH_CLIENT_ID || "",
/* istanbul ignore next */
				client_secret: process.env.TWITCH_CLIENT_SECRET || "",
				refresh_token: refreshToken,
				grant_type: "refresh_token",
			},
		});
		return {
			token: response.data,
			invalidRefreshToken: false,
		};
	} catch (error) {
		let status: number | undefined;
		let message: string | undefined;
		let invalidRefreshToken = false;
		if (axios.isAxiosError(error)) {
			status = error.response?.status;
/* istanbul ignore next */
			message = (typeof error.response?.data === "object" && error.response?.data && "message" in error.response.data && typeof error.response.data.message === "string" ? error.response.data.message : error.message) || "unknown";
/* istanbul ignore next */
			invalidRefreshToken = status === 400 && (message ?? "").toLowerCase().includes("invalid refresh token");
		}
		console.error("Error refreshing access token:", {
			userId: userId ?? "unknown",
			status: status ?? "unknown",
			message: message ?? "unknown",
		});
		return {
			token: null,
			invalidRefreshToken,
			status,
			message,
		};
	}
}

export async function getAppAccessToken(): Promise<TwitchAppAccessTokenResponse | null> {
	const url = "https://id.twitch.tv/oauth2/token";
	try {
		const response = await axios.post<TwitchAppAccessTokenResponse>(url, null, {
			params: {
/* istanbul ignore next */
				client_id: process.env.TWITCH_CLIENT_ID || "",
/* istanbul ignore next */
				client_secret: process.env.TWITCH_CLIENT_SECRET || "",
				grant_type: "client_credentials",
			},
		});
		return response.data;
	} catch (error) {
		logTwitchError("Error fetching app access token", error);
		return null;
	}
}

export async function getUserDetails(accessToken: string): Promise<TwitchUserResponse | null> {
	const url = "https://api.twitch.tv/helix/users";
	try {
		const response = await axios.get<TwitchApiResponse<TwitchUserResponse>>(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
/* istanbul ignore next */
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
		});
/* istanbul ignore next */
		return response.data.data[0] || null;
	} catch (error) {
		logTwitchError("Error fetching user details", error);
		return null;
	}
}

export async function getUsersDetailsBulk({ userIds, userNames, accessToken }: { userIds?: string[]; userNames?: string[]; accessToken: string }): Promise<TwitchUserResponse[]> {
	const url = "https://api.twitch.tv/helix/users";
	const USER_CACHE_TTL_SECONDS = 60 * 60 * 24;
	const ids = userIds ? Array.from(new Set(userIds)) : [];

	try {
/* istanbul ignore next */
		if ((!userIds || userIds.length === 0) && (!userNames || userNames.length === 0)) {
			return [];
		}

		if (userIds && userNames) {
			console.error("You cannot provide both userIds and userNames");
			return [];
		}

/* istanbul ignore next */
		if ((userIds?.length ?? 0) >= 100 || (userNames?.length ?? 0) >= 100) {
			console.error("You cannot provide more than 100 userIds or userNames");
			return [];
		}

		let cachedUsers: TwitchUserResponse[] = [];
		let missingIds = ids;

/* istanbul ignore next */
		if (ids.length > 0) {
			cachedUsers = await getTwitchCacheBatch<TwitchUserResponse>(TwitchCacheType.User, ids);
			const cachedIds = new Set(cachedUsers.map((u) => u.id));
			missingIds = ids.filter((id) => !cachedIds.has(id));
			if (missingIds.length === 0) return cachedUsers;
		}

		const response = await axios.get<TwitchApiResponse<TwitchUserResponse>>(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
/* istanbul ignore next */
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
/* istanbul ignore next */
			params: missingIds.length > 0 ? { id: missingIds } : { login: userNames },
		});

		const fresh = response.data.data;
/* istanbul ignore next */
		if (fresh.length > 0) {
			await setTwitchCacheBatch(
				TwitchCacheType.User,
				fresh.map((user) => ({ key: user.id, value: user })),
				USER_CACHE_TTL_SECONDS,
			);
		}

		if (cachedUsers.length > 0) return [...cachedUsers, ...fresh];
		return fresh;
	} catch (error) {
/* istanbul ignore next */
		if (ids.length > 0) {
			const staleUsers = await getTwitchCacheStaleBatch<TwitchUserResponse>(TwitchCacheType.User, ids);
			if (staleUsers.length > 0) return staleUsers;
		}
		logTwitchError("Error fetching bulk user details", error);
		return [];
	}
}

export async function createChannelReward(userId: string): Promise<TwitchRewardResponse | null> {
	const url = "https://api.twitch.tv/helix/channel_points/custom_rewards";
	try {
		const token = await getAccessToken(userId);
		if (!token) {
			console.error("No access token found for userId:", userId);
			return null;
		}

		const hash = Math.random().toString(36).substring(2, 8);

		const response = await axios.post<TwitchApiResponse<TwitchRewardResponse>>(
			url,
			{
				broadcaster_id: userId,
				title: `Clipify Reward - ${hash}`,
				prompt: "Customize this reward. You can change title, reward cost, and more. This reward requires user input, disabeling will break the functionality.",
				cost: 1,
				is_enabled: false,
				is_user_input_required: true,
			},
			{
				headers: {
					Authorization: `Bearer ${token.accessToken}`,
/* istanbul ignore next */
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
			},
		);

/* istanbul ignore next */
		return response.data.data[0] || null;
	} catch (error) {
		logTwitchError("Error fetching channel rewards", error);
		return null;
	}
}

export async function removeChannelReward(rewardId: string, userId: string): Promise<boolean> {
	const url = `https://api.twitch.tv/helix/channel_points/custom_rewards`;
	try {
		const token = await getAccessToken(userId);
		if (!token) {
			console.error("No access token found for userId:", userId);
			return false;
		}

		await axios.delete(url, {
			params: {
				id: rewardId,
				broadcaster_id: userId,
			},
			headers: {
				Authorization: `Bearer ${token.accessToken}`,
/* istanbul ignore next */
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
		});
		return true;
	} catch (error) {
		logTwitchError("Error removing channel reward", error);
		return false;
	}
}

export async function verifyToken(user: AuthenticatedUser) {
	const url = "https://id.twitch.tv/oauth2/validate";
	try {
		const token = await getAccessToken(user.id);

		await axios.get(url, {
			headers: {
				Authorization: `Bearer ${token?.accessToken}`,
			},
		});
		return true;
	} catch {
		return false;
	}
}

export async function getTwitchClip(clipId: string, creatorId: string): Promise<null | TwitchClip> {
	const url = "https://api.twitch.tv/helix/clips";
	const token = await getAccessToken(creatorId);

	if (!token) {
		console.error("No access token found for creatorId:", creatorId);
		return null;
	}

	try {
		const response = await axios.get<TwitchApiResponse<TwitchClipResponse>>(url, {
			headers: {
				Authorization: `Bearer ${token.accessToken}`,
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				id: clipId,
			},
		});
		const clip = response.data.data[0];
		if (!clip) {
			console.error("Clip not found for ID:", clipId);
			return null;
		}
		return clip;
	} catch (error) {
		logTwitchError("Error fetching Twitch clip", error);
		return null;
	}
}

async function getCurrentCategoryGameId(ownerId: string, accessToken: string): Promise<string | null> {
	const url = "https://api.twitch.tv/helix/streams";
	try {
		const response = await axios.get<TwitchApiResponse<{ game_id: string }>>(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				user_id: ownerId,
				first: 1,
			},
		});

/* istanbul ignore next */
		return response.data.data[0]?.game_id || null;
	} catch (error) {
		logTwitchError("Error fetching current category", error);
		return null;
	}
}

async function runIncrementalSync(ownerId: string, accessToken: string, nextState: ClipSyncState, ensurePackSize: number, cachedClipsCount: number, nowMs: number): Promise<{ requestsUsed: number; rateLimited: boolean }> {
	let requestsUsed = 0;
	try {
		const first = ensurePackSize > 0 && cachedClipsCount < ensurePackSize ? Math.max(1, Math.min(100, ensurePackSize - cachedClipsCount)) : 100;
		const endedAt = new Date(nowMs).toISOString();
		const recentWindowStartedAt = new Date(nowMs - CLIP_SYNC_RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
		let recentCursor: string | undefined;
		let pageSize = first;

		// Always finish recent-window scan first; if this exceeds budget we still continue.
		for (let pageIndex = 0; pageIndex < CLIP_SYNC_RECENT_MAX_PAGES_PER_RUN; pageIndex += 1) {
			const page = await fetchClipPage(ownerId, accessToken, pageSize, recentCursor, recentWindowStartedAt, endedAt);
			requestsUsed += 1;
			await upsertClipsByOwner(ownerId, page.clips);
			recentCursor = page.cursor;
			pageSize = 100;
			if (!recentCursor) break;
		}
		nextState.lastIncrementalSyncAt = new Date(nowMs).toISOString();
		return { requestsUsed, rateLimited: false };
	} catch (error) {
		logTwitchError("Error fetching incremental clip sync page", error);
		const resumeAt = getRateLimitResumeAt(error, nowMs);
/* istanbul ignore next */
		if (resumeAt) {
/* istanbul ignore next */
			nextState.rateLimitedUntil = resumeAt;
/* istanbul ignore next */
			return { requestsUsed, rateLimited: true };
		}
		return { requestsUsed, rateLimited: false };
	}
}

async function runBackfillSync(ownerId: string, accessToken: string, nextState: ClipSyncState, ownerBackfillLowerBoundMs: number, nowMs: number, initialRequestsUsed: number): Promise<void> {
	// Legacy cursor check: if we have a cursor but no window state, it's from the old sync logic.
	// Twitch cursors are query-specific, so we must reset it to avoid 400 errors.
	if (nextState.backfillCursor && !nextState.backfillWindowEnd) {
		nextState.backfillCursor = undefined;
	}

	let recentRequestsUsed = initialRequestsUsed;
	try {
		// Process multiple windows in one run if budget allows.
		// We always allow at least ONE window to ensure backfill progress isn't starved by high-volume recent clips.
		let forceFirstIteration = true;
		while ((recentRequestsUsed < CLIP_SYNC_REQUEST_BUDGET_PER_RUN || forceFirstIteration) && !nextState.backfillComplete) {
			const remainingBudget = Math.max(1, CLIP_SYNC_REQUEST_BUDGET_PER_RUN - recentRequestsUsed);
			forceFirstIteration = false;

			const currentEndMs = nextState.backfillWindowEnd ? new Date(nextState.backfillWindowEnd).getTime() : nowMs - CLIP_SYNC_RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

			const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
			const MIN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
			const DEFAULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

			const rawWindowSizeMs = Number(nextState.backfillWindowSizeMs);
			const normalizedWindowSizeMs = Number.isFinite(rawWindowSizeMs) && rawWindowSizeMs > 0 ? rawWindowSizeMs : DEFAULT_WINDOW_MS;
			const windowSizeMs = Math.min(MAX_WINDOW_MS, Math.max(MIN_WINDOW_MS, normalizedWindowSizeMs));

			let cursor: string | undefined = nextState.backfillCursor;
			let pagesFetchedInWindow = 0;
			let clipsFetchedInWindow = 0;
			let hitLimitInWindow = false;

			// Advance window logic if we are already at the start or have invalid state (nothing to sync)
			if (!Number.isFinite(currentEndMs) || currentEndMs <= ownerBackfillLowerBoundMs) {
				nextState.backfillComplete = true;
				break;
			}

			const currentStartMs = Math.max(ownerBackfillLowerBoundMs, currentEndMs - windowSizeMs);
			const startedAtIso = new Date(currentStartMs).toISOString();
			const endedAtIso = new Date(currentEndMs).toISOString();

			let windowFailed = false;
			// Process the entire time window atomically
			while (pagesFetchedInWindow < remainingBudget && currentEndMs > ownerBackfillLowerBoundMs) {
				try {
					const page = await fetchClipPage(ownerId, accessToken, 100, cursor, startedAtIso, endedAtIso);
					await upsertClipsByOwner(ownerId, page.clips);
					clipsFetchedInWindow += page.clips.length;
					recentRequestsUsed += 1;
					pagesFetchedInWindow += 1;
					cursor = page.cursor;

					if (cursor && (clipsFetchedInWindow >= 1000 || pagesFetchedInWindow >= 10)) {
						hitLimitInWindow = true;
						break;
					}

					if (!cursor) break;
				} catch (error) {
					if (axios.isAxiosError(error) && error.response?.status === 429) {
						const resumeAt = getRateLimitResumeAt(error, nowMs);
/* istanbul ignore next */
						if (resumeAt) {
							nextState.rateLimitedUntil = resumeAt;
						}
						nextState.backfillWindowEnd = endedAtIso;
						nextState.backfillCursor = cursor;
						throw error; // Rethrow to abort the entire backfill for this run
					}
					logTwitchError("Error fetching backfill clip sync page", error);
					// Stop processing this window but allow saving what we have
					windowFailed = true;
					break;
				}
			}

			const budgetExhausted = pagesFetchedInWindow >= remainingBudget && cursor;

			if (!windowFailed && hitLimitInWindow && windowSizeMs > MIN_WINDOW_MS) {
				// Shrink and retry the SAME window range in the next outer iteration or next run
				nextState.backfillWindowSizeMs = Math.max(MIN_WINDOW_MS, Math.floor(windowSizeMs / 2));
				// Preserve window context so retries stay on the same historical range.
				nextState.backfillWindowEnd = endedAtIso;
				// Reset cursor because the next request will have different date bounds, making the current cursor invalid.
				nextState.backfillCursor = undefined;
				break; // Stop this run's loop to avoid getting stuck if remainingBudget is low
			} else if (windowFailed && pagesFetchedInWindow > 0) {
				// Persist partial progress in the SAME window and retry later from the saved cursor.
				nextState.backfillWindowEnd = endedAtIso;
				nextState.backfillCursor = cursor;
				nextState.backfillWindowSizeMs = windowSizeMs;
				break;
			} else if ((!windowFailed && !cursor) || hitLimitInWindow || budgetExhausted) {
				// Case A: No error and window truly finished (!cursor)
				// Case B: Hit limit but already at MIN_WINDOW_MS (Accept partial and move on)
				// Case C: Budget exhausted mid-window (budgetExhausted) - Save partial and stay on same window

				if (budgetExhausted) {
					// Stay on the same window for next run, but save current progress
					nextState.backfillWindowEnd = endedAtIso;
					nextState.backfillCursor = cursor;
				} else {
					// Move to next window
					nextState.backfillWindowEnd = new Date(currentStartMs).toISOString();
					nextState.backfillCursor = undefined;

/* istanbul ignore next */
					if (hitLimitInWindow) {
/* istanbul ignore next */
						nextState.backfillWindowSizeMs = MIN_WINDOW_MS;
/* istanbul ignore next */
						console.warn(`Clip backfill hit 1,000 limit within minimum window (${MIN_WINDOW_MS / 60000}m) for owner ${ownerId}. Some clips might be missing.`);
/* istanbul ignore next */
					} else if (windowFailed) {
						// Preserve window size on error
/* istanbul ignore next */
						nextState.backfillWindowSizeMs = windowSizeMs;
					} else {
						if (clipsFetchedInWindow < 100 && windowSizeMs < MAX_WINDOW_MS) {
							nextState.backfillWindowSizeMs = Math.min(MAX_WINDOW_MS, windowSizeMs * 2);
						} else {
							nextState.backfillWindowSizeMs = windowSizeMs;
						}
					}

					if (currentStartMs <= ownerBackfillLowerBoundMs) {
						nextState.backfillComplete = true;
					}
				}
/* istanbul ignore next */
			} else if (windowFailed) {
				// Abort backfill for this run if a window failed completely to avoid infinite retry loop.
				break;
			}
		}

		nextState.lastBackfillSyncAt = new Date(nowMs).toISOString();
	} catch (error) {
		// Only log if it's NOT a 429, because 429s are expected and handled via rateLimitedUntil
/* istanbul ignore next */
		if (!axios.isAxiosError(error) || error.response?.status !== 429) {
/* istanbul ignore next */
			logTwitchError("Error in backfill sync run", error);
		}

		const resumeAt = getRateLimitResumeAt(error, nowMs);
/* istanbul ignore next */
		if (resumeAt) {
			nextState.rateLimitedUntil = resumeAt;
		}
	}
}

export async function syncOwnerClipCache(ownerId: string, ensurePackSize = 0): Promise<void> {
	const lockClient = await dbPool.connect();
	const lockKey = `clip_sync_owner:${ownerId}`;
	let lockAcquired = false;
	try {
		const lockResult = (await lockClient.query("select pg_try_advisory_lock(hashtext($1)) as locked", [lockKey])) as { rows?: Array<{ locked?: boolean }> };
		lockAcquired = Boolean(lockResult.rows?.[0]?.locked);
		if (!lockAcquired) return;

		const token = await getAccessTokenServer(ownerId);
		if (!token) return;

		let ownerBackfillLowerBoundMs = TWITCH_CLIPS_LAUNCH_MS;
		try {
			const ownerLowerBoundResult = (await lockClient.query("select coalesce(twitch_created_at, created_at) as lower_bound from users where id = $1 limit 1", [ownerId])) as { rows?: Array<{ lower_bound?: string | Date | null }> };
			const lowerBoundRaw = ownerLowerBoundResult.rows?.[0]?.lower_bound;
			const parsedLowerBoundMs = lowerBoundRaw ? new Date(lowerBoundRaw).getTime() : Number.NaN;
			if (Number.isFinite(parsedLowerBoundMs)) {
				ownerBackfillLowerBoundMs = Math.max(TWITCH_CLIPS_LAUNCH_MS, parsedLowerBoundMs);
			}
		} catch {
/* istanbul ignore next */
			ownerBackfillLowerBoundMs = TWITCH_CLIPS_LAUNCH_MS;
		}

		let cachedClips: TwitchClip[] = [];
		if (ensurePackSize > 0) {
			cachedClips = await getCachedClipsByOwner(ownerId, ensurePackSize);
		}

		const syncState = await getClipSyncState(ownerId);
		const now = Date.now();
		const nextState: ClipSyncState = { ...syncState };
		const rateLimitedUntilMs = nextState.rateLimitedUntil ? Date.parse(nextState.rateLimitedUntil) : Number.NaN;
		if (Number.isFinite(rateLimitedUntilMs)) {
			if (now < rateLimitedUntilMs) {
				return;
			}
			nextState.rateLimitedUntil = undefined;
		}
		const isSyncDue = (lastSyncAt: string | undefined, intervalMs: number): boolean => {
			if (!lastSyncAt) return true;
			const parsed = Date.parse(lastSyncAt);
/* istanbul ignore next */
			if (!Number.isFinite(parsed)) return true;
			return now - parsed >= intervalMs;
		};
		const incrementalDue = (ensurePackSize > 0 && cachedClips.length < ensurePackSize) || isSyncDue(nextState.lastIncrementalSyncAt, CLIP_SYNC_INCREMENTAL_INTERVAL_MS);
		let recentRequestsUsed = 0;
		let rateLimited = false;

		if (incrementalDue) {
			const result = await runIncrementalSync(ownerId, token.accessToken, nextState, ensurePackSize, cachedClips.length, now);
			recentRequestsUsed = result.requestsUsed;
			rateLimited = result.rateLimited;
		}

		const backfillDue = !nextState.backfillComplete && isSyncDue(nextState.lastBackfillSyncAt, CLIP_SYNC_BACKFILL_INTERVAL_MS);

		if (!rateLimited && backfillDue) {
			await runBackfillSync(ownerId, token.accessToken, nextState, ownerBackfillLowerBoundMs, now, recentRequestsUsed);
		}

		if (JSON.stringify(syncState) !== JSON.stringify(nextState)) {
			await setClipSyncState(ownerId, nextState);
		}
	} finally {
		if (lockAcquired) {
			try {
				await lockClient.query("select pg_advisory_unlock(hashtext($1))", [lockKey]);
			} catch {
				// Best-effort unlock.
			}
		}
		lockClient.release();
	}
}

/* istanbul ignore next */
export async function getCreatorSyncProgress(ownerId: string) {
	const syncState = await getClipSyncState(ownerId);

	const now = Date.now();
	const totalDuration = now - TWITCH_CLIPS_LAUNCH_MS;

	let syncProgress = 0;
/* istanbul ignore next */
	if (syncState.backfillComplete) {
/* istanbul ignore next */
		syncProgress = 1; // 100%
/* istanbul ignore next */
	} else if (syncState.backfillWindowEnd) {
/* istanbul ignore next */
		const endMs = new Date(syncState.backfillWindowEnd).getTime();
/* istanbul ignore next */
		if (Number.isFinite(endMs) && totalDuration > 0) {
			// Clamp endMs to now to avoid negative progress when end timestamp is in the future.
/* istanbul ignore next */
			const effectiveEndMs = Math.min(endMs, now);
/* istanbul ignore next */
			const progress = (now - effectiveEndMs) / totalDuration;
/* istanbul ignore next */
			syncProgress = Math.max(0, Math.min(1, progress));
		}
	}

	return {
		syncProgress, // Float between 0.0 and 1.0 (e.g. 0.45 = 45%)
		isSyncComplete: !!syncState.backfillComplete,
		backfillWindowEnd: syncState.backfillWindowEnd ?? null,
	};
}

export async function getOwnClipForceRefreshStatus() {
	const user = await validateAuth(false);
	if (!user) return null;

	const [refreshState, progressState] = await Promise.all([getClipForceRefreshState(user.id), getCreatorSyncProgress(user.id)]);

	const lastForcedAt = refreshState.lastForcedAt ?? null;
	const lastForcedTs = lastForcedAt ? new Date(lastForcedAt).getTime() : 0;
	const now = Date.now();
	const nextAllowedTs = lastForcedTs > 0 ? lastForcedTs + CLIP_FORCE_REFRESH_COOLDOWN_MS : now;

	return {
		lastForcedAt,
		cooldownMs: CLIP_FORCE_REFRESH_COOLDOWN_MS,
		nextAllowedAt: new Date(nextAllowedTs).toISOString(),
		remainingMs: Math.max(0, nextAllowedTs - now),
		canRefresh: now >= nextAllowedTs,
		syncProgress: progressState.syncProgress,
		isSyncComplete: progressState.isSyncComplete,
		backfillWindowEnd: progressState.backfillWindowEnd,
	};
}

/* istanbul ignore next */
export async function forceRefreshOwnClipCache(ensurePackSize = 0) {
	const user = await validateAuth(false);
	if (!user) throw new Error("Not authenticated");

	const status = await getOwnClipForceRefreshStatus();
	if (!status) throw new Error("Not authenticated");
	if (!status.canRefresh) {
		return {
			ok: false as const,
			reason: "cooldown",
			nextAllowedAt: status.nextAllowedAt,
			remainingMs: status.remainingMs,
		};
	}

	await deleteTwitchCacheByPrefix(TwitchCacheType.Clip, CLIP_CACHE_PREFIX(user.id));
	await deleteTwitchCacheKeys(TwitchCacheType.Clip, [CLIP_SYNC_STATE_KEY(user.id)]);
	const nowIso = new Date().toISOString();
	await setClipForceRefreshState(user.id, { lastForcedAt: nowIso });
	void syncOwnerClipCache(user.id, ensurePackSize).catch((error) => {
		logTwitchError("forceRefreshOwnClipCache/syncOwnerClipCache", error);
	});

	return {
		ok: true as const,
		lastForcedAt: nowIso,
		cooldownMs: CLIP_FORCE_REFRESH_COOLDOWN_MS,
		nextAllowedAt: new Date(Date.now() + CLIP_FORCE_REFRESH_COOLDOWN_MS).toISOString(),
		remainingMs: CLIP_FORCE_REFRESH_COOLDOWN_MS,
	};
}

export async function getTwitchClips(overlay: Overlay, type?: OverlayType, skipFilter?: boolean): Promise<TwitchClip[]> {
	const overlayType = type ?? overlay.type;
	let clips: TwitchClip[] = [];

	if (overlayType === "Queue") {
		return clips;
	}

	if (overlayType === OverlayType.Playlist) {
/* istanbul ignore next */
		if (!overlay.playlistId) return [];
		clips = await getPlaylistClipsForOwnerServer(overlay.ownerId, overlay.playlistId);
	} else {
		await syncOwnerClipCache(overlay.ownerId);
		clips = await getCachedClipsByOwner(overlay.ownerId);
	}

	if (overlayType === OverlayType.Featured) {
		clips = clips.filter((clip) => !!(clip as TwitchClip & { is_featured?: boolean }).is_featured);
	} else if (overlayType !== OverlayType.All && overlayType !== OverlayType.Playlist) {
		const days = Number(overlayType);
		if (Number.isFinite(days) && days > 0) {
			const minTs = Date.now() - days * 24 * 60 * 60 * 1000;
			clips = clips.filter((clip) => {
				const ts = new Date(clip.created_at).getTime();
				return Number.isFinite(ts) && ts >= minTs;
			});
		}
	}

	if (!skipFilter) {
		if (overlay.preferCurrentCategory) {
			const token = await getAccessToken(overlay.ownerId);
			if (token?.accessToken) {
				const currentGameId = await getCurrentCategoryGameId(overlay.ownerId, token.accessToken);
				if (currentGameId) {
					const sameCategoryClips = clips.filter((clip) => clip.game_id === currentGameId);
/* istanbul ignore next */
					if (sameCategoryClips.length > 0) {
						clips = sameCategoryClips;
					}
				}
			}
		}

		// Filter for duration
		clips = clips.filter((clip) => {
			const clipDuration = clip.duration;
			return clipDuration >= overlay.minClipDuration && clipDuration <= overlay.maxClipDuration;
		});

		// Filter for blacklist words
		clips = clips.filter((clip) => {
			return !isTitleBlocked(clip.title, overlay.blacklistWords);
		});

		// Filter for selected categories
		const allowedCategories = (overlay.categoriesOnly ?? []).map((id) => id.toString().toLowerCase());
		if (allowedCategories.length > 0) {
			clips = clips.filter((clip) => allowedCategories.includes(clip.game_id.toLowerCase()));
		}

		const blockedCategories = (overlay.categoriesBlocked ?? []).map((id) => id.toString().toLowerCase());
		if (blockedCategories.length > 0) {
			clips = clips.filter((clip) => !blockedCategories.includes(clip.game_id.toLowerCase()));
		}

		// Filter for selected clip creators
/* istanbul ignore next */
		const allowedCreators = (overlay.clipCreatorsOnly ?? []).map((name) => name.toLowerCase());
		if (allowedCreators.length > 0) {
			clips = clips.filter((clip) => allowedCreators.includes(clip.creator_name.toLowerCase()) || allowedCreators.includes(clip.creator_id.toLowerCase()));
		}

/* istanbul ignore next */
		const blockedCreators = (overlay.clipCreatorsBlocked ?? []).map((name) => name.toLowerCase());
		if (blockedCreators.length > 0) {
			clips = clips.filter((clip) => !blockedCreators.includes(clip.creator_name.toLowerCase()) && !blockedCreators.includes(clip.creator_id.toLowerCase()));
		}

		// Filter for minimum views
		clips = clips.filter((clip) => {
			return clip.view_count >= overlay.minClipViews;
		});

		if (overlay.playbackMode === "top") {
/* istanbul ignore next */
			clips.sort((a, b) => b.view_count - a.view_count || b.created_at.localeCompare(a.created_at));
		}
	}

	return clips;
}

/* istanbul ignore next */
export async function getTwitchClipBatch(overlayId: string, overlaySecret?: string, type?: OverlayType, excludeClipIds: string[] = [], count = 50, skipFilter?: boolean): Promise<TwitchClip[]> {
/* istanbul ignore next */
	const overlay = overlaySecret ? await getOverlayBySecret(overlayId, overlaySecret) : await getOverlayPublic(overlayId);
/* istanbul ignore next */
	if (!overlay) return [];
	const all = await getTwitchClips(overlay, type, skipFilter);
/* istanbul ignore next */
	if (all.length === 0) return [];

	const exclude = new Set(excludeClipIds);
	let candidates = all.filter((clip) => !exclude.has(clip.id));
	if (candidates.length === 0) {
		candidates = all;
	}

	const batchSize = Math.max(1, Math.min(200, count));

	if (overlay.playbackMode === "top") {
		return [...candidates].sort((a, b) => b.view_count - a.view_count || b.created_at.localeCompare(a.created_at)).slice(0, batchSize);
	}

	if (overlay.playbackMode === "smart_shuffle") {
		const remaining = [...candidates];
		const ordered: TwitchClip[] = [];
		const recent: TwitchClip[] = [];
		while (remaining.length > 0 && ordered.length < batchSize) {
			const recentCreatorCounts = new Map<string, number>();
			const recentGameCounts = new Map<string, number>();
			for (const clip of recent.slice(-20)) {
/* istanbul ignore next */
				const creatorKey = clip.creator_id || clip.creator_name;
				recentCreatorCounts.set(creatorKey, (recentCreatorCounts.get(creatorKey) ?? 0) + 1);
				recentGameCounts.set(clip.game_id, (recentGameCounts.get(clip.game_id) ?? 0) + 1);
			}

			const sortedViews = remaining.map((clip) => clip.view_count).sort((a, b) => a - b);
/* istanbul ignore next */
			const medianViews = sortedViews.length > 0 ? sortedViews[Math.floor(sortedViews.length / 2)] : 0;
			const maxLogViews = Math.log1p(Math.max(1, ...sortedViews));

			const scored = remaining.map((clip) => {
/* istanbul ignore next */
				const creatorKey = clip.creator_id || clip.creator_name;
				const creatorPenalty = (recentCreatorCounts.get(creatorKey) ?? 0) * 0.12;
				const gamePenalty = (recentGameCounts.get(clip.game_id) ?? 0) * 0.1;
				const viewScore = Math.log1p(clip.view_count) / maxLogViews;
				const exploreBoost = clip.view_count <= medianViews ? 0.12 : 0;
				const jitter = Math.random() * 0.25;
				const score = Math.max(0.05, 0.58 * viewScore + 0.25 * jitter + exploreBoost - creatorPenalty - gamePenalty);
				return { clip, score };
			});

			const totalWeight = scored.reduce((sum, entry) => sum + entry.score, 0);
			let pick = Math.random() * totalWeight;
			let picked = scored[0]?.clip;
			for (const entry of scored) {
				pick -= entry.score;
/* istanbul ignore next */
				if (pick <= 0) {
					picked = entry.clip;
					break;
				}
			}

/* istanbul ignore next */
			if (!picked) break;
			ordered.push(picked);
			recent.push(picked);
			const idx = remaining.findIndex((clip) => clip.id === picked.id);
			if (idx >= 0) remaining.splice(idx, 1);
			else break;
		}
		return ordered;
	}

	return [...candidates]
		.map((clip) => ({ clip, sort: Math.random() }))
		.sort((a, b) => a.sort - b.sort)
		.map((entry) => entry.clip)
		.slice(0, batchSize);
}

export async function getDemoClip(clipId: string): Promise<TwitchClip | null> {
	const url = "https://api.twitch.tv/helix/clips";
	const token = await getAppAccessToken();

	if (!token) {
		console.error("No app access token found");
		return null;
	}

	try {
		const response = await axios.get<TwitchApiResponse<TwitchClipResponse>>(url, {
			headers: {
				Authorization: `Bearer ${token.access_token}`,
/* istanbul ignore next */
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				id: clipId,
			},
		});
		const clip = response.data.data[0];
		if (!clip) {
			console.error("Clip not found for ID:", clipId);
			return null;
		}
		return clip;
	} catch (error) {
		logTwitchError("Error fetching demo Twitch clip", error);
		return null;
	}
}

export async function getAvatar(userId: string, authUserId: string): Promise<string | undefined> {
	const url = "https://api.twitch.tv/helix/users";
	const AVATAR_CACHE_TTL_SECONDS = 60 * 60 * 6;

	const cached = await getTwitchCache<string>(TwitchCacheType.Avatar, userId);
/* istanbul ignore next */
	if (cached !== null) return cached || undefined;

/* istanbul ignore next */
	let accessToken = authUserId ? (await getAccessToken(authUserId))?.accessToken : undefined;
	if (!accessToken) {
		const appToken = await getAppAccessToken();
		accessToken = appToken?.access_token;
	}

	if (!accessToken) {
		console.error("No access token found for authUserId:", authUserId);
		return undefined;
	}

	try {
		const response = await axios.get<TwitchApiResponse<TwitchUserResponse>>(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
/* istanbul ignore next */
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				id: userId,
			},
		});
/* istanbul ignore next */
		const avatar = response.data.data[0]?.profile_image_url || "";
		await setTwitchCache(TwitchCacheType.Avatar, userId, avatar, AVATAR_CACHE_TTL_SECONDS);
/* istanbul ignore next */
		return avatar || undefined;
	} catch (error) {
		const stale = await getTwitchCacheStale<string>(TwitchCacheType.Avatar, userId);
/* istanbul ignore next */
		if (stale !== null) return stale || undefined;
		logTwitchError("Error fetching avatar", error);
		return undefined;
	}
}

export async function getGamesDetailsBulk(gameIds: string[], authUserId: string): Promise<Game[]> {
	if (gameIds.length === 0) return [];
	const GAME_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

	const cacheEntries = await getTwitchCacheBatch<Game | null>(
		TwitchCacheType.Game,
		gameIds.map((id) => id),
	);
	const results: Game[] = [];
	const missingIds: string[] = [];

	for (let i = 0; i < gameIds.length; i++) {
		const id = gameIds[i];
		const cached = cacheEntries[i];
		if (cached !== null) {
/* istanbul ignore next */
			if (cached) results.push(cached);
			continue;
		}
		missingIds.push(id);
	}

	if (missingIds.length === 0) return results;

/* istanbul ignore next */
	let accessToken = authUserId ? (await getAccessToken(authUserId))?.accessToken : undefined;
/* istanbul ignore next */
	if (!accessToken) {
/* istanbul ignore next */
		const appToken = await getAppAccessToken();
/* istanbul ignore next */
		accessToken = appToken?.access_token;
	}

/* istanbul ignore next */
	if (!accessToken) {
/* istanbul ignore next */
		console.error("No access token found for authUserId:", authUserId);
/* istanbul ignore next */
		return results;
	}

	try {
		// Twitch allows up to 100 IDs per request
		const chunks = [];
		for (let i = 0; i < missingIds.length; i += 100) {
			chunks.push(missingIds.slice(i, i + 100));
		}

		for (const chunk of chunks) {
			const response = await axios.get<TwitchApiResponse<Game>>("https://api.twitch.tv/helix/games", {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
				params: {
					id: chunk,
				},
			});

			const games = response.data.data;
			results.push(...games);

			const gamesById = new Map(games.map((g) => [g.id, g]));
			await setTwitchCacheBatch(
				TwitchCacheType.Game,
/* istanbul ignore next */
				chunk.map((id) => ({ key: id, value: gamesById.get(id) || null })),
				GAME_CACHE_TTL_SECONDS,
			);
		}

		return results;
	} catch (error) {
/* istanbul ignore next */
		logTwitchError("Error fetching bulk game details", error);
/* istanbul ignore next */
		return results;
	}
}

export async function getGameDetails(gameId: string, authUserId: string): Promise<Game | null> {
	const url = "https://api.twitch.tv/helix/games";
	const GAME_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
	const cacheKey = gameId;

	const cachedEntry = await getTwitchCacheEntry<Game | null>(TwitchCacheType.Game, cacheKey);
	if (cachedEntry.hit) return cachedEntry.value;

/* istanbul ignore next */
	let accessToken = authUserId ? (await getAccessToken(authUserId))?.accessToken : undefined;
	if (!accessToken) {
		const appToken = await getAppAccessToken();
		accessToken = appToken?.access_token;
	}

	if (!accessToken) {
		console.error("No access token found for authUserId:", authUserId);
		return null;
	}

	try {
		const response = await axios.get<TwitchApiResponse<Game>>(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
/* istanbul ignore next */
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				id: gameId,
			},
		});
/* istanbul ignore next */
		const game = response.data.data[0] || null;
		await setTwitchCache(TwitchCacheType.Game, cacheKey, game, GAME_CACHE_TTL_SECONDS);
		return game;
	} catch (error) {
		const stale = await getTwitchCacheStale<Game | null>(TwitchCacheType.Game, cacheKey);
		if (stale !== null) return stale;
		logTwitchError("Error fetching game details", error);
		return null;
	}
}

export async function getReward(userId: string, rewardId: string): Promise<TwitchReward | null> {
	const url = `https://api.twitch.tv/helix/channel_points/custom_rewards`;
	const token = await getAccessToken(userId);

	if (!token) {
		console.error("No access token found for userId:", userId);
		return null;
	}

	try {
		const response = await axios.get<TwitchApiResponse<TwitchReward>>(url, {
			headers: {
				Authorization: `Bearer ${token.accessToken}`,
/* istanbul ignore next */
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				id: rewardId,
				broadcaster_id: userId,
			},
		});
/* istanbul ignore next */
		return response.data.data[0] || null;
	} catch (error) {
		if (axios.isAxiosError(error) && error.response?.status === 404) {
			throw new Error(REWARD_NOT_FOUND);
		}
		logTwitchError("Error fetching reward", error);
		return null;
	}
}

export async function subscribeToReward(userId: string, rewardId: string): Promise<void> {
	const url = "https://api.twitch.tv/helix/eventsub/subscriptions";
	const token = await getAppAccessToken();

	if (!token) {
		console.error("No app access token found");
		return;
	}

	let eventsubCallback = process.env.TWITCH_EVENTSUB_URL;

	if (await isPreview()) {
		const baseUrl = await getBaseUrl();
		eventsubCallback = new URL("/eventsub", baseUrl).toString();
	}

	try {
		await axios.post(
			url,
			{
				type: "channel.channel_points_custom_reward_redemption.add",
				version: "1",
				condition: {
					broadcaster_user_id: userId,
					reward_id: rewardId,
				},
				transport: {
					method: "webhook",
					callback: eventsubCallback,
					secret: process.env.WEBHOOK_SECRET,
				},
			},
			{
				headers: {
					Authorization: `Bearer ${token.access_token}`,
/* istanbul ignore next */
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
			},
		);
	} catch (error) {
		if (axios.isAxiosError(error) && error.response?.status === 429) {
			const shouldAutoClear = (await isPreview()) || process.env.NODE_ENV !== "production" || process.env.TWITCH_EVENTSUB_AUTO_CLEAR === "1";
			if (shouldAutoClear) {
				const deleted = await clearEventSubSubscriptionsByTypeAndCondition({
					type: "channel.channel_points_custom_reward_redemption.add",
					conditionMatch: {
						broadcaster_user_id: userId,
						reward_id: rewardId,
					},
				});

				if (deleted > 0) {
					try {
						await axios.post(
							url,
							{
								type: "channel.channel_points_custom_reward_redemption.add",
								version: "1",
								condition: {
									broadcaster_user_id: userId,
									reward_id: rewardId,
								},
								transport: {
									method: "webhook",
									callback: eventsubCallback,
									secret: process.env.WEBHOOK_SECRET,
								},
							},
							{
								headers: {
									Authorization: `Bearer ${token.access_token}`,
/* istanbul ignore next */
									"Client-Id": process.env.TWITCH_CLIENT_ID || "",
								},
							},
						);
						return;
					} catch (retryError) {
						logTwitchError("Error subscribing to reward after clearing EventSub", retryError);
						return;
					}
				}
			}
		}
		if (axios.isAxiosError(error) && error.response?.status === 409) {
			return;
		}
		logTwitchError("Error subscribing to reward", error);
	}
}

export async function updateRedemptionStatus(userId: string, redemptionId: string, rewardId: string, status: RewardStatus) {
	const url = "https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions";
	const token = await getAccessToken(userId);

	if (!token) {
		console.error("No app access token found");
		return;
	}

	try {
		await axios.patch(
			url,
			{
				status,
			},
			{
				headers: {
					Authorization: `Bearer ${token.accessToken}`,
/* istanbul ignore next */
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
				params: {
					id: redemptionId,
					broadcaster_id: userId,
					reward_id: rewardId,
				},
			},
		);
	} catch (error) {
		logTwitchError("Error updating redemption status", error);
	}
}

export async function subscribeToChat(userId: string) {
	const url = "https://api.twitch.tv/helix/eventsub/subscriptions";
	const token = await getAppAccessToken();

	if (!token) {
		console.error("No app access token found");
		return;
	}

	let eventsubCallback = process.env.TWITCH_EVENTSUB_URL;

	if (await isPreview()) {
		const baseUrl = await getBaseUrl();
		eventsubCallback = new URL("/eventsub", baseUrl).toString();
	}

	try {
		await axios.post(
			url,
			{
				type: "channel.chat.message",
				version: "1",
				condition: {
					broadcaster_user_id: userId,
/* istanbul ignore next */
					user_id: process.env.TWITCH_USER_ID || "",
				},
				transport: {
					method: "webhook",
					callback: eventsubCallback,
					secret: process.env.WEBHOOK_SECRET,
				},
			},
			{
				headers: {
					Authorization: `Bearer ${token.access_token}`,
/* istanbul ignore next */
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
			},
		);
	} catch (error) {
		if (axios.isAxiosError(error) && error.response?.status === 429) {
			const shouldAutoClear = (await isPreview()) || process.env.NODE_ENV !== "production" || process.env.TWITCH_EVENTSUB_AUTO_CLEAR === "1";
			if (shouldAutoClear) {
				const deleted = await clearEventSubSubscriptionsByTypeAndCondition({
					type: "channel.chat.message",
					conditionMatch: {
						broadcaster_user_id: userId,
/* istanbul ignore next */
						user_id: process.env.TWITCH_USER_ID || "",
					},
				});

/* istanbul ignore next */
				if (deleted > 0) {
					try {
						await axios.post(
							url,
							{
								type: "channel.chat.message",
								version: "1",
								condition: {
									broadcaster_user_id: userId,
/* istanbul ignore next */
									user_id: process.env.TWITCH_USER_ID || "",
								},
								transport: {
									method: "webhook",
									callback: eventsubCallback,
									secret: process.env.WEBHOOK_SECRET,
								},
							},
							{
								headers: {
									Authorization: `Bearer ${token.access_token}`,
/* istanbul ignore next */
									"Client-Id": process.env.TWITCH_CLIENT_ID || "",
								},
							},
						);
						return;
					} catch (retryError) {
						logTwitchError("Error subscribing to chat after clearing EventSub", retryError);
						return;
					}
				}
			}
		}
		if (axios.isAxiosError(error) && error.response?.status === 409) {
			return;
		}
		logTwitchError("Error subscribing to chat", error);
	}
}

export async function sendChatMessage(userId: string, message: string) {
	const url = "https://api.twitch.tv/helix/chat/messages";
	const token = await getAppAccessToken();

	if (!token) {
		console.error("No app access token found");
		return;
	}

	try {
		await axios.post(
			url,
			{
				message,
				broadcaster_id: userId,
/* istanbul ignore next */
				sender_id: process.env.TWITCH_USER_ID || "",
			},
			{
				headers: {
					Authorization: `Bearer ${token.access_token}`,
/* istanbul ignore next */
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
			},
		);
	} catch (error) {
		logTwitchError("Error sending chat message", error);
	}
}

export async function handleClip(input: string, broadcasterId: string) {
	const twitchClipRegex = /^https?:\/\/(?:www\.)?twitch\.tv\/(\w+)\/clip\/([A-Za-z0-9_-]+)|^https?:\/\/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/;
	const match = input.match(twitchClipRegex);

	if (!match) {
		console.error("Invalid Twitch clip URL:", input);

		return { errorCode: 1 };
	}

	const clipId = match[2] || match[3];
	if (!clipId) {
		console.error("Could not extract clip ID from URL:", input);

		return { errorCode: 2 };
	}

	const clip = await getTwitchClip(clipId, broadcasterId);

	if (!clip) {
		console.error("Failed to fetch clip", clipId);

		return { errorCode: 3 };
	}

	if (clip.broadcaster_id !== broadcasterId) {
		console.error("Clip does not belong to the specified creator:", broadcasterId);

		return { errorCode: 4 };
	}

	return clip;
}


