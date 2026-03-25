"use server";

import { tokenTable, usersTable, overlaysTable, playlistsTable, playlistClipsTable, queueTable, settingsTable, modQueueTable, editorsTable, twitchCacheTable } from "@/db/schema";
import { db, QueryClient } from "@/db/client";
import { AuthenticatedUser, Overlay, Playlist, TwitchUserResponse, TwitchTokenApiResponse, UserToken, Plan, Role, UserSettings, TwitchCacheType, StatusOptions, OverlayType, PlaybackMode, MaxDurationMode, TwitchClip } from "@types";
import { getUserDetails, getUsersDetailsBulk, refreshAccessTokenWithContext, subscribeToReward, syncOwnerClipCache } from "@actions/twitch";
import { syncProductUpdatesContact, getProductUpdatesSubscriptionStatus } from "@actions/newsletter";
import { isTitleBlocked } from "@/app/utils/regexFilter";
import { eq, inArray, and, or, isNull, lt, gt, sql, desc, max } from "drizzle-orm";
import { validateAuth, validateAdminAuth } from "@actions/auth";
import { encryptToken, decryptToken } from "@lib/tokenCrypto";
import { getFeatureAccess } from "@lib/featureAccess";
import { ensureReverseTrialGrantForUser, resolveUserEntitlements, resolveUserEntitlementsForUsers } from "@lib/entitlements";
import { TWITCH_CLIPS_LAUNCH_MS, FREE_PLAYLIST_LIMIT, FREE_PLAYLIST_CLIP_LIMIT } from "@lib/constants";

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

function parseTwitchCreatedAtOrDefault(createdAt: string | undefined) {
	const parsed = Date.parse(createdAt ?? "");
	if (!Number.isFinite(parsed)) return new Date(TWITCH_CLIPS_LAUNCH_MS);
	return new Date(parsed);
}

function deriveProductUpdatesConsentSource(settings: Pick<UserSettings, "marketingOptIn" | "marketingOptInSource">) {
	if (settings.marketingOptInSource === "soft_opt_in_default") return "soft_opt_in" as const;
	if (settings.marketingOptIn && settings.marketingOptInSource !== "settings_page_optout") return "explicit_opt_in" as const;
	return "explicit_opt_out" as const;
}

function isProductUpdatesSubscribed(settings: Pick<UserSettings, "marketingOptIn">) {
	return Boolean(settings.marketingOptIn);
}

type CacheReadMetrics = {
	hits: number;
	misses: number;
	staleHits: number;
	lastReadAt: string | null;
	startedAt: string;
};

declare global {
	var __twitchCacheReadMetrics: CacheReadMetrics | undefined;
}

function summarizeError(error: unknown): string {
	if (error instanceof Error) {
		const maybeCode = (error as Error & { code?: string }).code;
		/* istanbul ignore next: error object detail extraction */
		return maybeCode ? `${error.name}(${maybeCode}): ${error.message}` : `${error.name}: ${error.message}`;
	}
	if (typeof error === "object" && error !== null) {
		if ("message" in error) return String((error as { message: unknown }).message);
		if ("name" in error) return String((error as { name: unknown }).name);
		if ("stack" in error) return String((error as { stack: unknown }).stack).split("\n")[0] || "Unknown error (stack available)";
	}
	return String(error);
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
	/* istanbul ignore next: hit rate calculation */
	const hitRate = total > 0 ? metrics.hits / total : 0;
	return {
		...metrics,
		totalReads: total,
		hitRate,
	};
}

const cleanupTwitchCacheIfNeeded = async (now: Date) => {
	/* istanbul ignore next: cache cleanup interval guard */
	if (now.getTime() - lastTwitchCacheCleanupAt < TWITCH_CACHE_CLEANUP_INTERVAL_MS) return;
	lastTwitchCacheCleanupAt = now.getTime();
	await db.delete(twitchCacheTable).where(lt(twitchCacheTable.expiresAt, now)).execute();
};

const OVERLAY_TOUCH_INTERVAL = sql`now() - interval '1 minute'`;

export async function disableUserAccess(userId: string, reason: string, disableType: "manual" | "automatic" = "automatic") {
	const now = new Date();
	try {
		await db
			.update(usersTable)
			.set({
				disabled: true,
				disableType,
				disabledAt: now,
				disabledReason: reason,
				updatedAt: now,
			})
			.where(eq(usersTable.id, userId))
			.execute();

		await db
			.update(overlaysTable)
			.set({
				status: StatusOptions.Paused,
				updatedAt: now,
			})
			.where(eq(overlaysTable.ownerId, userId))
			.execute();
	} catch (error) {
		console.error("Error disabling user access:", { userId, reason, error });
	}
}

export async function enableUserAccess(userId: string) {
	const authedAdmin = await validateAdminAuth(true);
	if (!authedAdmin) {
		console.warn(`Unauthorized enableUserAccess attempt for user id: ${userId}`);
		return;
	}

	const now = new Date();
	try {
		await db
			.update(usersTable)
			.set({
				disabled: false,
				disableType: null,
				disabledAt: null,
				disabledReason: null,
				updatedAt: now,
			})
			.where(eq(usersTable.id, userId))
			.execute();
	} catch (error) {
		console.error("Error enabling user access:", { userId, error });
	}
}

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
		| "playlistId"
		| "rewardId"
		| "minClipDuration"
		| "maxClipDuration"
		| "maxDurationMode"
		| "blacklistWords"
		| "categoriesOnly"
		| "categoriesBlocked"
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
	if (value === null || value === undefined) return "inherit";
	const trimmed = value.trim();
	if (!trimmed) return "inherit";
	/* istanbul ignore next: font family length limit */
	if (trimmed.length > 200) return "inherit";
	/* istanbul ignore next: font url delimiter protection */
	if (trimmed.includes(FONT_URL_DELIMITER)) return "inherit";
	/* istanbul ignore next: font family character allowlist */
	if (!/^[-,./\s"'0-9A-Za-z]+$/.test(trimmed)) return "inherit";
	return trimmed;
}

function sanitizeThemeFontUrl(value: string | null | undefined) {
	if (value === null || value === undefined) return "";
	const trimmed = value.trim();
	if (!trimmed) return "";

	try {
		const parsed = new URL(trimmed);
		/* istanbul ignore next: secure protocol check */
		if (parsed.protocol !== "https:") return "";
		/* istanbul ignore next: allowed font host allowlist */
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
	// Only assign playlistId when the overlay type is set to Playlist to ensure data consistency
	/* istanbul ignore next: playlist id assignment logic */
	const playlistId = next.type === OverlayType.Playlist ? (next.playlistId ?? null) : null;

	return {
		name: next.name,
		status: next.status,
		type: next.type,
		playlistId,
		rewardId,
		updatedAt: new Date(),
		minClipDuration: advancedAllowed ? next.minClipDuration : 0,
		maxClipDuration: advancedAllowed ? next.maxClipDuration : 60,
		maxDurationMode: advancedAllowed ? next.maxDurationMode : MaxDurationMode.Filter,
		blacklistWords: advancedAllowed ? next.blacklistWords : [],
		categoriesOnly: advancedAllowed ? (next.categoriesOnly ?? []) : [],
		categoriesBlocked: advancedAllowed ? (next.categoriesBlocked ?? []) : [],
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
	/* istanbul ignore next: unauthenticated guard */
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
	const ownerRows = await db.select({ disabled: usersTable.disabled }).from(usersTable).where(eq(usersTable.id, overlay.ownerId)).limit(1).execute();
	if (ownerRows[0]?.disabled) {
		return null;
	}

	return overlay;
}

export async function insertUser(user: TwitchUserResponse): Promise<AuthenticatedUser> {
	try {
		const twitchCreatedAt = parseTwitchCreatedAtOrDefault(user.created_at);
		const existing = await db.select({ id: usersTable.id, disabled: usersTable.disabled, disableType: usersTable.disableType }).from(usersTable).where(eq(usersTable.id, user.id)).limit(1).execute();
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
				twitchCreatedAt,
			})
			.onConflictDoUpdate({
				target: usersTable.id,
				set: {
					username: user.login,
					email: user.email,
					avatar: user.profile_image_url,
					twitchCreatedAt,
					updatedAt: new Date(),
				},
			})
			.returning()
			.execute()
			.then((result) => result[0]);

		// Re-enable users after successful OAuth when disable was automatic or legacy-null.
		// Preserve explicit manual disables.
		if (!isNewUser && existing[0]?.disabled && existing[0]?.disableType !== "manual") {
			await db
				.update(usersTable)
				.set({
					disabled: false,
					disableType: null,
					disabledAt: null,
					disabledReason: null,
					updatedAt: new Date(),
				})
				.where(eq(usersTable.id, user.id))
				.execute();
		}

		if (isNewUser) {
			await ensureReverseTrialGrantForUser({ id: dbUser.id, plan: dbUser.plan });
			await db
				.insert(settingsTable)
				.values({
					id: dbUser.id,
					prefix: "!",
					marketingOptIn: true,
					marketingOptInAt: new Date(),
					marketingOptInSource: "soft_opt_in_default",
					useSendProductUpdatesContactId: null,
				})
				.onConflictDoNothing()
				.execute();

			const contactId = await syncProductUpdatesContact({
				email: dbUser.email,
				subscribed: true,
				userId: dbUser.id,
				username: dbUser.username,
				source: "soft_opt_in",
			});
			if (contactId) {
				await db.update(settingsTable).set({ useSendProductUpdatesContactId: contactId }).where(eq(settingsTable.id, dbUser.id)).execute();
			}
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

		/* istanbul ignore next: fallback value */
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

		/* istanbul ignore next: fallback value */
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

export async function isUserDisabledByIdServer(id: string): Promise<boolean> {
	try {
		const rows = await db.select({ disabled: usersTable.disabled }).from(usersTable).where(eq(usersTable.id, id)).limit(1).execute();
		return Boolean(rows[0]?.disabled);
	} catch (error) {
		console.error("Error checking user disabled state:", error);
		return false;
	}
}

export async function setAccessToken(token: TwitchTokenApiResponse): Promise<AuthenticatedUser | null> {
	try {
		const user = await getUserDetails(token.access_token);
		if (!user) {
			throw new Error("Failed to get user details");
		}

		const dbUser = await insertUser(user);

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
			})
			.execute();

		return dbUser;
	} catch (error) {
		console.error("Error setting access token:", error);
		throw new Error("Failed to set access token");
	}
}

export async function getAccessToken(userId: string): Promise<UserToken | null> {
	const result = await getAccessTokenResult(userId);
	return result.token;
}

/**
 * Server-only version that bypasses user session validation.
 * Use only for internal server actions (e.g., EventSub, schedulers).
 */
export async function getAccessTokenServer(userId: string): Promise<UserToken | null> {
	const result = await getAccessTokenResultServer(userId);
	return result.token;
}

export async function getAccessTokenResult(userId: string): Promise<{ token: UserToken | null; reason?: "unauthorized" | "user_disabled" | "token_row_missing" | "token_decrypt_failed" | "refresh_invalid_token" | "refresh_failed" }> {
	const authedUser = await validateAuth(true);
	if (!authedUser || (authedUser.id !== userId && authedUser.role !== Role.Admin)) {
		return { token: null, reason: "unauthorized" };
	}

	return getAccessTokenResultServer(userId);
}

/**
 * Server-only version that bypasses user session validation.
 */
export async function getAccessTokenResultServer(userId: string): Promise<{ token: UserToken | null; reason?: "user_disabled" | "token_row_missing" | "token_decrypt_failed" | "refresh_invalid_token" | "refresh_failed" }> {
	try {
		const userRows = await db.select({ disabled: usersTable.disabled }).from(usersTable).where(eq(usersTable.id, userId)).limit(1).execute();
		const userRow = userRows[0];
		if (userRow?.disabled) {
			return { token: null, reason: "user_disabled" };
		}

		const rows = await db.select().from(tokenTable).where(eq(tokenTable.id, userId)).limit(1).execute();

		if (rows.length === 0) {
			return { token: null, reason: "token_row_missing" };
		}

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
			return { token: null, reason: "token_decrypt_failed" };
		}

		const currentTime = new Date();
		const expiresAt = row.expiresAt;

		const EXPIRATION_BUFFER_MS = 60000;
		if (currentTime.getTime() + EXPIRATION_BUFFER_MS > expiresAt.getTime()) {
			const refreshResult = await refreshAccessTokenWithContext(refreshToken, userId);
			const newToken = refreshResult.token;

			if (!newToken) {
				if (refreshResult.invalidRefreshToken) {
					await disableUserAccess(userId, "invalid_refresh_token");
				}
				return { token: null, reason: refreshResult.invalidRefreshToken ? "refresh_invalid_token" : "refresh_failed" };
			}

			await setAccessToken(newToken);
			return {
				token: {
					id: userId,
					accessToken: newToken.access_token,
					refreshToken: newToken.refresh_token,
					expiresAt: new Date(Date.now() + newToken.expires_in * 1000),
					scope: newToken.scope,
					tokenType: newToken.token_type,
				},
			};
		}

		return {
			token: {
				id: userId,
				accessToken: accessToken,
				refreshToken: refreshToken,
				expiresAt: expiresAt,
				scope: row.scope,
				tokenType: row.tokenType,
			},
		};
	} catch (error) {
		console.error("Error fetching access token:", summarizeError(error));
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
		const scoreExpr = max(sql`coalesce(${overlaysTable.lastUsedAt}, ${overlaysTable.createdAt})`);
		const rows = await db
			.select({ ownerId: overlaysTable.ownerId, score: scoreExpr })
			.from(overlaysTable)
			.innerJoin(usersTable, eq(usersTable.id, overlaysTable.ownerId))
			.where(and(eq(overlaysTable.status, StatusOptions.Active), eq(usersTable.disabled, false)))
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
	backfillWindowEnd?: string;
	backfillWindowSizeMs?: number;
	backfillComplete?: boolean;
	rateLimitedUntil?: string;
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
	/* istanbul ignore next: invalid cache value guard */
	if (!value || typeof value !== "object") return null;
	if ("clip" in (value as CachedClipValue) && (value as CachedClipValue).clip) return (value as CachedClipValue).clip as TwitchClip;
	if ("id" in (value as Record<string, unknown>) && typeof (value as Record<string, unknown>).id === "string") return value as TwitchClip;
	return null;
}

function parseClipDate(value: string) {
	const parsed = new Date(value).getTime();
	/* istanbul ignore next: type guard */
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
	const [entries, state] = await Promise.all([getTwitchCacheByPrefixEntries<CachedClipValue | TwitchClip>(TwitchCacheType.Clip, clipPrefix), getTwitchCache<ClipSyncState>(TwitchCacheType.Clip, stateKey)]);

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
		/* istanbul ignore next: invalid date guard */
		if (ts == null) continue;
		/* istanbul ignore next: invalid date guard */
		oldestTs = oldestTs == null ? ts : Math.min(oldestTs, ts);
		/* istanbul ignore next: invalid date guard */
		newestTs = newestTs == null ? ts : Math.max(newestTs, ts);
	}

	const backfillComplete = Boolean(state?.backfillComplete);
	let estimatedCoveragePercent = 0;

	if (backfillComplete) {
		estimatedCoveragePercent = 100;
	} else if (state?.backfillWindowEnd) {
		const now = Date.now();
		const totalDuration = now - TWITCH_CLIPS_LAUNCH_MS;
		const endMs = new Date(state.backfillWindowEnd).getTime();

		/* istanbul ignore next: type guard */
		if (Number.isFinite(endMs) && totalDuration > 0) {
			const effectiveEndMs = Math.min(endMs, now);
			const progress = (now - effectiveEndMs) / totalDuration;
			estimatedCoveragePercent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
		}
	}

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

type PlaylistWithMeta = Playlist & {
	clipCount: number;
	accessType: "owner" | "editor";
};

export type PlaylistImportFilters = {
	overlayType?: OverlayType;
	startDate?: string | null;
	endDate?: string | null;
	categoryId?: string | null;
	categoryIds?: string[] | null;
	minViews?: number;
	minDuration?: number;
	maxDuration?: number;
	blacklistWords?: string[];
	clipCreatorsOnly?: string[];
	clipCreatorsBlocked?: string[];
	includeModQueue?: boolean;
};

async function getPlaylistImportSourceClips(ownerId: string, filters: PlaylistImportFilters): Promise<TwitchClip[]> {
	try {
		// Keep import source aligned with overlay preview by syncing owner cache before reading.
		await syncOwnerClipCache(ownerId);
	} catch (error) {
		console.warn(`Clip cache sync before playlist import failed for owner ${ownerId}`, error);
	}

	const clipPrefix = `clip:${ownerId}:`;
	const entries = await getTwitchCacheByPrefixEntries<unknown>(TwitchCacheType.Clip, clipPrefix);
	const clipMap = new Map<string, TwitchClip>();
	for (const entry of entries) {
		const clip = parseStoredClip(entry.value);
		/* istanbul ignore next: clip validation guard */
		if (!clip?.id) continue;
		/* istanbul ignore next: clip validation guard */
		if (!clipMap.has(clip.id)) clipMap.set(clip.id, clip);
	}

	if (filters.includeModQueue) {
		const modQueueEntries = await getModQueueByBroadcasterId(ownerId);
		for (const queued of modQueueEntries) {
			/* istanbul ignore next: fallback value */
			if (clipMap.has(queued.clipId)) continue;
			const cacheEntry = await getTwitchCache<unknown>(TwitchCacheType.Clip, `clip:${ownerId}:${queued.clipId}`);
			const clip = parseStoredClip(cacheEntry);
			/* istanbul ignore next: clip validation guard */
			if (clip?.id) clipMap.set(clip.id, clip);
		}
	}

	return Array.from(clipMap.values());
}

function parseStoredClip(value: unknown): TwitchClip | null {
	/* istanbul ignore next: invalid cache value guard */
	if (!value || typeof value !== "object") return null;
	if ("clip" in (value as { clip?: unknown }) && (value as { clip?: unknown }).clip) {
		const nested = (value as { clip?: unknown }).clip;
		/* istanbul ignore next: fallback value */
		if (nested && typeof nested === "object" && "id" in (nested as Record<string, unknown>)) return nested as TwitchClip;
	}
	if ("id" in (value as Record<string, unknown>)) return value as TwitchClip;
	return null;
}

async function getOwnerPlanContext(ownerId: string, tx: QueryClient = db) {
	const ownerRows = await tx.select().from(usersTable).where(eq(usersTable.id, ownerId)).limit(1).execute();
	const owner = ownerRows[0];
	/* istanbul ignore next: access guard */
	if (!owner) return { owner: null, isPro: false };
	const entitlements = await resolveUserEntitlements(owner);
	return {
		owner,
		isPro: entitlements.effectivePlan === "pro",
	};
}

async function requirePlaylistAccess(playlistId: string): Promise<{ user: AuthenticatedUser; playlist: Playlist } | null> {
	const user = await requireUser();
	/* istanbul ignore next: unauthenticated guard */
	if (!user) return null;

	const playlists = await db.select().from(playlistsTable).where(eq(playlistsTable.id, playlistId)).limit(1).execute();
	const playlist = playlists[0];
	if (!playlist) return null;

	if (!(await canEditOwner(user.id, playlist.ownerId))) {
		console.warn(`Unauthorized playlist access for user id: ${user.id} on playlist id: ${playlistId}`);
		return null;
	}

	return { user, playlist };
}

export async function getAllPlaylists(userId: string): Promise<PlaylistWithMeta[] | null> {
	const user = await requireUser();
	if (!user || user.id !== userId) {
		console.warn(`Unauthorized "getAllPlaylists" API request for user id: ${userId}`);
		return null;
	}

	const editorRows = await db.select().from(editorsTable).where(eq(editorsTable.editorId, userId)).execute();
	const ownerIds = Array.from(new Set([userId, ...editorRows.map((row) => row.userId)]));
	/* istanbul ignore next: empty result guard */
	const playlists = ownerIds.length > 0 ? await db.select().from(playlistsTable).where(inArray(playlistsTable.ownerId, ownerIds)).execute() : [];

	/* istanbul ignore next: empty result guard */
	if (playlists.length === 0) return [];

	const counts = await db
		.select({ playlistId: playlistClipsTable.playlistId, count: sql<number>`count(*)` })
		.from(playlistClipsTable)
		.where(
			inArray(
				playlistClipsTable.playlistId,
				playlists.map((playlist) => playlist.id),
			),
		)
		.groupBy(playlistClipsTable.playlistId)
		.execute();
	/* istanbul ignore next: fallback value */
	const countByPlaylistId = new Map(counts.map((row) => [row.playlistId, Number(row.count ?? 0)]));

	return playlists.map((playlist) => ({
		...playlist,
		clipCount: countByPlaylistId.get(playlist.id) ?? 0,
		accessType: playlist.ownerId === userId ? "owner" : "editor",
	}));
}

export async function getPlaylistsForOwner(ownerId: string): Promise<Array<Playlist & { clipCount: number }> | null> {
	const user = await requireUser();
	if (!user || !(await canEditOwner(user.id, ownerId))) {
		console.warn(`Unauthorized "getPlaylistsForOwner" API request for owner id: ${ownerId}`);
		return null;
	}

	const playlists = await db.select().from(playlistsTable).where(eq(playlistsTable.ownerId, ownerId)).execute();
	/* istanbul ignore next: empty result guard */
	if (playlists.length === 0) return [];

	const counts = await db
		.select({ playlistId: playlistClipsTable.playlistId, count: sql<number>`count(*)` })
		.from(playlistClipsTable)
		.where(
			inArray(
				playlistClipsTable.playlistId,
				playlists.map((playlist) => playlist.id),
			),
		)
		.groupBy(playlistClipsTable.playlistId)
		.execute();
	/* istanbul ignore next: fallback value */
	const countByPlaylistId = new Map(counts.map((row) => [row.playlistId, Number(row.count ?? 0)]));

	/* istanbul ignore next: fallback value */
	return playlists.map((playlist) => ({ ...playlist, clipCount: countByPlaylistId.get(playlist.id) ?? 0 }));
}

export async function createPlaylist(ownerId: string, name: string) {
	const user = await requireUser();
	if (!user) {
		console.warn(`Unauthenticated "createPlaylist" API request`);
		return null;
	}
	if (!(await canEditOwner(user.id, ownerId))) {
		console.warn(`Unauthorized "createPlaylist" API request for user id: ${user.id} on owner id: ${ownerId}`);
		return null;
	}

	const trimmedName = name.trim();
	if (!trimmedName) {
		throw new Error("Playlist name is required");
	}

	return await db.transaction(async (tx) => {
		const { owner, isPro } = await getOwnerPlanContext(ownerId, tx);
		/* istanbul ignore next: access guard */
		if (!owner) return null;
		if (!isPro) {
			const existing = await tx.select().from(playlistsTable).where(eq(playlistsTable.ownerId, ownerId)).execute();
			/* istanbul ignore next: empty result guard */
			if (existing.length >= FREE_PLAYLIST_LIMIT) {
				throw new Error("Free plan allows only one playlist");
			}
		}

		const rows = await tx
			.insert(playlistsTable)
			.values({
				ownerId,
				name: trimmedName.slice(0, 120),
				updatedAt: new Date(),
			})
			.returning()
			.execute();
		/* istanbul ignore next: fallback value */
		return rows[0] ?? null;
	});
}

export async function savePlaylist(playlistId: string, patch: Partial<Pick<Playlist, "name">>) {
	const ctx = await requirePlaylistAccess(playlistId);
	/* istanbul ignore next: access guard */
	if (!ctx) return null;

	/* istanbul ignore next: fallback value */
	const nextName = (patch.name ?? ctx.playlist.name).trim();
	if (!nextName) throw new Error("Playlist name is required");

	await db
		.update(playlistsTable)
		.set({
			name: nextName.slice(0, 120),
			updatedAt: new Date(),
		})
		.where(eq(playlistsTable.id, playlistId))
		.execute();

	const rows = await db.select().from(playlistsTable).where(eq(playlistsTable.id, playlistId)).limit(1).execute();
	/* istanbul ignore next: fallback value */
	return rows[0] ?? null;
}

export async function deletePlaylist(playlistId: string) {
	const ctx = await requirePlaylistAccess(playlistId);
	if (!ctx) return false;
	await db.delete(playlistsTable).where(eq(playlistsTable.id, playlistId)).execute();
	return true;
}

export async function getPlaylistClips(playlistId: string): Promise<TwitchClip[]> {
	const ctx = await requirePlaylistAccess(playlistId);
	if (!ctx) return [];
	return getPlaylistClipsForOwnerServer(ctx.playlist.ownerId, playlistId);
}

export async function getPlaylistClipsForOwnerServer(ownerId: string, playlistId: string, tx?: QueryClient): Promise<TwitchClip[]> {
	const client = tx ?? db;
	const playlistRows = await client
		.select()
		.from(playlistsTable)
		.where(and(eq(playlistsTable.id, playlistId), eq(playlistsTable.ownerId, ownerId)))
		.limit(1)
		.execute();
	/* istanbul ignore next: fallback value */
	if (!playlistRows[0]) return [];

	const rows = await client.select().from(playlistClipsTable).where(eq(playlistClipsTable.playlistId, playlistId)).orderBy(playlistClipsTable.position).execute();
	const clips: TwitchClip[] = [];
	for (const row of rows) {
		try {
			const parsed = JSON.parse(row.clipData) as unknown;
			const clip = parseStoredClip(parsed);
			if (clip?.id) clips.push(clip);
		} catch {
			continue;
		}
	}
	return clips;
}

/* istanbul ignore next: upsert operation guard */
export async function upsertPlaylistClips(playlistId: string, clips: TwitchClip[], mode: "append" | "replace" = "append") {
	const ctx = await requirePlaylistAccess(playlistId);
	if (!ctx) return [];

	const uniqueIncoming = Array.from(new Map(clips.filter((clip) => !!clip?.id).map((clip) => [clip.id, clip])).values());
	if (uniqueIncoming.length === 0 && mode === "append") {
		return getPlaylistClipsForOwnerServer(ctx.playlist.ownerId, playlistId);
	}

	const { isPro } = await getOwnerPlanContext(ctx.playlist.ownerId);
	if (mode === "replace") {
		if (!isPro && uniqueIncoming.length > FREE_PLAYLIST_CLIP_LIMIT) {
			throw new Error(`Free plan playlists are limited to ${FREE_PLAYLIST_CLIP_LIMIT} clips`);
		}
		return await db.transaction(async (tx) => {
			await tx.delete(playlistClipsTable).where(eq(playlistClipsTable.playlistId, playlistId)).execute();
			/* istanbul ignore next: empty result guard */
			if (uniqueIncoming.length > 0) {
				await tx
					.insert(playlistClipsTable)
					.values(
						uniqueIncoming.map((clip, index) => ({
							playlistId,
							clipId: clip.id,
							position: index,
							clipData: JSON.stringify(clip),
						})),
					)
					.execute();
			}
			await tx.update(playlistsTable).set({ updatedAt: new Date() }).where(eq(playlistsTable.id, playlistId)).execute();
			return getPlaylistClipsForOwnerServer(ctx.playlist.ownerId, playlistId, tx);
		});
	}

	return await db.transaction(async (tx) => {
		const existingRows = await tx.select().from(playlistClipsTable).where(eq(playlistClipsTable.playlistId, playlistId)).orderBy(playlistClipsTable.position).execute();
		const existingClipIds = new Set(existingRows.map((row) => row.clipId));
		const clipsToAppend = uniqueIncoming.filter((clip) => !existingClipIds.has(clip.id));
		const finalCount = existingRows.length + clipsToAppend.length;

		if (!isPro && finalCount > FREE_PLAYLIST_CLIP_LIMIT) {
			throw new Error(`Free plan playlists are limited to ${FREE_PLAYLIST_CLIP_LIMIT} clips`);
		}

		if (clipsToAppend.length > 0) {
			const basePosition = existingRows.length;
			await tx
				.insert(playlistClipsTable)
				.values(
					clipsToAppend.map((clip, index) => ({
						playlistId,
						clipId: clip.id,
						position: basePosition + index,
						clipData: JSON.stringify(clip),
					})),
				)
				.execute();
			await tx.update(playlistsTable).set({ updatedAt: new Date() }).where(eq(playlistsTable.id, playlistId)).execute();
		}

		return getPlaylistClipsForOwnerServer(ctx.playlist.ownerId, playlistId, tx);
	});
}

export async function reorderPlaylistClips(playlistId: string, orderedClipIds: string[]) {
	const ctx = await requirePlaylistAccess(playlistId);
	if (!ctx) return [];

	return await db.transaction(async (tx) => {
		const existingRows = await tx.select().from(playlistClipsTable).where(eq(playlistClipsTable.playlistId, playlistId)).orderBy(playlistClipsTable.position).execute();
		const existingById = new Map(existingRows.map((row) => [row.clipId, row]));
		const dedupedRequested = Array.from(new Set(orderedClipIds)).filter((clipId) => existingById.has(clipId));
		const remaining = existingRows.map((row) => row.clipId).filter((clipId) => !dedupedRequested.includes(clipId));
		const nextOrder = [...dedupedRequested, ...remaining];

		/* istanbul ignore next: empty result guard */
		if (nextOrder.length > 0) {
			const cases = nextOrder.map((clipId, index) => sql`WHEN ${playlistClipsTable.clipId} = ${clipId} THEN ${index}`);
			await tx
				.update(playlistClipsTable)
				.set({
					position: sql`(CASE ${sql.join(cases)} ELSE ${playlistClipsTable.position} END)`,
				})
				.where(eq(playlistClipsTable.playlistId, playlistId))
				.execute();
		}
		await tx.update(playlistsTable).set({ updatedAt: new Date() }).where(eq(playlistsTable.id, playlistId)).execute();
		return getPlaylistClipsForOwnerServer(ctx.playlist.ownerId, playlistId, tx);
	});
}

function applyPlaylistImportFilters(clips: TwitchClip[], filters: PlaylistImportFilters): TwitchClip[] {
	/* istanbul ignore next: fallback value */
	const overlayType = filters.overlayType ?? OverlayType.All;
	let result = [...clips];

	if (overlayType === OverlayType.Featured) {
		result = result.filter((clip) => Boolean((clip as TwitchClip & { is_featured?: boolean }).is_featured));
	} else if (overlayType !== OverlayType.All && overlayType !== OverlayType.Playlist && overlayType !== OverlayType.Queue) {
		const days = Number(overlayType);
		/* istanbul ignore next: type guard */
		if (Number.isFinite(days) && days > 0) {
			const minTs = Date.now() - days * 24 * 60 * 60 * 1000;
			result = result.filter((clip) => {
				const ts = new Date(clip.created_at).getTime();
				return Number.isFinite(ts) && ts >= minTs;
			});
		}
	}

	const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
	const startTs = filters.startDate ? new Date(filters.startDate).getTime() : Number.NaN;
	const endTs = filters.endDate
		? (() => {
				const raw = new Date(filters.endDate).getTime();
				if (!Number.isFinite(raw)) return Number.NaN;
				// If only a date is provided (no time), treat end as inclusive through the full day.
				/* istanbul ignore next: date pattern check */
				return dateOnlyPattern.test(filters.endDate) ? raw + 24 * 60 * 60 * 1000 - 1 : raw;
			})()
		: Number.NaN;
	if (Number.isFinite(startTs) || Number.isFinite(endTs)) {
		result = result.filter((clip) => {
			const ts = new Date(clip.created_at).getTime();
			/* istanbul ignore next: type guard */
			if (!Number.isFinite(ts)) return false;
			/* istanbul ignore next: type guard */
			if (Number.isFinite(startTs) && ts < startTs) return false;
			if (Number.isFinite(endTs) && ts > endTs) return false;
			return true;
		});
	}

	const minViews = Math.max(0, Math.floor(filters.minViews ?? 0));
	if (minViews > 0) {
		result = result.filter((clip) => clip.view_count >= minViews);
	}

	const minDuration = Math.max(0, Math.floor(filters.minDuration ?? 0));
	const maxDuration = Math.max(0, Math.floor(filters.maxDuration ?? 0));
	if (minDuration > 0 || maxDuration > 0) {
		result = result.filter((clip) => {
			if (minDuration > 0 && clip.duration < minDuration) return false;
			if (maxDuration > 0 && clip.duration > maxDuration) return false;
			return true;
		});
	}

	const normalizedCategory = filters.categoryId?.trim().toLowerCase();
	/* istanbul ignore next: fallback value */
	const normalizedCategories = (filters.categoryIds ?? []).map((entry) => entry.trim().toLowerCase()).filter((entry) => Boolean(entry) && entry !== "all");
	const allowedCategories = Array.from(new Set([...(normalizedCategory && normalizedCategory !== "all" ? [normalizedCategory] : []), ...normalizedCategories]));
	if (allowedCategories.length > 0) {
		result = result.filter((clip) => allowedCategories.includes(clip.game_id.toLowerCase()));
	}

	const allowedCreators = normalizeCreatorFilters(filters.clipCreatorsOnly);
	if (allowedCreators.length > 0) {
		result = result.filter((clip) => allowedCreators.includes(clip.creator_name.toLowerCase()) || allowedCreators.includes(clip.creator_id.toLowerCase()));
	}

	const blockedCreators = normalizeCreatorFilters(filters.clipCreatorsBlocked);
	if (blockedCreators.length > 0) {
		result = result.filter((clip) => !blockedCreators.includes(clip.creator_name.toLowerCase()) && !blockedCreators.includes(clip.creator_id.toLowerCase()));
	}

	const blacklistWords = (filters.blacklistWords ?? []).map((entry) => entry.trim()).filter(Boolean);
	if (blacklistWords.length > 0) {
		result = result.filter((clip) => !isTitleBlocked(clip.title, blacklistWords));
	}

	/* istanbul ignore next: fallback value */
	return result.sort((a, b) => b.view_count - a.view_count || b.created_at.localeCompare(a.created_at));
}

export async function importPlaylistClips(playlistId: string, filters: PlaylistImportFilters, mode: "append" | "replace") {
	const ctx = await requirePlaylistAccess(playlistId);
	if (!ctx) return [];

	const { isPro } = await getOwnerPlanContext(ctx.playlist.ownerId);
	if (!isPro) {
		throw new Error("Auto import is a Pro feature");
	}

	const source = await getPlaylistImportSourceClips(ctx.playlist.ownerId, filters);
	const imported = applyPlaylistImportFilters(source, filters);
	return upsertPlaylistClips(playlistId, imported, mode);
}

export async function previewImportPlaylistClips(playlistId: string, filters: PlaylistImportFilters): Promise<TwitchClip[]> {
	const ctx = await requirePlaylistAccess(playlistId);
	if (!ctx) return [];

	const { isPro } = await getOwnerPlanContext(ctx.playlist.ownerId);
	if (!isPro) {
		throw new Error("Auto import is a Pro feature");
	}

	const source = await getPlaylistImportSourceClips(ctx.playlist.ownerId, filters);
	return applyPlaylistImportFilters(source, filters);
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
			/* istanbul ignore next: plan mapping */
			effectivePlanByOwnerId.set(owner.id, entitlements?.effectivePlan === "pro" ? Plan.Pro : Plan.Free);
		}
		const result: Record<string, Plan> = {};

		for (const overlay of overlays) {
			/* istanbul ignore next: fallback value */
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
		const ownerRows = await db.select({ disabled: usersTable.disabled, disabledReason: usersTable.disabledReason }).from(usersTable).where(eq(usersTable.id, overlay.ownerId)).limit(1).execute();
		const owner = ownerRows[0];
		if (owner?.disabled) {
			return {
				...overlay,
				rewardId: null,
				secret: "",
				ownerDisabled: true,
				/* istanbul ignore next: disabled reason fallback */
				ownerDisabledReason: owner.disabledReason ?? "account_disabled",
			};
		}

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
			/* istanbul ignore next: fallback value */
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
			/* istanbul ignore next: empty result guard */
			if (existing.length >= 1) {
				console.warn(`Free plan overlay limit reached for owner id: ${userId}`);
				return null;
			}
		}
		const secret = crypto.randomUUID();
		const overlayRows = await db
			.insert(overlaysTable)
			.values({
				id: crypto.randomUUID(),
				ownerId: userId,
				secret,
				name: "New Overlay",
				status: StatusOptions.Active,
				type: OverlayType.Featured,
				playlistId: null,
			})
			.returning()
			.execute();
		const overlay = overlayRows[0];

		return overlay;
	} catch (error) {
		console.error("Error creating overlay:", error);
		throw new Error("Failed to create overlay");
	}
}

export async function downgradeUserPlan(userId: string) {
	await db.transaction(async (tx) => {
		const [overlays, playlists] = await Promise.all([tx.select().from(overlaysTable).where(eq(overlaysTable.ownerId, userId)).execute(), tx.select().from(playlistsTable).where(eq(playlistsTable.ownerId, userId)).orderBy(playlistsTable.createdAt).execute()]);

		if (overlays.length === 0 && playlists.length === 0) {
			return;
		}

		if (overlays.length > 0) {
			const [keptOverlay, ...overlaysToDeactivate] = overlays;

			if (overlaysToDeactivate.length > 0) {
				await tx
					.delete(overlaysTable)
					.where(
						inArray(
							overlaysTable.id,
							overlaysToDeactivate.map((o) => o.id),
						),
					)
					.execute();
			}

			await tx
				.update(overlaysTable)
				.set({
					rewardId: null,
					playlistId: null,
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
				.where(eq(overlaysTable.id, keptOverlay.id))
				.execute();
		}

		if (playlists.length > 0) {
			const [keptPlaylist, ...playlistsToDelete] = playlists;

			if (playlistsToDelete.length > 0) {
				await tx
					.delete(playlistsTable)
					.where(
						inArray(
							playlistsTable.id,
							playlistsToDelete.map((p) => p.id),
						),
					)
					.execute();
			}

			const keptRows = await tx.select().from(playlistClipsTable).where(eq(playlistClipsTable.playlistId, keptPlaylist.id)).orderBy(playlistClipsTable.position).execute();
			const removeIds = keptRows.slice(FREE_PLAYLIST_CLIP_LIMIT).map((row) => row.clipId);

			if (removeIds.length > 0) {
				await tx
					.delete(playlistClipsTable)
					.where(and(eq(playlistClipsTable.playlistId, keptPlaylist.id), inArray(playlistClipsTable.clipId, removeIds)))
					.execute();
			}
		}

		await tx.delete(editorsTable).where(eq(editorsTable.userId, userId)).execute();
		await tx.update(usersTable).set({ updatedAt: new Date() }).where(eq(usersTable.id, userId)).execute();
	});
}

export async function saveOverlay(overlayId: string, patch: OverlayPatch) {
	try {
		const ctx = await requireOverlayAccess(overlayId);
		/* istanbul ignore next: access guard */
		if (!ctx) return null;

		const sanitizedPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as OverlayPatch;
		const next = { ...ctx.overlay, ...sanitizedPatch };

		// Use the owner's access context to determine whether advanced settings are allowed
		const ownerRows = await db.select().from(usersTable).where(eq(usersTable.id, ctx.overlay.ownerId)).limit(1).execute();
		const owner = ownerRows[0];
		/* istanbul ignore next: fallback value */
		const ownerWithEntitlements = owner ? { ...owner, entitlements: await resolveUserEntitlements(owner) } : null;
		/* istanbul ignore next: fallback value */
		const advancedAccess = ownerWithEntitlements ? getFeatureAccess(ownerWithEntitlements, "advanced_filters") : { allowed: false as const };
		const updatePayload = buildOverlayUpdatePayload(next, advancedAccess.allowed);

		await db.update(overlaysTable).set(updatePayload).where(eq(overlaysTable.id, overlayId)).execute();

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
	/* istanbul ignore next: access guard */
	if (!ctx) return null;
	const owner = await getUserByIdServer(ctx.overlay.ownerId);
	/* istanbul ignore next: access guard */
	if (!owner) return null;
	/* istanbul ignore next: plan mapping */
	return owner.entitlements?.effectivePlan === "pro" ? Plan.Pro : Plan.Free;
}

// Public plan lookup scoped to an overlay id (embed use).
export async function getOverlayOwnerPlanPublic(overlayId: string): Promise<Plan | null> {
	try {
		const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.id, overlayId)).limit(1).execute();
		const overlay = overlays[0];
		/* istanbul ignore next: access guard */
		if (!overlay) return null;

		const ownerRows = await db.select().from(usersTable).where(eq(usersTable.id, overlay.ownerId)).limit(1).execute();
		const owner = ownerRows[0];
		if (!owner) return Plan.Free;
		const entitlements = await resolveUserEntitlements(owner);
		/* istanbul ignore next: plan mapping */
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
		/* istanbul ignore next: access guard */
		if (!overlay) return null;
		return getFirstFromClipQueueByOverlayId(overlayId);
	} catch (error) {
		console.error("Error fetching first clip from queue:", error);
		throw new Error("Failed to fetch first clip from queue");
	}
}

export async function removeFromClipQueueById(id: string) {
	try {
		const authedUser = await requireUser();
		if (!authedUser) throw new Error("Unauthorized");

		const itemRows = await db.select({ overlayId: queueTable.overlayId }).from(queueTable).where(eq(queueTable.id, id)).limit(1).execute();
		const item = itemRows[0];
		if (!item) return;

		const overlayRows = await db.select({ ownerId: overlaysTable.ownerId }).from(overlaysTable).where(eq(overlaysTable.id, item.overlayId)).limit(1).execute();
		const overlay = overlayRows[0];
		if (!overlay) return;

		if (!(await canEditOwner(authedUser.id, overlay.ownerId))) {
			throw new Error("Unauthorized");
		}

		await db.delete(queueTable).where(eq(queueTable.id, id)).execute();
	} catch (error) {
		console.error("Error removing clip from queue:", error);
		throw new Error("Failed to remove clip from queue");
	}
}

export async function removeFromClipQueue(id: string, overlayId: string, secret?: string) {
	try {
		const overlay = await requireOverlaySecretAccess(overlayId, secret);
		/* istanbul ignore next: access guard */
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
		/* istanbul ignore next: access guard */
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
		/* istanbul ignore next: fallback value */
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
		const authedUser = await requireUser();
		if (!authedUser) throw new Error("Unauthorized");

		const itemRows = await db.select({ broadcasterId: modQueueTable.broadcasterId }).from(modQueueTable).where(eq(modQueueTable.id, id)).limit(1).execute();
		const item = itemRows[0];
		if (!item) return;

		if (!(await canEditOwner(authedUser.id, item.broadcasterId))) {
			throw new Error("Unauthorized");
		}

		await db.delete(modQueueTable).where(eq(modQueueTable.id, id)).execute();
	} catch (error) {
		console.error("Error removing clip from mod queue:", error);
		throw new Error("Failed to remove clip from mod queue");
	}
}

export async function removeFromModQueue(id: string, overlayId: string, secret?: string) {
	try {
		const overlay = await requireOverlaySecretAccess(overlayId, secret);
		/* istanbul ignore next: access guard */
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

export async function getSettings(userId: string, forceSyncExternal = false): Promise<UserSettings> {
	try {
		const authedUser = await validateAuth(true);
		if (!authedUser || (authedUser.id !== userId && authedUser.role !== Role.Admin)) {
			throw new Error("Unauthorized");
		}

		return getSettingsServer(userId, forceSyncExternal);
	} catch (error) {
		console.error("Error fetching settings:", error);
		throw new Error("Failed to fetch settings");
	}
}

/**
 * Server-only version that bypasses user session validation.
 * Use only for internal server actions (e.g., EventSub, chat commands).
 */
export async function getSettingsServer(userId: string, forceSyncExternal = false): Promise<UserSettings> {
	try {
		const settingsWithoutEditors = await db.select().from(settingsTable).where(eq(settingsTable.id, userId)).limit(1).execute();

		if (settingsWithoutEditors.length === 0) {
			const userRows = await db.select({ createdAt: usersTable.createdAt, email: usersTable.email, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId)).limit(1).execute();
			const userRow = userRows[0];
			const consentRecordedAt = userRow?.createdAt ?? new Date();

			// Save default settings
			const defaultSettings: UserSettings = {
				id: userId,
				prefix: "!",
				marketingOptIn: true,
				marketingOptInAt: consentRecordedAt,
				marketingOptInSource: "soft_opt_in_default",
				useSendProductUpdatesContactId: null,
				editors: [],
			};

			const contactId =
				userRow && userRow.email && userRow.username
					? await syncProductUpdatesContact({
							email: userRow.email,
							subscribed: true,
							userId,
							username: userRow.username,
							source: "soft_opt_in",
					  })
					: null;

			// Insert default settings directly to avoid recursion with saveSettings auth checks
			await db
				.insert(settingsTable)
				.values({
					id: defaultSettings.id,
					prefix: defaultSettings.prefix,
					marketingOptIn: defaultSettings.marketingOptIn,
					marketingOptInAt: defaultSettings.marketingOptInAt,
					marketingOptInSource: defaultSettings.marketingOptInSource,
					useSendProductUpdatesContactId: contactId,
				})
				.onConflictDoUpdate({
					target: settingsTable.id,
					set: {
						useSendProductUpdatesContactId: contactId,
					},
				})
				.execute();

			return { ...defaultSettings, useSendProductUpdatesContactId: contactId };
		}

		const settingsEditors = await db.select().from(editorsTable).where(eq(editorsTable.userId, userId)).execute();

		const editorNames = await getUsersDetailsBulk({
			userIds: settingsEditors.map((editor) => editor.editorId),
			accessToken: (await getAccessTokenServer(userId))?.accessToken || "",
		});

		const settings: UserSettings[] = settingsWithoutEditors.map((setting) => ({
			...setting,
			editors: editorNames.map((editor) => editor.login),
		}));

		const currentSettings = settings[0];

		// Sync marketingOptIn from UseSend if it's different and forceSyncExternal is true
		if (forceSyncExternal) {
			const user = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1).execute();
			const userEmail = user[0]?.email;
			const remoteSubscribed = await getProductUpdatesSubscriptionStatus(currentSettings.useSendProductUpdatesContactId, userEmail);

			/* istanbul ignore next: remote sync guard */
			if (remoteSubscribed !== null && remoteSubscribed !== currentSettings.marketingOptIn) {
				const now = new Date();
				const marketingOptIn = remoteSubscribed;
				let marketingOptInAt = currentSettings.marketingOptInAt;
				let marketingOptInSource = currentSettings.marketingOptInSource;

				if (marketingOptIn) {
					marketingOptInAt = now;
					marketingOptInSource = "external_usesend_sync_optin";
				} else {
					marketingOptInAt = null;
					marketingOptInSource = "external_usesend_sync_optout";
				}

				await db
					.update(settingsTable)
					.set({
						marketingOptIn,
						marketingOptInAt,
						marketingOptInSource,
					})
					.where(eq(settingsTable.id, userId))
					.execute();

				currentSettings.marketingOptIn = marketingOptIn;
				currentSettings.marketingOptInAt = marketingOptInAt;
				currentSettings.marketingOptInSource = marketingOptInSource;
			}
		}

		return currentSettings;
	} catch (error) {
		console.error("Error fetching settings server:", error);
		throw new Error("Failed to fetch settings server");
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
	const marketingOptIn = Boolean(settings.marketingOptIn);
	const editors = settings.editors ?? [];
	const editorsAccess = getFeatureAccess(authedUser, "editors");
	/* istanbul ignore next: feature access guard */
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

		/* istanbul ignore next: user batch mapping */
		rows = (users ?? []).filter((u): u is TwitchUserResponse => !!u?.id).map((u) => ({ userId: settings.id, editorId: u.id }));
	}

	try {
		const existingSettingsRows = await db.select().from(settingsTable).where(eq(settingsTable.id, userId)).limit(1).execute();
		const existingSettings = existingSettingsRows[0];
		const wasOptedIn = Boolean(existingSettings?.marketingOptIn);
		const requestedSource = settings.marketingOptInSource ?? null;

		let marketingOptInAt = existingSettings?.marketingOptInAt ?? null;
		let marketingOptInSource = existingSettings?.marketingOptInSource ?? null;
		if (!marketingOptIn && wasOptedIn) {
			marketingOptInAt = null;
			marketingOptInSource = "settings_page_optout";
		} else if (marketingOptIn && !wasOptedIn) {
			if (requestedSource === "soft_opt_in_default") {
				marketingOptInAt = existingSettings?.marketingOptInAt ?? new Date();
				marketingOptInSource = "soft_opt_in_default";
			} else {
				marketingOptInAt = new Date();
				marketingOptInSource = "settings_page_explicit_optin";
			}
		} else {
			// No consent state change; keep existing audit/source values untouched.
			marketingOptInAt = existingSettings?.marketingOptInAt ?? null;
			marketingOptInSource = existingSettings?.marketingOptInSource ?? null;
		}

		const useSendProductUpdatesContactId = existingSettings?.useSendProductUpdatesContactId ?? null;

		await db.transaction(async (tx) => {
			// Upsert settings
			await tx
				.insert(settingsTable)
				.values({ id: userId, prefix, marketingOptIn, marketingOptInAt, marketingOptInSource, useSendProductUpdatesContactId })
				.onConflictDoUpdate({
					target: settingsTable.id,
					set: { prefix, marketingOptIn, marketingOptInAt, marketingOptInSource, useSendProductUpdatesContactId },
				})
				.execute();

			// Replace editors
			await tx.delete(editorsTable).where(eq(editorsTable.userId, userId)).execute();

			if (rows.length > 0) {
				await tx.insert(editorsTable).values(rows).execute();
			}
		});

		const finalSettings: Pick<UserSettings, "marketingOptIn" | "marketingOptInSource"> = {
			marketingOptIn,
			marketingOptInSource,
		};
		const previousSettings: Pick<UserSettings, "marketingOptIn" | "marketingOptInSource"> = {
			marketingOptIn: Boolean(existingSettings?.marketingOptIn),
			marketingOptInSource: existingSettings?.marketingOptInSource ?? null,
		};
		const previousSubscribed = isProductUpdatesSubscribed(previousSettings);
		const nextSubscribed = isProductUpdatesSubscribed(finalSettings);
		const previousSource = deriveProductUpdatesConsentSource(previousSettings);
		const nextSource = deriveProductUpdatesConsentSource(finalSettings);
		const shouldRetryMissingContactSync = !useSendProductUpdatesContactId && nextSubscribed;

		if (previousSubscribed !== nextSubscribed || previousSource !== nextSource || shouldRetryMissingContactSync) {
			const syncedContactId = await syncProductUpdatesContact({
				email: authedUser.email,
				subscribed: nextSubscribed,
				userId: authedUser.id,
				username: authedUser.username,
				source: nextSource,
				contactId: useSendProductUpdatesContactId,
			});
			if (syncedContactId && syncedContactId !== useSendProductUpdatesContactId) {
				await db.update(settingsTable).set({ useSendProductUpdatesContactId: syncedContactId }).where(eq(settingsTable.id, userId)).execute();
			}
		}
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
		const parsed = parseCacheJson<T>(rows[0].value, `getTwitchCache:${type}:${key}`);
		if (parsed === null) {
			recordCacheRead(false);
			return null;
		}
		recordCacheRead(true);
		return parsed;
	} catch (error) {
		console.error("Error reading twitch cache:", error);
		return null;
	}
}

export async function getTwitchCacheEntry<T>(type: TwitchCacheType, key: string): Promise<{ hit: boolean; value: T | null; fetchedAt?: Date }> {
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
		const parsed = parseCacheJson<T>(rows[0].value, `getTwitchCacheEntry:${type}:${key}`);
		if (parsed === null) {
			recordCacheRead(false);
			return { hit: false, value: null };
		}
		recordCacheRead(true);
		return { hit: true, value: parsed, fetchedAt: rows[0].fetchedAt };
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
		const parsed = parseCacheJson<T>(rows[0].value, `getTwitchCacheStale:${type}:${key}`);
		if (parsed === null) {
			recordCacheRead(false, true);
			return null;
		}
		recordCacheRead(true, true);
		return parsed;
	} catch (error) {
		console.error("Error reading stale twitch cache:", error);
		return null;
	}
}

export async function setTwitchCache(type: TwitchCacheType, key: string, value: unknown, ttlSeconds?: number) {
	try {
		const now = new Date();
		/* istanbul ignore next: cache expiration calculation */
		const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
		const payload = JSON.stringify(value);

		/* istanbul ignore next: cache cleanup background task */
		cleanupTwitchCacheIfNeeded(now).catch((error) => console.error("Error cleaning up twitch cache:", summarizeError(error)));

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
		console.error("Error writing twitch cache:", summarizeError(error));
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

		const values: T[] = [];
		for (const row of rows) {
			const parsed = parseCacheJson<T>(row.value, `getTwitchCacheBatch:${type}:${row.key}`);
			if (parsed === null) continue;
			values.push(parsed);
		}
		recordCacheBatchReads(values.length, keys.length);
		return values;
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
		/* istanbul ignore next: query limit application */
		const rows = typeof limit === "number" ? await baseQuery.limit(limit).execute() : await baseQuery.execute();

		const entries: Array<{ key: string; value: T }> = [];
		for (const row of rows) {
			const parsed = parseCacheJson<T>(row.value, `getTwitchCacheByPrefixEntries:${type}:${row.key}`);
			if (parsed === null) continue;
			entries.push({
				key: row.key,
				value: parsed,
			});
		}
		return entries;
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

		const values: T[] = [];
		for (const row of rows) {
			const parsed = parseCacheJson<T>(row.value, `getTwitchCacheStaleBatch:${type}:${row.key}`);
			if (parsed === null) continue;
			values.push(parsed);
		}
		recordCacheBatchReads(values.length, keys.length, true);
		return values;
	} catch (error) {
		console.error("Error reading stale twitch cache batch:", error);
		return [];
	}
}

function parseCacheJson<T>(value: string, context: string): T | null {
	try {
		return JSON.parse(value) as T;
	} catch (error) {
		console.error("Error parsing twitch cache payload (%s): %s", context, summarizeError(error));
		return null;
	}
}

export async function setTwitchCacheBatch(type: TwitchCacheType, entries: { key: string; value: unknown }[], ttlSeconds?: number) {
	try {
		if (entries.length === 0) return;
		const now = new Date();
		/* istanbul ignore next: cache expiration calculation */
		const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
		const rows = entries.map((entry) => ({
			type,
			key: entry.key,
			value: JSON.stringify(entry.value),
			fetchedAt: now,
			expiresAt,
		}));

		/* istanbul ignore next: cache cleanup background task */
		cleanupTwitchCacheIfNeeded(now).catch((error) => console.error("Error cleaning up twitch cache:", summarizeError(error)));

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
		console.error("Error writing twitch cache batch:", summarizeError(error));
	}
}

export async function deleteTwitchCacheKeys(type: TwitchCacheType, keys: string[]) {
	try {
		if (keys.length === 0) return 0;
		const result = await db
			.delete(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, type), inArray(twitchCacheTable.key, keys)))
			.execute();
		/* istanbul ignore next: rowCount extraction */
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
		/* istanbul ignore next: rowCount extraction */
		return Number(result.rowCount ?? 0);
	} catch (error) {
		console.error("Error deleting twitch cache by prefix:", error);
		return 0;
	}
}
