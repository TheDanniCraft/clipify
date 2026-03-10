"use server";

import axios from "axios";
import { AuthenticatedUser, Game, Overlay, OverlayType, RewardStatus, TwitchApiResponse, TwitchAppAccessTokenResponse, TwitchCacheType, TwitchClip, TwitchClipResponse, TwitchReward, TwitchRewardResponse, TwitchTokenApiResponse, TwitchUserResponse } from "@types";
import { deleteTwitchCacheByPrefix, deleteTwitchCacheKeys, getAccessToken, getOverlayBySecret, getOverlayPublic, getTwitchCache, getTwitchCacheBatch, getTwitchCacheByPrefixEntries, getTwitchCacheEntry, getTwitchCacheStale, getTwitchCacheStaleBatch, setTwitchCache, setTwitchCacheBatch } from "@actions/database";
import { getBaseUrl, isPreview } from "@actions/utils";
import { isTitleBlocked } from "@/app/utils/regexFilter";
import { dbPool } from "@/db/client";
import { REWARD_NOT_FOUND } from "@lib/twitchErrors";
import { validateAuth } from "@actions/auth";

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
	backfillComplete?: boolean;
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

const CLIP_SYNC_INCREMENTAL_INTERVAL_MS = 10 * 60 * 1000;
const CLIP_SYNC_BACKFILL_INTERVAL_MS = 2 * 60 * 1000;
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
	if (!value || typeof value !== "object") return null;
	if ("clip" in value && value.clip) return value.clip;
	if ("id" in value && typeof value.id === "string") return value as TwitchClip;
	return null;
}

async function getClipSyncState(ownerId: string): Promise<ClipSyncState> {
	const state = await getTwitchCache<ClipSyncState>(TwitchCacheType.Clip, CLIP_SYNC_STATE_KEY(ownerId));
	return state ?? {};
}

async function setClipSyncState(ownerId: string, state: ClipSyncState) {
	await setTwitchCache(TwitchCacheType.Clip, CLIP_SYNC_STATE_KEY(ownerId), state);
}

async function getClipForceRefreshState(ownerId: string): Promise<ClipForceRefreshState> {
	const state = await getTwitchCache<ClipForceRefreshState>(TwitchCacheType.Clip, CLIP_FORCE_REFRESH_KEY(ownerId));
	return state ?? {};
}

async function setClipForceRefreshState(ownerId: string, state: ClipForceRefreshState) {
	await setTwitchCache(TwitchCacheType.Clip, CLIP_FORCE_REFRESH_KEY(ownerId), state);
}

async function getCachedClipsByOwner(ownerId: string): Promise<TwitchClip[]> {
	const entries = await getTwitchCacheByPrefixEntries<CachedClipValue | TwitchClip>(TwitchCacheType.Clip, CLIP_CACHE_PREFIX(ownerId));
	const deduped = new Map<string, TwitchClip>();
	for (const entry of entries) {
		const value = entry.value as CachedClipValue | TwitchClip;
		if ((value as CachedClipValue).unavailable) {
			const lastValidatedAt = (value as CachedClipValue).lastValidatedAt;
			const parsed = lastValidatedAt ? Date.parse(lastValidatedAt) : Number.NaN;
			const stale = !Number.isFinite(parsed) || Date.now() - parsed >= CLIP_VALIDATION_STALE_MS;
			if (!stale) continue;
		}
		const clip = parseCachedClipValue(entry.value);
		if (!clip?.id) continue;
		if (deduped.has(clip.id)) continue;
		deduped.set(clip.id, clip);
	}
	return Array.from(deduped.values());
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
	const cachedValue = cached && typeof cached === "object" ? (cached as CachedClipValue | TwitchClip) : null;
	const cachedClip = parseCachedClipValue(cachedValue);
	const isStaleValidation = (lastValidatedAt?: string): boolean => {
		if (!lastValidatedAt) return true;
		const timestamp = Date.parse(lastValidatedAt);
		if (!Number.isFinite(timestamp)) return true;
		return Date.now() - timestamp >= CLIP_VALIDATION_STALE_MS;
	};

	if (cachedValue && "unavailable" in cachedValue && (cachedValue as CachedClipValue).unavailable) {
		const lastValidatedAt = (cachedValue as CachedClipValue).lastValidatedAt;
		const stale = isStaleValidation(lastValidatedAt);
		if (!stale) return null;
	}

	const lastValidatedAt = cachedValue && "lastValidatedAt" in (cachedValue as CachedClipValue) ? (cachedValue as CachedClipValue).lastValidatedAt : undefined;
	const stale = isStaleValidation(lastValidatedAt);
	if (!stale) {
		return cachedClip ?? clip;
	}

	const fresh = await getTwitchClip(clip.id, ownerId);
	if (!fresh) {
		await setTwitchCache(
			TwitchCacheType.Clip,
			key,
			{
				clip: cachedClip ?? clip,
				unavailable: true,
				lastSeenAt: (cachedValue as CachedClipValue | null)?.lastSeenAt ?? nowIso,
				lastValidatedAt: nowIso,
			} satisfies CachedClipValue,
		);
		return null;
	}

	await setTwitchCache(
		TwitchCacheType.Clip,
		key,
		{
			clip: fresh,
			unavailable: false,
			lastSeenAt: nowIso,
			lastValidatedAt: nowIso,
		} satisfies CachedClipValue,
	);
	return fresh;
}

async function fetchClipPage(ownerId: string, accessToken: string, first: number, after?: string) {
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

async function clearEventSubSubscriptionsByTypeAndCondition({
	type,
	conditionMatch,
}: {
	type: string;
	conditionMatch: Record<string, string>;
}): Promise<number> {
	const subscriptions = await listEventSubSubscriptions(type);

	const targets = subscriptions.filter((sub) => {
		if (sub.type !== type) return false;
		if (!sub.condition) return false;
		for (const [key, value] of Object.entries(conditionMatch)) {
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
				client_id: process.env.TWITCH_CLIENT_ID || "",
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
				client_id: process.env.TWITCH_CLIENT_ID || "",
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
			message =
				(typeof error.response?.data === "object" && error.response?.data && "message" in error.response.data && typeof error.response.data.message === "string"
					? error.response.data.message
					: error.message) || "unknown";
			invalidRefreshToken = status === 400 && message.toLowerCase().includes("invalid refresh token");
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
				client_id: process.env.TWITCH_CLIENT_ID || "",
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
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
		});
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
		if ((!userIds || userIds.length === 0) && (!userNames || userNames.length === 0)) {
			return [];
		}

		if (userIds && userNames) {
			console.error("You cannot provide both userIds and userNames");
			return [];
		}

		if ((userIds?.length ?? 0) >= 100 || (userNames?.length ?? 0) >= 100) {
			console.error("You cannot provide more than 100 userIds or userNames");
			return [];
		}

		let cachedUsers: TwitchUserResponse[] = [];
		let missingIds = ids;

		if (ids.length > 0) {
			cachedUsers = await getTwitchCacheBatch<TwitchUserResponse>(TwitchCacheType.User, ids);
			const cachedIds = new Set(cachedUsers.map((u) => u.id));
			missingIds = ids.filter((id) => !cachedIds.has(id));
			if (missingIds.length === 0) return cachedUsers;
		}

		const response = await axios.get<TwitchApiResponse<TwitchUserResponse>>(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: missingIds.length > 0 ? { id: missingIds } : { login: userNames },
		});

		const fresh = response.data.data;
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
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
			},
		);

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

		return response.data.data[0]?.game_id || null;
	} catch (error) {
		logTwitchError("Error fetching current category", error);
		return null;
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

		const token = await getAccessToken(ownerId);
		if (!token) return;

		let cachedClips: TwitchClip[] = [];
		if (ensurePackSize > 0) {
			cachedClips = await getCachedClipsByOwner(ownerId);
		}

		const syncState = await getClipSyncState(ownerId);
		const now = Date.now();
		const nextState: ClipSyncState = { ...syncState };
		const isSyncDue = (lastSyncAt: string | undefined, intervalMs: number): boolean => {
			if (!lastSyncAt) return true;
			const parsed = Date.parse(lastSyncAt);
			if (!Number.isFinite(parsed)) return true;
			return now - parsed >= intervalMs;
		};
		const incrementalDue =
			(ensurePackSize > 0 && cachedClips.length < ensurePackSize) ||
			isSyncDue(nextState.lastIncrementalSyncAt, CLIP_SYNC_INCREMENTAL_INTERVAL_MS);

		if (incrementalDue) {
			try {
				const first = ensurePackSize > 0 && cachedClips.length < ensurePackSize ? Math.max(1, Math.min(100, ensurePackSize - cachedClips.length)) : 100;
				const page = await fetchClipPage(ownerId, token.accessToken, first);
				await upsertClipsByOwner(ownerId, page.clips);
				nextState.lastIncrementalSyncAt = new Date(now).toISOString();
				if (page.cursor) {
					if (!nextState.backfillComplete && !nextState.backfillCursor) {
						nextState.backfillCursor = page.cursor;
					}
				}
				if (!page.cursor) {
					nextState.backfillComplete = true;
				}
			} catch (error) {
				logTwitchError("Error fetching incremental clip sync page", error);
			}
		}

		const backfillDue =
			!nextState.backfillComplete &&
			!!nextState.backfillCursor &&
			isSyncDue(nextState.lastBackfillSyncAt, CLIP_SYNC_BACKFILL_INTERVAL_MS);

		if (backfillDue && nextState.backfillCursor) {
			try {
				const page = await fetchClipPage(ownerId, token.accessToken, 100, nextState.backfillCursor);
				await upsertClipsByOwner(ownerId, page.clips);
				nextState.lastBackfillSyncAt = new Date(now).toISOString();
				nextState.backfillCursor = page.cursor;
				nextState.backfillComplete = !page.cursor;
			} catch (error) {
				logTwitchError("Error fetching backfill clip sync page", error);
			}
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

export async function getOwnClipForceRefreshStatus() {
	const user = await validateAuth(false);
	if (!user) return null;

	const state = await getClipForceRefreshState(user.id);
	const lastForcedAt = state.lastForcedAt ?? null;
	const lastForcedTs = lastForcedAt ? new Date(lastForcedAt).getTime() : 0;
	const now = Date.now();
	const nextAllowedTs = lastForcedTs > 0 ? lastForcedTs + CLIP_FORCE_REFRESH_COOLDOWN_MS : now;

	return {
		lastForcedAt,
		cooldownMs: CLIP_FORCE_REFRESH_COOLDOWN_MS,
		nextAllowedAt: new Date(nextAllowedTs).toISOString(),
		remainingMs: Math.max(0, nextAllowedTs - now),
		canRefresh: now >= nextAllowedTs,
	};
}

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

	await syncOwnerClipCache(overlay.ownerId);
	clips = await getCachedClipsByOwner(overlay.ownerId);

	if (overlayType === "Featured") {
		clips = clips.filter((clip) => !!((clip as TwitchClip & { is_featured?: boolean }).is_featured));
	} else if (overlayType !== "All") {
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

		// Filter for selected clip creators
		const allowedCreators = (overlay.clipCreatorsOnly ?? []).map((name) => name.toLowerCase());
		if (allowedCreators.length > 0) {
			clips = clips.filter((clip) => allowedCreators.includes(clip.creator_name.toLowerCase()) || allowedCreators.includes(clip.creator_id.toLowerCase()));
		}

		const blockedCreators = (overlay.clipCreatorsBlocked ?? []).map((name) => name.toLowerCase());
		if (blockedCreators.length > 0) {
			clips = clips.filter((clip) => !blockedCreators.includes(clip.creator_name.toLowerCase()) && !blockedCreators.includes(clip.creator_id.toLowerCase()));
		}

		// Filter for minimum views
		clips = clips.filter((clip) => {
			return clip.view_count >= overlay.minClipViews;
		});

		if (overlay.playbackMode === "top") {
			clips.sort((a, b) => b.view_count - a.view_count || b.created_at.localeCompare(a.created_at));
		}
	}

	return clips;
}

export async function getTwitchClipBatch(overlayId: string, overlaySecret?: string, type?: OverlayType, excludeClipIds: string[] = [], count = 50, skipFilter?: boolean): Promise<TwitchClip[]> {
	const overlay = overlaySecret ? await getOverlayBySecret(overlayId, overlaySecret) : await getOverlayPublic(overlayId);
	if (!overlay) return [];
	const all = await getTwitchClips(overlay, type, skipFilter);
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
				const creatorKey = clip.creator_id || clip.creator_name;
				recentCreatorCounts.set(creatorKey, (recentCreatorCounts.get(creatorKey) ?? 0) + 1);
				recentGameCounts.set(clip.game_id, (recentGameCounts.get(clip.game_id) ?? 0) + 1);
			}

			const sortedViews = remaining.map((clip) => clip.view_count).sort((a, b) => a - b);
			const medianViews = sortedViews.length > 0 ? sortedViews[Math.floor(sortedViews.length / 2)] : 0;
			const maxLogViews = Math.log1p(Math.max(1, ...sortedViews));

			const scored = remaining.map((clip) => {
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
				if (pick <= 0) {
					picked = entry.clip;
					break;
				}
			}

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
	if (cached !== null) return cached || undefined;

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
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				id: userId,
			},
		});
		const avatar = response.data.data[0]?.profile_image_url || "";
		await setTwitchCache(TwitchCacheType.Avatar, userId, avatar, AVATAR_CACHE_TTL_SECONDS);
		return avatar || undefined;
	} catch (error) {
		const stale = await getTwitchCacheStale<string>(TwitchCacheType.Avatar, userId);
		if (stale !== null) return stale || undefined;
		logTwitchError("Error fetching avatar", error);
		return undefined;
	}
}

export async function getGameDetails(gameId: string, authUserId: string): Promise<Game | null> {
	const url = "https://api.twitch.tv/helix/games";
	const GAME_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
	const cacheKey = gameId;

	const cachedEntry = await getTwitchCacheEntry<Game | null>(TwitchCacheType.Game, cacheKey);
	if (cachedEntry.hit) return cachedEntry.value;

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
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				id: gameId,
			},
		});
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
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				id: rewardId,
				broadcaster_id: userId,
			},
		});
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
						user_id: process.env.TWITCH_USER_ID || "",
					},
				});

				if (deleted > 0) {
					try {
						await axios.post(
							url,
							{
								type: "channel.chat.message",
								version: "1",
								condition: {
									broadcaster_user_id: userId,
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
				sender_id: process.env.TWITCH_USER_ID || "",
			},
			{
				headers: {
					Authorization: `Bearer ${token.access_token}`,
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
