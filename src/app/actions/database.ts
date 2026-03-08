"use server";

import { tokenTable, usersTable, overlaysTable, queueTable, settingsTable, modQueueTable, editorsTable, twitchCacheTable } from "@/db/schema";
import { db } from "@/db/client";
import { AuthenticatedUser, Overlay, TwitchUserResponse, TwitchTokenApiResponse, UserToken, Plan, Role, UserSettings, TwitchCacheType, StatusOptions, OverlayType, PlaybackMode, MaxDurationMode, TwitchClip } from "@types";
import { getUserDetails, getUsersDetailsBulk, refreshAccessToken, subscribeToReward } from "@actions/twitch";
import { eq, inArray, and, or, isNull, lt, gt, sql, desc } from "drizzle-orm";
import { validateAuth } from "@actions/auth";
import { encryptToken, decryptToken } from "@lib/tokenCrypto";
import { getFeatureAccess } from "@lib/featureAccess";
import { ensureReverseTrialGrantForUser, resolveUserEntitlements, resolveUserEntitlementsForUsers } from "@lib/entitlements";

const TWITCH_CACHE_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastTwitchCacheCleanupAt = 0;
const FONT_URL_DELIMITER = "||url||";
const ALLOWED_FONT_CSS_HOSTS = new Set(["fonts.googleapis.com"]);
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR_PATTERN = /^rgba?\(\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i;
const HSL_COLOR_PATTERN = /^hsla?\(\s*(?:360|3[0-5]\d|[12]?\d?\d)(?:\.\d+)?\s*,\s*(?:100|[1-9]?\d)(?:\.\d+)?%\s*,\s*(?:100|[1-9]?\d)(?:\.\d+)?%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i;

function escapeLikePattern(value: string) {
	return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

type CacheReadMetrics = {
	hits: number;
	misses: number;
	staleHits: number;
	lastReadAt: string | null;
	startedAt: string;
};

declare global {
	// eslint-disable-next-line no-var
	var __twitchCacheReadMetrics: CacheReadMetrics | undefined;
}

function getCacheReadMetricsStore(): CacheReadMetrics {
	if (!globalThis.__twitchCacheReadMetrics) {
		globalThis.__twitchCacheReadMetrics = {
			hits: 0,
			misses: 0,
			staleHits: 0,
			lastReadAt: null,
			startedAt: new Date().toISOString(),
		};
	}
	return globalThis.__twitchCacheReadMetrics;
}

function recordCacheRead(hit: boolean, stale = false) {
	const metrics = getCacheReadMetricsStore();
	if (hit) metrics.hits += 1;
	else metrics.misses += 1;
	if (stale && hit) metrics.staleHits += 1;
	metrics.lastReadAt = new Date().toISOString();
}

function recordCacheBatchReads(hits: number, requested: number, stale = false) {
	for (let i = 0; i < hits; i++) recordCacheRead(true, stale);
	const misses = Math.max(0, requested - hits);
	for (let i = 0; i < misses; i++) recordCacheRead(false, stale);
}

export async function getTwitchCacheReadMetricsSnapshot() {
	const metrics = getCacheReadMetricsStore();
	const total = metrics.hits + metrics.misses;
	const hitRate = total > 0 ? metrics.hits / total : 0;
	return {
		...metrics,
		totalReads: total,
		hitRate,
	};
}

const cleanupTwitchCacheIfNeeded = async (now: Date) => {
	if (now.getTime() - lastTwitchCacheCleanupAt < TWITCH_CACHE_CLEANUP_INTERVAL_MS) return;
	lastTwitchCacheCleanupAt = now.getTime();
	await db.delete(twitchCacheTable).where(lt(twitchCacheTable.expiresAt, now)).execute();
};

const OVERLAY_TOUCH_INTERVAL = sql`now() - interval '1 minute'`;

export async function touchUser(userId: string, tx = db) {
	await tx.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, userId)).execute();
}

export async function touchOverlay(overlayId: string, tx = db) {
	await tx
		.update(overlaysTable)
		.set({ lastUsedAt: new Date() })
		.where(and(eq(overlaysTable.id, overlayId), or(isNull(overlaysTable.lastUsedAt), lt(overlaysTable.lastUsedAt, OVERLAY_TOUCH_INTERVAL))))
		.execute();
}

type OverlayPatch = Partial<
	Pick<
		Overlay,
		| "name"
		| "status"
		| "type"
		| "rewardId"
		| "minClipDuration"
		| "maxClipDuration"
		| "maxDurationMode"
		| "blacklistWords"
		| "minClipViews"
		| "playbackMode"
		| "preferCurrentCategory"
		| "clipCreatorsOnly"
		| "clipCreatorsBlocked"
		| "clipPackSize"
		| "playerVolume"
		| "showChannelInfo"
		| "showClipInfo"
		| "showTimer"
		| "showProgressBar"
		| "overlayInfoFadeOutSeconds"
		| "themeFontFamily"
		| "themeTextColor"
		| "themeAccentColor"
		| "themeBackgroundColor"
		| "progressBarStartColor"
		| "progressBarEndColor"
		| "borderSize"
		| "borderRadius"
		| "effectScanlines"
		| "effectStatic"
		| "effectCrt"
		| "channelInfoX"
		| "channelInfoY"
		| "clipInfoX"
		| "clipInfoY"
		| "timerX"
		| "timerY"
		| "channelScale"
		| "clipScale"
		| "timerScale"
	>
>;

function clampInteger(value: number | null | undefined, min: number, max: number, fallback: number) {
	return Math.round(Math.max(min, Math.min(max, value ?? fallback)));
}

function normalizeCreatorFilters(values: string[] | null | undefined) {
	return Array.from(new Set((values ?? []).map((name) => name.trim().toLowerCase()).filter(Boolean)));
}

function sanitizeThemeFontFamilyValue(value: string | null | undefined) {
	const trimmed = (value ?? "").trim();
	if (!trimmed) return "inherit";
	if (trimmed.length > 200) return "inherit";
	if (trimmed.includes(FONT_URL_DELIMITER)) return "inherit";
	if (!/^[-,./\s"'0-9A-Za-z]+$/.test(trimmed)) return "inherit";
	return trimmed;
}

function sanitizeThemeFontUrl(value: string | null | undefined) {
	const trimmed = (value ?? "").trim();
	if (!trimmed) return "";

	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== "https:") return "";
		if (!ALLOWED_FONT_CSS_HOSTS.has(parsed.hostname.toLowerCase())) return "";
		return parsed.toString();
	} catch {
		return "";
	}
}

function sanitizeThemeFontSetting(value: string | null | undefined) {
	const raw = (value ?? "").trim();
	if (!raw) return "inherit";

	if (!raw.includes(FONT_URL_DELIMITER)) {
		return sanitizeThemeFontFamilyValue(raw);
	}

	const [rawFamily, rawUrl] = raw.split(FONT_URL_DELIMITER);
	const family = sanitizeThemeFontFamilyValue(rawFamily);
	const safeUrl = sanitizeThemeFontUrl(rawUrl);
	if (!safeUrl) return family;
	return `${family}${FONT_URL_DELIMITER}${safeUrl}`;
}

function sanitizeCssColor(value: string | null | undefined, fallback: string) {
	const trimmed = (value ?? "").trim();
	if (!trimmed) return fallback;
	if (trimmed.toLowerCase() === "transparent") return "transparent";
	if (HEX_COLOR_PATTERN.test(trimmed) || RGB_COLOR_PATTERN.test(trimmed) || HSL_COLOR_PATTERN.test(trimmed)) return trimmed;
	return fallback;
}

function buildOverlayUpdatePayload(next: Overlay, advancedAllowed: boolean) {
	const rewardId = advancedAllowed ? (next.rewardId ?? null) : null;

	return {
		name: next.name,
		status: next.status,
		type: next.type,
		rewardId,
		updatedAt: new Date(),
		minClipDuration: advancedAllowed ? next.minClipDuration : 0,
		maxClipDuration: advancedAllowed ? next.maxClipDuration : 60,
		maxDurationMode: advancedAllowed ? next.maxDurationMode : MaxDurationMode.Filter,
		blacklistWords: advancedAllowed ? next.blacklistWords : [],
		minClipViews: advancedAllowed ? next.minClipViews : 0,
		playbackMode: advancedAllowed ? next.playbackMode : PlaybackMode.Random,
		preferCurrentCategory: advancedAllowed ? !!next.preferCurrentCategory : false,
		clipCreatorsOnly: advancedAllowed ? normalizeCreatorFilters(next.clipCreatorsOnly) : [],
		clipCreatorsBlocked: advancedAllowed ? normalizeCreatorFilters(next.clipCreatorsBlocked) : [],
		clipPackSize: advancedAllowed ? Math.max(25, Math.min(500, next.clipPackSize ?? 100)) : 100,
		playerVolume: advancedAllowed ? Math.max(0, Math.min(100, next.playerVolume ?? 50)) : 50,
		showChannelInfo: advancedAllowed ? !!next.showChannelInfo : true,
		showClipInfo: advancedAllowed ? !!next.showClipInfo : true,
		showTimer: advancedAllowed ? !!next.showTimer : false,
		showProgressBar: advancedAllowed ? !!next.showProgressBar : false,
		overlayInfoFadeOutSeconds: advancedAllowed ? Math.max(0, Math.min(30, next.overlayInfoFadeOutSeconds ?? 6)) : 6,
		themeFontFamily: advancedAllowed ? sanitizeThemeFontSetting(next.themeFontFamily) : "inherit",
		themeTextColor: advancedAllowed ? sanitizeCssColor(next.themeTextColor, "#FFFFFF") : "#FFFFFF",
		themeAccentColor: advancedAllowed ? sanitizeCssColor(next.themeAccentColor, "#7C3AED") : "#7C3AED",
		themeBackgroundColor: advancedAllowed ? sanitizeCssColor(next.themeBackgroundColor, "rgba(10,10,10,0.65)") : "rgba(10,10,10,0.65)",
		progressBarStartColor: advancedAllowed ? sanitizeCssColor(next.progressBarStartColor, "#26018E") : "#26018E",
		progressBarEndColor: advancedAllowed ? sanitizeCssColor(next.progressBarEndColor, "#8D42F9") : "#8D42F9",
		borderSize: advancedAllowed ? Math.max(0, Math.min(32, next.borderSize ?? 0)) : 0,
		borderRadius: advancedAllowed ? Math.max(0, Math.min(48, next.borderRadius ?? 10)) : 10,
		effectScanlines: advancedAllowed ? !!next.effectScanlines : false,
		effectStatic: advancedAllowed ? !!next.effectStatic : false,
		effectCrt: advancedAllowed ? !!next.effectCrt : false,
		channelInfoX: advancedAllowed ? clampInteger(next.channelInfoX, 0, 100, 0) : 0,
		channelInfoY: advancedAllowed ? clampInteger(next.channelInfoY, 0, 100, 0) : 0,
		clipInfoX: advancedAllowed ? clampInteger(next.clipInfoX, 0, 100, 100) : 100,
		clipInfoY: advancedAllowed ? clampInteger(next.clipInfoY, 0, 100, 100) : 100,
		timerX: advancedAllowed ? clampInteger(next.timerX, 0, 100, 100) : 100,
		timerY: advancedAllowed ? clampInteger(next.timerY, 0, 100, 0) : 0,
		channelScale: advancedAllowed ? clampInteger(next.channelScale, 50, 250, 100) : 100,
		clipScale: advancedAllowed ? clampInteger(next.clipScale, 50, 250, 100) : 100,
		timerScale: advancedAllowed ? clampInteger(next.timerScale, 50, 250, 100) : 100,
	};
}

async function requireUser(): Promise<AuthenticatedUser | null> {
	const user = await validateAuth(false);
	if (!user) {
		console.warn(`Unauthenticated request`);
		return null;
	}
	return user;
}

async function canEditOwner(editorId: string, ownerId: string): Promise<boolean> {
	if (editorId === ownerId) return true;

	const editorRows = await db
		.select()
		.from(editorsTable)
		.where(and(eq(editorsTable.editorId, editorId), eq(editorsTable.userId, ownerId)))
		.limit(1)
		.execute();

	return !!editorRows?.[0];
}

async function requireOverlayAccess(overlayId: string): Promise<{ user: AuthenticatedUser; overlay: Overlay } | null> {
	const user = await requireUser();
	if (!user) return null;

	const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.id, overlayId)).limit(1).execute();
	const overlay = overlays[0];
	if (!overlay) return null;

	if (!(await canEditOwner(user.id, overlay.ownerId))) {
		console.warn(`Unauthorized overlay access for user id: ${user.id} on overlay id: ${overlayId}`);
		return null;
	}

	return { user, overlay };
}

async function requireOverlaySecretAccess(overlayId: string, secret?: string): Promise<Overlay | null> {
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

	return overlay;
}

async function setUser(user: TwitchUserResponse): Promise<AuthenticatedUser> {
	try {
		const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, user.id)).limit(1).execute();
		const isNewUser = existing.length === 0;
		const dbUser = await db
			.insert(usersTable)
			.values({
				id: user.id,
				username: user.login,
				email: user.email,
				avatar: user.profile_image_url,
				role: Role.User,
				plan: Plan.Free,
			})
			.onConflictDoUpdate({
				target: usersTable.id,
				set: {
					username: user.login,
					email: user.email,
					avatar: user.profile_image_url,
					updatedAt: new Date(),
				},
			})
			.returning()
			.then((result) => result[0]);

		if (isNewUser) {
			await ensureReverseTrialGrantForUser({ id: dbUser.id, plan: dbUser.plan });
		}

		return dbUser;
	} catch (error) {
		console.error("Error inserting user:", error);
		throw new Error("Failed to insert user");
	}
}

export async function getUser(id: string): Promise<AuthenticatedUser | null> {
	try {
		const isAuthenticated = await validateAuth(true);
		if (!isAuthenticated || isAuthenticated.id !== id) {
			console.warn(`Unauthenticated "getUser" API request for user id: ${id}`);
			return null;
		}

		const user = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1).execute();

		return user[0] || null;
	} catch (error) {
		console.error("Error fetching user:", error);
		throw new Error("Failed to fetch user");
	}
}

async function getUserPlanByIdInternal(id: string): Promise<Plan | null> {
	try {
		const user = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1).execute();

		if (user.length === 0) {
			return null;
		}

		return user[0].plan;
	} catch (error) {
		console.error("Error fetching user plan:", error);
		throw new Error("Failed to fetch user plan");
	}
}

export async function getUserPlan(id: string): Promise<Plan | null> {
	const user = await requireUser();
	if (!user || user.id !== id) {
		console.warn(`Unauthorized "getUserPlan" API request for user id: ${id}`);
		return null;
	}

	return getUserPlanByIdInternal(id);
}

export async function getUserPlanById(id: string): Promise<Plan | null> {
	const user = await requireUser();
	if (!user || user.id !== id) {
		console.warn(`Unauthorized "getUserPlanById" API request for user id: ${id}`);
		return null;
	}

	return getUserPlanByIdInternal(id);
}

export async function getUserPlanByIdServer(id: string): Promise<Plan | null> {
	return getUserPlanByIdInternal(id);
}

export async function deleteUser(id: string): Promise<AuthenticatedUser | null> {
	try {
		const isAuthenticated = await validateAuth(true);
		if (!isAuthenticated || isAuthenticated.id !== id) {
			console.warn(`Unauthenticated "deleteUser" API request for user id: ${id}`);
			return null;
		}

		const user = await db.delete(usersTable).where(eq(usersTable.id, id)).returning().execute();

		return user[0];
	} catch (error) {
		console.error("Error deleting user:", error);
		throw new Error("Failed to delete user");
	}
}

export async function updateUserSubscription(userId: string, customerId: string, plan: Plan): Promise<AuthenticatedUser | null> {
	try {
		const user = await db
			.update(usersTable)
			.set({
				plan,
				stripeCustomerId: customerId,
				updatedAt: new Date(),
			})
			.where(eq(usersTable.id, userId))
			.returning()
			.execute();

		return user[0];
	} catch (error) {
		console.error("Error updating user subscription:", error);
		throw new Error("Failed to update user subscription");
	}
}

export async function getUserByCustomerId(customerId: string): Promise<AuthenticatedUser | null> {
	try {
		const user = await db.select().from(usersTable).where(eq(usersTable.stripeCustomerId, customerId)).limit(1).execute();

		return user[0] || null;
	} catch (error) {
		console.error("Error fetching user by customer ID:", error);
		return null;
	}
}

// Server-only helper for internal lookups.
export async function getUserByIdServer(id: string): Promise<Pick<AuthenticatedUser, "id" | "plan" | "createdAt" | "entitlements"> | null> {
	try {
		const user = await db.select({ id: usersTable.id, plan: usersTable.plan, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, id)).limit(1).execute();
		if (!user[0]) return null;
		const entitlements = await resolveUserEntitlements(user[0]);
		return { ...user[0], entitlements };
	} catch (error) {
		console.error("Error fetching user by id:", error);
		return null;
	}
}

export async function setAccessToken(token: TwitchTokenApiResponse): Promise<AuthenticatedUser | null> {
	try {
		const user = await getUserDetails(token.access_token);
		if (!user) {
			throw new Error("Failed to get user details");
		}

		const dbUser = await setUser(user);

		const expiresAt = new Date(Date.now() + token.expires_in * 1000);

		const aad = `twitchUser:${user.id}:oauth`;

		await db
			.insert(tokenTable)
			.values({
				id: user.id,
				accessToken: encryptToken(token.access_token, aad),
				refreshToken: encryptToken(token.refresh_token, aad),
				expiresAt: expiresAt,
				scope: token.scope,
				tokenType: token.token_type,
			})
			.onConflictDoUpdate({
				target: tokenTable.id,
				set: {
					accessToken: encryptToken(token.access_token, aad),
					refreshToken: encryptToken(token.refresh_token, aad),
					expiresAt: expiresAt,
					scope: token.scope,
					tokenType: token.token_type,
				},
			});

		return dbUser;
	} catch (error) {
		console.error("Error setting access token:", error);
		throw new Error("Failed to set access token");
	}
}

export async function getAccessToken(userId: string): Promise<UserToken | null> {
	try {
		const rows = await db.select().from(tokenTable).where(eq(tokenTable.id, userId)).limit(1).execute();

		if (rows.length === 0) return null;

		const row = rows[0];

		const aad = `twitchUser:${userId}:oauth`;

		let accessToken: string;
		let refreshToken: string;

		try {
			accessToken = decryptToken(row.accessToken, aad);
			refreshToken = decryptToken(row.refreshToken, aad);
		} catch {
			// key mismatch or tampered data => require re-login
			console.error("Token decrypt failed for user:", userId);
			return null;
		}

		const currentTime = new Date();
		const expiresAt = row.expiresAt;

		if (currentTime > expiresAt) {
			const newToken = await refreshAccessToken(refreshToken);

			if (!newToken) {
				return null;
			}

			await setAccessToken(newToken);
			return {
				id: userId,
				accessToken: newToken.access_token,
				refreshToken: newToken.refresh_token,
				expiresAt: new Date(Date.now() + newToken.expires_in * 1000),
				scope: newToken.scope,
				tokenType: newToken.token_type,
			};
		}

		return {
			id: userId,
			accessToken: accessToken,
			refreshToken: refreshToken,
			expiresAt: expiresAt,
			scope: row.scope,
			tokenType: row.tokenType,
		};
	} catch (error) {
		console.error("Error fetching access token:", error);
		throw new Error("Failed to fetch access token");
	}
}

export async function getAllOverlays(userId: string) {
	try {
		const user = await requireUser();
		if (!user || user.id !== userId) {
			console.warn(`Unauthorized "getAllOverlays" API request for user id: ${userId}`);
			return null;
		}
		const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, userId)).execute();

		return overlays;
	} catch (error) {
		console.error("Error fetching overlays:", error);
		throw new Error("Failed to fetch overlays");
	}
}

export async function getAllOverlayIds(userId: string) {
	try {
		const user = await requireUser();
		if (!user || user.id !== userId) {
			console.warn(`Unauthorized "getAllOverlayIds" API request for user id: ${userId}`);
			return null;
		}
		const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, userId)).execute();

		return overlays.map((overlay) => overlay.id);
	} catch (error) {
		console.error("Error fetching overlays:", error);
		throw new Error("Failed to fetch overlays");
	}
}

export async function getEditorAccess(userId: string) {
	try {
		const isAuthenticated = await validateAuth(true);
		if (!isAuthenticated || isAuthenticated.id !== userId) {
			console.warn(`Unauthenticated "getEditorAccess" API request for user id: ${userId}`);
			return null;
		}
		const editorRows = await db.select().from(editorsTable).where(eq(editorsTable.editorId, userId)).execute();

		return editorRows;
	} catch (error) {
		console.error("Error checking editor access:", error);
		throw new Error("Failed to check editor access");
	}
}

export async function getAllOverlayIdsByOwner(ownerId: string) {
	try {
		const user = await requireUser();
		if (!user || user.id !== ownerId) {
			console.warn(`Unauthorized "getAllOverlayIdsByOwner" API request for user id: ${ownerId}`);
			return null;
		}
		const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, ownerId)).execute();

		return overlays.map((overlay) => overlay.id);
	} catch (error) {
		console.error("Error fetching overlays:", error);
		throw new Error("Failed to fetch overlays");
	}
}

// Server-only helper for internal lookups (do not call from client components).
export async function getAllOverlayIdsByOwnerServer(ownerId: string) {
	try {
		const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, ownerId)).execute();

		return overlays.map((overlay) => overlay.id);
	} catch (error) {
		console.error("Error fetching overlays:", error);
		throw new Error("Failed to fetch overlays");
	}
}

// Server-only helper used by chat command actions.
export async function getAllOverlaysByOwnerServer(ownerId: string) {
	try {
		return await db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, ownerId)).execute();
	} catch (error) {
		console.error("Error fetching overlays:", error);
		throw new Error("Failed to fetch overlays");
	}
}

// Server-only helper for clip cache daemon.
export async function getActiveOverlayOwnerIdsForClipSync(batchSize = 50) {
	try {
		const limitedBatchSize = Math.max(1, Math.floor(batchSize));
		const scoreExpr = sql<Date>`max(coalesce(${overlaysTable.lastUsedAt}, ${overlaysTable.createdAt}))`;
		const rows = await db
			.select({ ownerId: overlaysTable.ownerId, score: scoreExpr })
			.from(overlaysTable)
			.where(eq(overlaysTable.status, StatusOptions.Active))
			.groupBy(overlaysTable.ownerId)
			.orderBy(desc(scoreExpr))
			.limit(limitedBatchSize)
			.execute();

		return rows.map((row) => row.ownerId);
	} catch (error) {
		console.error("Error fetching active owner IDs for clip sync:", error);
		return [];
	}
}

type ClipSyncState = {
	lastIncrementalSyncAt?: string;
	lastBackfillSyncAt?: string;
	backfillCursor?: string;
	backfillComplete?: boolean;
};

type CachedClipValue = {
	clip?: TwitchClip;
	unavailable?: boolean;
};

export type ClipCacheStatus = {
	cachedClipCount: number;
	unavailableClipCount: number;
	oldestClipDate: string | null;
	newestClipDate: string | null;
	lastIncrementalSyncAt: string | null;
	lastBackfillSyncAt: string | null;
	backfillComplete: boolean;
	backfillCursor: string | null;
	estimatedCoveragePercent: number;
};

function extractCachedClip(value: unknown): TwitchClip | null {
	if (!value || typeof value !== "object") return null;
	if ("clip" in (value as CachedClipValue) && (value as CachedClipValue).clip) return (value as CachedClipValue).clip as TwitchClip;
	if ("id" in (value as Record<string, unknown>) && typeof (value as Record<string, unknown>).id === "string") return value as TwitchClip;
	return null;
}

function parseClipDate(value: string) {
	const parsed = new Date(value).getTime();
	return Number.isFinite(parsed) ? parsed : null;
}

export async function getClipCacheStatus(ownerId: string): Promise<ClipCacheStatus | null> {
	const user = await requireUser();
	if (!user || !(await canEditOwner(user.id, ownerId))) {
		console.warn(`Unauthorized "getClipCacheStatus" API request for owner id: ${ownerId}`);
		return null;
	}
	return getClipCacheStatusForOwnerServer(ownerId);
}

export async function getClipCacheStatusForOwnerServer(ownerId: string): Promise<ClipCacheStatus> {
	const clipPrefix = `clip:${ownerId}:`;
	const stateKey = `clip-sync:${ownerId}`;
	const [entries, state] = await Promise.all([
		getTwitchCacheByPrefixEntries<CachedClipValue | TwitchClip>(TwitchCacheType.Clip, clipPrefix),
		getTwitchCache<ClipSyncState>(TwitchCacheType.Clip, stateKey),
	]);

	let cachedClipCount = 0;
	let unavailableClipCount = 0;
	let oldestTs: number | null = null;
	let newestTs: number | null = null;

	for (const entry of entries) {
		const value = entry.value as CachedClipValue | TwitchClip;
		if ((value as CachedClipValue).unavailable) {
			unavailableClipCount += 1;
		}
		const clip = extractCachedClip(value);
		if (!clip) continue;
		cachedClipCount += 1;
		const ts = parseClipDate(clip.created_at);
		if (ts == null) continue;
		oldestTs = oldestTs == null ? ts : Math.min(oldestTs, ts);
		newestTs = newestTs == null ? ts : Math.max(newestTs, ts);
	}

	const backfillComplete = Boolean(state?.backfillComplete);
	const estimatedCoveragePercent = backfillComplete ? 100 : Math.min(99, Math.round((cachedClipCount / (cachedClipCount + 1500)) * 100));

	return {
		cachedClipCount,
		unavailableClipCount,
		oldestClipDate: oldestTs == null ? null : new Date(oldestTs).toISOString(),
		newestClipDate: newestTs == null ? null : new Date(newestTs).toISOString(),
		lastIncrementalSyncAt: state?.lastIncrementalSyncAt ?? null,
		lastBackfillSyncAt: state?.lastBackfillSyncAt ?? null,
		backfillComplete,
		backfillCursor: state?.backfillCursor ?? null,
		estimatedCoveragePercent,
	};
}

export async function setPlayerVolumeForOwner(ownerId: string, volume: number) {
	try {
		const clampedVolume = Math.max(0, Math.min(100, volume));
		await db.update(overlaysTable).set({ playerVolume: clampedVolume, updatedAt: new Date() }).where(eq(overlaysTable.ownerId, ownerId)).execute();
		return clampedVolume;
	} catch (error) {
		console.error("Error updating player volume for owner:", error);
		throw new Error("Failed to update player volume");
	}
}

export async function getEditorOverlays(ownerId: string) {
	try {
		const user = await requireUser();
		if (!user || user.id !== ownerId) {
			console.warn(`Unauthorized "getEditorOverlays" API request for user id: ${ownerId}`);
			return null;
		}

		const owners = await db.select().from(editorsTable).where(eq(editorsTable.editorId, ownerId)).execute();

		const ownerIds = owners.map((owner) => owner.userId);

		if (ownerIds.length === 0) {
			return [];
		}

		const overlays = await db.select().from(overlaysTable).where(inArray(overlaysTable.ownerId, ownerIds)).execute();
		return overlays;
	} catch (error) {
		console.error("Error fetching editor overlays:", error);
		throw new Error("Failed to fetch editor overlays");
	}
}

export async function getOverlayOwnerPlans(overlayIds: string[]): Promise<Record<string, Plan>> {
	try {
		const user = await requireUser();
		if (!user) {
			console.warn(`Unauthenticated "getOverlayOwnerPlans" API request`);
			return {};
		}

		if (!overlayIds || overlayIds.length === 0) {
			return {};
		}

		const uniqueOverlayIds = Array.from(new Set(overlayIds));

		const editorRows = await db.select().from(editorsTable).where(eq(editorsTable.editorId, user.id)).execute();
		const allowedOwnerIds = Array.from(new Set([user.id, ...editorRows.map((row) => row.userId)]));

		const overlays = await db
			.select({ id: overlaysTable.id, ownerId: overlaysTable.ownerId })
			.from(overlaysTable)
			.where(and(inArray(overlaysTable.id, uniqueOverlayIds), inArray(overlaysTable.ownerId, allowedOwnerIds)))
			.execute();

		if (overlays.length === 0) {
			return {};
		}

		const ownerIds = Array.from(new Set(overlays.map((overlay) => overlay.ownerId)));
		const owners = await db.select({ id: usersTable.id, plan: usersTable.plan, createdAt: usersTable.createdAt }).from(usersTable).where(inArray(usersTable.id, ownerIds)).execute();
		const effectivePlanByOwnerId = new Map<string, Plan>();
		const entitlementsByOwnerId = await resolveUserEntitlementsForUsers(owners);
		for (const owner of owners) {
			const entitlements = entitlementsByOwnerId.get(owner.id);
			effectivePlanByOwnerId.set(owner.id, entitlements?.effectivePlan === "pro" ? Plan.Pro : Plan.Free);
		}
		const result: Record<string, Plan> = {};

		for (const overlay of overlays) {
			result[overlay.id] = effectivePlanByOwnerId.get(overlay.ownerId) ?? Plan.Free;
		}

		return result;
	} catch (error) {
		console.error("Error fetching overlay owner plans:", error);
		throw new Error("Failed to fetch overlay owner plans");
	}
}

export async function getOverlayPublic(overlayId: string) {
	try {
		const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.id, overlayId)).limit(1).execute();
		const overlay = overlays[0];

		if (!overlay) return null;

		return { ...overlay, rewardId: null, secret: "" };
	} catch (error) {
		console.error("Error fetching overlay:", error);
		throw new Error("Failed to fetch overlay");
	}
}

export async function getOverlayBySecret(overlayId: string, secret?: string) {
	try {
		const overlay = await requireOverlaySecretAccess(overlayId, secret);
		return overlay;
	} catch (error) {
		console.error("Error fetching overlay:", error);
		throw new Error("Failed to fetch overlay");
	}
}

export async function getOverlay(overlayId: string) {
	try {
		const ctx = await requireOverlayAccess(overlayId);
		if (!ctx) return null;

		if (!ctx.overlay.secret) {
			const newSecret = crypto.randomUUID();
			const updated = await db
				.update(overlaysTable)
				.set({ secret: newSecret, updatedAt: new Date() })
				.where(and(eq(overlaysTable.id, overlayId), or(isNull(overlaysTable.secret), eq(overlaysTable.secret, ""))))
				.returning()
				.execute();
			if (updated[0]) {
				return updated[0];
			}
			const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.id, overlayId)).limit(1).execute();
			return overlays[0] ?? ctx.overlay;
		}

		return ctx.overlay;
	} catch (error) {
		console.error("Error fetching overlay:", error);
		throw new Error("Failed to fetch overlay");
	}
}

export async function createOverlay(userId: string) {
	try {
		const user = await requireUser();
		if (!user) {
			console.warn(`Unauthenticated "createOverlay" API request`);
			return null;
		}
		if (!(await canEditOwner(user.id, userId))) {
			console.warn(`Unauthorized "createOverlay" API request for user id: ${user.id} on owner id: ${userId}`);
			return null;
		}
		const ownerRows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1).execute();
		const owner = ownerRows[0];
		if (!owner) {
			return null;
		}
		const ownerWithEntitlements = { ...owner, entitlements: await resolveUserEntitlements(owner) };
		const multiOverlayAccess = getFeatureAccess(ownerWithEntitlements, "multi_overlay");
		if (!multiOverlayAccess.allowed) {
			const existing = await db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, userId)).execute();
			if (existing.length >= 1) {
				console.warn(`Free plan overlay limit reached for owner id: ${userId}`);
				return null;
			}
		}
		const secret = crypto.randomUUID();
		const overlay = await db
			.insert(overlaysTable)
			.values({
				id: crypto.randomUUID(),
				ownerId: userId,
				secret,
				name: "New Overlay",
				status: StatusOptions.Active,
				type: OverlayType.Featured,
			})
			.returning()
			.then((result) => result[0]);

		return overlay;
	} catch (error) {
		console.error("Error creating overlay:", error);
		throw new Error("Failed to create overlay");
	}
}

export async function downgradeUserPlan(userId: string) {
	const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, userId)).execute();

	if (overlays.length === 0) {
		return;
	}

	const overlaysToDeactivate = overlays.slice(1).map((overlay) => overlay.id);

	if (overlaysToDeactivate.length > 0) {
		await db.delete(overlaysTable).where(inArray(overlaysTable.id, overlaysToDeactivate)).execute();
	}

	await db
		.update(overlaysTable)
		.set({
			rewardId: null,
			blacklistWords: [],
			minClipViews: 0,
			minClipDuration: 0,
			maxClipDuration: 60,
			maxDurationMode: MaxDurationMode.Filter,
			playbackMode: PlaybackMode.Random,
			preferCurrentCategory: false,
			clipCreatorsOnly: [],
			clipCreatorsBlocked: [],
			clipPackSize: 100,
			playerVolume: 50,
			showChannelInfo: true,
			showClipInfo: true,
			showTimer: false,
			showProgressBar: false,
			overlayInfoFadeOutSeconds: 6,
			themeFontFamily: "inherit",
			themeTextColor: "#FFFFFF",
			themeAccentColor: "#7C3AED",
			themeBackgroundColor: "rgba(10,10,10,0.65)",
			progressBarStartColor: "#26018E",
			progressBarEndColor: "#8D42F9",
			borderSize: 0,
			borderRadius: 10,
			effectScanlines: false,
			effectStatic: false,
			effectCrt: false,
			channelInfoX: 0,
			channelInfoY: 0,
			clipInfoX: 100,
			clipInfoY: 100,
			timerX: 100,
			timerY: 0,
			channelScale: 100,
			clipScale: 100,
			timerScale: 100,
		})
		.where(eq(overlaysTable.id, overlays[0].id))
		.execute();

	await db.delete(editorsTable).where(eq(editorsTable.userId, userId)).execute();

	await db.update(usersTable).set({ updatedAt: new Date() }).where(eq(usersTable.id, userId)).execute();
}

export async function saveOverlay(overlayId: string, patch: OverlayPatch) {
	try {
		const ctx = await requireOverlayAccess(overlayId);
		if (!ctx) return null;

		const sanitizedPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as OverlayPatch;
		const next = { ...ctx.overlay, ...sanitizedPatch };

		// Use the owner's access context to determine whether advanced settings are allowed
		const ownerRows = await db.select().from(usersTable).where(eq(usersTable.id, ctx.overlay.ownerId)).limit(1).execute();
		const owner = ownerRows[0];
		const ownerWithEntitlements = owner ? { ...owner, entitlements: await resolveUserEntitlements(owner) } : null;
		const advancedAccess = ownerWithEntitlements ? getFeatureAccess(ownerWithEntitlements, "advanced_filters") : { allowed: false as const };
		const updatePayload = buildOverlayUpdatePayload(next, advancedAccess.allowed);

		await db
			.update(overlaysTable)
			.set(updatePayload)
			.where(eq(overlaysTable.id, overlayId))
			.execute();

		if (updatePayload.rewardId && updatePayload.rewardId !== ctx.overlay.rewardId) {
			subscribeToReward(ctx.overlay.ownerId, updatePayload.rewardId);
		}

		return getOverlay(overlayId);
	} catch (error) {
		console.error("Error saving overlay:", error);
		throw new Error("Failed to save overlay");
	}
}

export async function deleteOverlay(overlayId: string) {
	try {
		const ctx = await requireOverlayAccess(overlayId);
		if (!ctx) return false;

		await db.delete(overlaysTable).where(eq(overlaysTable.id, overlayId)).execute();
		return true;
	} catch (error) {
		console.error("Error deleting overlay:", error);
		throw new Error("Failed to delete overlay");
	}
}

export async function getOverlayOwnerPlan(overlayId: string): Promise<Plan | null> {
	const ctx = await requireOverlayAccess(overlayId);
	if (!ctx) return null;
	const owner = await getUserByIdServer(ctx.overlay.ownerId);
	if (!owner) return null;
	return owner.entitlements?.effectivePlan === "pro" ? Plan.Pro : Plan.Free;
}

// Public plan lookup scoped to an overlay id (embed use).
export async function getOverlayOwnerPlanPublic(overlayId: string): Promise<Plan | null> {
	try {
		const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.id, overlayId)).limit(1).execute();
		const overlay = overlays[0];
		if (!overlay) return null;

		const ownerRows = await db.select().from(usersTable).where(eq(usersTable.id, overlay.ownerId)).limit(1).execute();
		const owner = ownerRows[0];
		if (!owner) return Plan.Free;
		const entitlements = await resolveUserEntitlements(owner);
		return entitlements.effectivePlan === "pro" ? Plan.Pro : Plan.Free;
	} catch (error) {
		console.error("Error fetching overlay owner plan:", error);
		throw new Error("Failed to fetch overlay owner plan");
	}
}

export async function getOverlayByRewardId(rewardId: string) {
	try {
		const overlay = await db.select().from(overlaysTable).where(eq(overlaysTable.rewardId, rewardId)).limit(1).execute();
		return overlay[0];
	} catch (error) {
		console.error("Error validating reward ID:", error);
		throw new Error("Failed to validate reward ID");
	}
}

export async function addToClipQueue(overlayId: string, clipId: string) {
	try {
		await db.insert(queueTable).values({ overlayId, clipId }).execute();
	} catch (error) {
		console.error("Error adding clip to queue:", error);
		throw new Error("Failed to add clip to queue");
	}
}

export async function getClipQueueByOverlayId(overlayId: string) {
	try {
		const result = await db.select().from(queueTable).where(eq(queueTable.overlayId, overlayId)).execute();
		return result;
	} catch (error) {
		console.error("Error fetching clip queue:", error);
		throw new Error("Failed to fetch clip queue");
	}
}

export async function getClipQueue(overlayId: string, secret?: string) {
	try {
		const overlay = await requireOverlaySecretAccess(overlayId, secret);
		if (!overlay) return [];
		return getClipQueueByOverlayId(overlayId);
	} catch (error) {
		console.error("Error fetching clip queue:", error);
		throw new Error("Failed to fetch clip queue");
	}
}

export async function getFirstFromClipQueueByOverlayId(overlayId: string) {
	try {
		const result = await db.select().from(queueTable).where(eq(queueTable.overlayId, overlayId)).limit(1).execute();

		return result[0] || null;
	} catch (error) {
		console.error("Error fetching first clip from queue:", error);
		throw new Error("Failed to fetch first clip from queue");
	}
}

export async function getFirstFromClipQueue(overlayId: string, secret?: string) {
	try {
		const overlay = await requireOverlaySecretAccess(overlayId, secret);
		if (!overlay) return null;
		return getFirstFromClipQueueByOverlayId(overlayId);
	} catch (error) {
		console.error("Error fetching first clip from queue:", error);
		throw new Error("Failed to fetch first clip from queue");
	}
}

export async function removeFromClipQueueById(id: string) {
	try {
		await db.delete(queueTable).where(eq(queueTable.id, id)).execute();
	} catch (error) {
		console.error("Error removing clip from queue:", error);
		throw new Error("Failed to remove clip from queue");
	}
}

export async function removeFromClipQueue(id: string, overlayId: string, secret?: string) {
	try {
		const overlay = await requireOverlaySecretAccess(overlayId, secret);
		if (!overlay) return;
		await db
			.delete(queueTable)
			.where(and(eq(queueTable.id, id), eq(queueTable.overlayId, overlayId)))
			.execute();
	} catch (error) {
		console.error("Error removing clip from queue:", error);
		throw new Error("Failed to remove clip from queue");
	}
}

async function clearClipQueueByOverlayId(overlayId: string) {
	try {
		await db.delete(queueTable).where(eq(queueTable.overlayId, overlayId)).execute();
	} catch (error) {
		console.error("Error clearing clip queue:", error);
		throw new Error("Failed to clear clip queue");
	}
}

// Server-only helper (do not call from client components).
export async function clearClipQueueByOverlayIdServer(overlayId: string) {
	return clearClipQueueByOverlayId(overlayId);
}

export async function clearClipQueue(overlayId: string, secret?: string) {
	try {
		const overlay = await requireOverlaySecretAccess(overlayId, secret);
		if (!overlay) return;
		await clearClipQueueByOverlayId(overlayId);
	} catch (error) {
		console.error("Error clearing clip queue:", error);
		throw new Error("Failed to clear clip queue");
	}
}

export async function addToModQueue(broadcasterId: string, clipId: string) {
	try {
		await db.insert(modQueueTable).values({ broadcasterId, clipId }).execute();
	} catch (error) {
		console.error("Error adding clip to mod queue:", error);
		throw new Error("Failed to add clip to mod queue");
	}
}

export async function getModQueueByBroadcasterId(broadcasterId: string) {
	try {
		const result = await db.select().from(modQueueTable).where(eq(modQueueTable.broadcasterId, broadcasterId)).execute();
		return result;
	} catch (error) {
		console.error("Error fetching mod queue:", error);
		throw new Error("Failed to fetch mod queue");
	}
}

export async function getModQueue(broadcasterId: string) {
	return getModQueueByBroadcasterId(broadcasterId);
}

export async function getFirstFromModQueueByBroadcasterId(broadcasterId: string) {
	try {
		const result = await db.select().from(modQueueTable).where(eq(modQueueTable.broadcasterId, broadcasterId)).limit(1).execute();
		return result[0] || null;
	} catch (error) {
		console.error("Error fetching first clip from mod queue:", error);
		throw new Error("Failed to fetch first clip from mod queue");
	}
}

export async function getFirstFromModQueue(overlayId: string, secret?: string) {
	try {
		const overlay = await requireOverlaySecretAccess(overlayId, secret);
		if (!overlay) return null;
		return getFirstFromModQueueByBroadcasterId(overlay.ownerId);
	} catch (error) {
		console.error("Error fetching first clip from mod queue:", error);
		throw new Error("Failed to fetch first clip from mod queue");
	}
}

export async function removeFromModQueueById(id: string) {
	try {
		await db.delete(modQueueTable).where(eq(modQueueTable.id, id)).execute();
	} catch (error) {
		console.error("Error removing clip from mod queue:", error);
		throw new Error("Failed to remove clip from mod queue");
	}
}

export async function removeFromModQueue(id: string, overlayId: string, secret?: string) {
	try {
		const overlay = await requireOverlaySecretAccess(overlayId, secret);
		if (!overlay) return;
		await db
			.delete(modQueueTable)
			.where(and(eq(modQueueTable.id, id), eq(modQueueTable.broadcasterId, overlay.ownerId)))
			.execute();
	} catch (error) {
		console.error("Error removing clip from mod queue:", error);
		throw new Error("Failed to remove clip from mod queue");
	}
}

export async function clearModQueueByBroadcasterId(broadcasterId: string) {
	try {
		await db.delete(modQueueTable).where(eq(modQueueTable.broadcasterId, broadcasterId)).execute();
	} catch (error) {
		console.error("Error clearing mod queue:", error);
		throw new Error("Failed to clear mod queue");
	}
}

export async function clearModQueue(overlayId: string, secret?: string) {
	try {
		const overlay = await requireOverlaySecretAccess(overlayId, secret);
		if (!overlay) return;
		await clearModQueueByBroadcasterId(overlay.ownerId);
	} catch (error) {
		console.error("Error clearing mod queue:", error);
		throw new Error("Failed to clear mod queue");
	}
}

export async function getSettings(userId: string): Promise<UserSettings> {
	try {
		const settingsWithoutEditors = await db.select().from(settingsTable).where(eq(settingsTable.id, userId)).limit(1).execute();

		if (settingsWithoutEditors.length === 0) {
			// Save default settings
			return saveSettings({
				id: userId,
				prefix: "!",
				editors: [],
			}).then(() => getSettings(userId));
		}

		const settingsEditors = await db.select().from(editorsTable).where(eq(editorsTable.userId, userId)).execute();

		const editorNames = await getUsersDetailsBulk({
			userIds: settingsEditors.map((editor) => editor.editorId),
			accessToken: (await getAccessToken(userId))?.accessToken || "",
		});

		const settings: UserSettings[] = settingsWithoutEditors.map((setting) => ({
			...setting,
			editors: editorNames.map((editor) => editor.login),
		}));

		return settings[0];
	} catch (error) {
		console.error("Error fetching settings:", error);
		throw new Error("Failed to fetch settings");
	}
}

export async function saveSettings(settings: UserSettings) {
	const userId = settings.id;
	const authedUser = await requireUser();
	if (!authedUser || authedUser.id !== userId) {
		console.warn(`Unauthorized "saveSettings" API request for user id: ${userId}`);
		throw new Error("Unauthorized");
	}
	const prefix = settings.prefix;
	const editors = settings.editors ?? [];
	const editorsAccess = getFeatureAccess(authedUser, "editors");
	const effectiveEditors = editorsAccess.allowed ? editors : [];

	const accessToken = await getAccessToken(userId);
	if (!accessToken) throw new Error("Could not retrieve access token.");

	// Fetch the user's username (login) to filter out self from editors
	const userDetails = await getUserDetails(accessToken.accessToken);
	const userLogin = userDetails?.login;
	// Clean + dedupe editor names (and never include self)
	const editorNames = Array.from(new Set(effectiveEditors.filter((name) => name && name !== userLogin)));

	// Do network calls BEFORE the transaction (keeps tx short)
	let rows: Array<{ userId: string; editorId: string }> = [];

	if (editorNames.length > 0) {
		const users = await getUsersDetailsBulk({
			userNames: editorNames,
			accessToken: accessToken.accessToken,
		});

		rows = (users ?? []).filter((u): u is TwitchUserResponse => !!u?.id).map((u) => ({ userId: settings.id, editorId: u.id }));
	}

	try {
		await db.transaction(async (tx) => {
			// Upsert settings
			await tx.insert(settingsTable).values({ id: userId, prefix }).onConflictDoUpdate({
				target: settingsTable.id,
				set: { prefix },
			});

			// Replace editors
			await tx.delete(editorsTable).where(eq(editorsTable.userId, userId));

			if (rows.length > 0) {
				await tx.insert(editorsTable).values(rows);
			}
		});
	} catch (error) {
		console.error("Error saving settings:", error);
		throw new Error("Failed to save settings");
	}
}

export async function getTwitchCache<T>(type: TwitchCacheType, key: string): Promise<T | null> {
	try {
		const now = new Date();
		const rows = await db
			.select()
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, type), eq(twitchCacheTable.key, key), or(isNull(twitchCacheTable.expiresAt), gt(twitchCacheTable.expiresAt, now))))
			.limit(1)
			.execute();

		if (rows.length === 0) {
			recordCacheRead(false);
			return null;
		}
		recordCacheRead(true);

		return JSON.parse(rows[0].value) as T;
	} catch (error) {
		console.error("Error reading twitch cache:", error);
		return null;
	}
}

export async function getTwitchCacheEntry<T>(type: TwitchCacheType, key: string): Promise<{ hit: boolean; value: T | null }> {
	try {
		const now = new Date();
		const rows = await db
			.select()
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, type), eq(twitchCacheTable.key, key), or(isNull(twitchCacheTable.expiresAt), gt(twitchCacheTable.expiresAt, now))))
			.limit(1)
			.execute();

		if (rows.length === 0) {
			recordCacheRead(false);
			return { hit: false, value: null };
		}
		recordCacheRead(true);

		return { hit: true, value: JSON.parse(rows[0].value) as T };
	} catch (error) {
		console.error("Error reading twitch cache entry:", error);
		return { hit: false, value: null };
	}
}

// Stale read: ignore expiresAt and return last known value if present.
export async function getTwitchCacheStale<T>(type: TwitchCacheType, key: string): Promise<T | null> {
	try {
		const rows = await db
			.select()
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, type), eq(twitchCacheTable.key, key)))
			.limit(1)
			.execute();

		if (rows.length === 0) {
			recordCacheRead(false, true);
			return null;
		}
		recordCacheRead(true, true);

		return JSON.parse(rows[0].value) as T;
	} catch (error) {
		console.error("Error reading stale twitch cache:", error);
		return null;
	}
}

export async function setTwitchCache(type: TwitchCacheType, key: string, value: unknown, ttlSeconds?: number) {
	try {
		const now = new Date();
		const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
		const payload = JSON.stringify(value);

		cleanupTwitchCacheIfNeeded(now).catch((error) => console.error("Error cleaning up twitch cache:", error));

		await db
			.insert(twitchCacheTable)
			.values({
				type,
				key,
				value: payload,
				fetchedAt: now,
				expiresAt,
			})
			.onConflictDoUpdate({
				target: [twitchCacheTable.type, twitchCacheTable.key],
				set: {
					value: payload,
					fetchedAt: now,
					expiresAt,
				},
			})
			.execute();
	} catch (error) {
		console.error("Error writing twitch cache:", error);
	}
}

export async function getTwitchCacheBatch<T>(type: TwitchCacheType, keys: string[]): Promise<T[]> {
	try {
		if (keys.length === 0) return [];
		const now = new Date();
		const rows = await db
			.select()
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, type), inArray(twitchCacheTable.key, keys), or(isNull(twitchCacheTable.expiresAt), gt(twitchCacheTable.expiresAt, now))))
			.execute();

		recordCacheBatchReads(rows.length, keys.length);
		return rows.map((row) => JSON.parse(row.value) as T);
	} catch (error) {
		console.error("Error reading twitch cache batch:", error);
		return [];
	}
}

export async function getTwitchCacheByPrefixEntries<T>(type: TwitchCacheType, keyPrefix: string, limit?: number): Promise<Array<{ key: string; value: T }>> {
	try {
		if (!keyPrefix) return [];
		const now = new Date();
		const escapedPrefix = escapeLikePattern(keyPrefix);
		const baseQuery = db
			.select({ key: twitchCacheTable.key, value: twitchCacheTable.value })
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, type), sql`${twitchCacheTable.key} LIKE ${`${escapedPrefix}%`} ESCAPE '\\'`, or(isNull(twitchCacheTable.expiresAt), gt(twitchCacheTable.expiresAt, now))))
			.orderBy(desc(twitchCacheTable.fetchedAt));
		const rows = typeof limit === "number" ? await baseQuery.limit(limit).execute() : await baseQuery.execute();

		return rows.map((row) => ({
			key: row.key,
			value: JSON.parse(row.value) as T,
		}));
	} catch (error) {
		console.error("Error reading twitch cache by prefix:", error);
		return [];
	}
}

// Stale batch read: ignore expiresAt and return last known values if present.
export async function getTwitchCacheStaleBatch<T>(type: TwitchCacheType, keys: string[]): Promise<T[]> {
	try {
		if (keys.length === 0) return [];
		const rows = await db
			.select()
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, type), inArray(twitchCacheTable.key, keys)))
			.execute();

		recordCacheBatchReads(rows.length, keys.length, true);
		return rows.map((row) => JSON.parse(row.value) as T);
	} catch (error) {
		console.error("Error reading stale twitch cache batch:", error);
		return [];
	}
}

export async function setTwitchCacheBatch(type: TwitchCacheType, entries: { key: string; value: unknown }[], ttlSeconds?: number) {
	try {
		if (entries.length === 0) return;
		const now = new Date();
		const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
		const rows = entries.map((entry) => ({
			type,
			key: entry.key,
			value: JSON.stringify(entry.value),
			fetchedAt: now,
			expiresAt,
		}));

		cleanupTwitchCacheIfNeeded(now).catch((error) => console.error("Error cleaning up twitch cache:", error));

		await db
			.insert(twitchCacheTable)
			.values(rows)
			.onConflictDoUpdate({
				target: [twitchCacheTable.type, twitchCacheTable.key],
				set: {
					value: sql`excluded.value`,
					fetchedAt: now,
					expiresAt,
				},
			})
			.execute();
	} catch (error) {
		console.error("Error writing twitch cache batch:", error);
	}
}

export async function deleteTwitchCacheKeys(type: TwitchCacheType, keys: string[]) {
	try {
		if (keys.length === 0) return 0;
		const result = await db.delete(twitchCacheTable).where(and(eq(twitchCacheTable.type, type), inArray(twitchCacheTable.key, keys))).execute();
		return Number(result.rowCount ?? 0);
	} catch (error) {
		console.error("Error deleting twitch cache keys:", error);
		return 0;
	}
}

export async function deleteTwitchCacheByPrefix(type: TwitchCacheType, keyPrefix: string) {
	try {
		if (!keyPrefix) return 0;
		const escapedPrefix = escapeLikePattern(keyPrefix);
		const result = await db
			.delete(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, type), sql`${twitchCacheTable.key} LIKE ${`${escapedPrefix}%`} ESCAPE '\\'`))
			.execute();
		return Number(result.rowCount ?? 0);
	} catch (error) {
		console.error("Error deleting twitch cache by prefix:", error);
		return 0;
	}
}
