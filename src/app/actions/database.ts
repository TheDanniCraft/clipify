"use server";

import { drizzle } from "drizzle-orm/node-postgres";
import { tokenTable, usersTable, overlaysTable, queueTable, settingsTable, modQueueTable, editorsTable, twitchCacheTable } from "@/db/schema";
import { AuthenticatedUser, Overlay, TwitchUserResponse, TwitchTokenApiResponse, UserToken, Plan, Role, UserSettings, TwitchCacheType } from "@types";
import { getUserDetails, getUsersDetailsBulk, refreshAccessToken, subscribeToReward } from "@actions/twitch";
import { eq, inArray, and, or, isNull, lt, gt, sql } from "drizzle-orm";
import { validateAuth } from "@actions/auth";
import { encryptToken, decryptToken } from "@lib/tokenCrypto";

const db = drizzle(process.env.DATABASE_URL!);

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

type OverlayPatch = Partial<Pick<Overlay, "name" | "status" | "type" | "rewardId" | "minClipDuration" | "maxClipDuration" | "blacklistWords" | "minClipViews">>;

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
		return await db
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
		const owners = await db.select({ id: usersTable.id, plan: usersTable.plan }).from(usersTable).where(inArray(usersTable.id, ownerIds)).execute();

		const planByOwnerId = new Map(owners.map((owner) => [owner.id, owner.plan]));
		const result: Record<string, Plan> = {};

		for (const overlay of overlays) {
			result[overlay.id] = planByOwnerId.get(overlay.ownerId) ?? Plan.Free;
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
		const ownerPlan = ownerRows && ownerRows[0] ? ownerRows[0].plan : Plan.Free;
		if (ownerPlan === Plan.Free) {
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
				status: "active",
				type: "Featured",
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

	await db.update(overlaysTable).set({ rewardId: null, blacklistWords: [], minClipViews: 0, minClipDuration: 0, maxClipDuration: 60 }).where(eq(overlaysTable.id, overlays[0].id)).execute();

	await db.delete(editorsTable).where(eq(editorsTable.userId, userId)).execute();

	await db.update(usersTable).set({ updatedAt: new Date() }).where(eq(usersTable.id, userId)).execute();
}

export async function saveOverlay(overlayId: string, patch: OverlayPatch) {
	try {
		const ctx = await requireOverlayAccess(overlayId);
		if (!ctx) return null;

		const sanitizedPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as OverlayPatch;
		const next = { ...ctx.overlay, ...sanitizedPatch };

		// Use the owner's plan to determine whether rewardId is allowed
		const ownerRows = await db.select().from(usersTable).where(eq(usersTable.id, ctx.overlay.ownerId)).limit(1).execute();
		const plan = ownerRows && ownerRows[0] ? ownerRows[0].plan : Plan.Free;
		const rewardIdAllowed = plan === Plan.Free ? null : (next.rewardId ?? null);

		await db
			.update(overlaysTable)
			.set({
				name: next.name,
				status: next.status,
				type: next.type,
				rewardId: rewardIdAllowed,
				updatedAt: new Date(),
				minClipDuration: next.minClipDuration,
				maxClipDuration: next.maxClipDuration,
				blacklistWords: next.blacklistWords,
				minClipViews: next.minClipViews,
			})
			.where(eq(overlaysTable.id, overlayId))
			.execute();

		if (rewardIdAllowed && rewardIdAllowed !== ctx.overlay.rewardId) {
			subscribeToReward(ctx.overlay.ownerId, rewardIdAllowed);
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

	return getUserPlanByIdInternal(ctx.overlay.ownerId);
}

// Public plan lookup scoped to an overlay id (embed use).
export async function getOverlayOwnerPlanPublic(overlayId: string): Promise<Plan | null> {
	try {
		const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.id, overlayId)).limit(1).execute();
		const overlay = overlays[0];
		if (!overlay) return null;

		return getUserPlanByIdInternal(overlay.ownerId);
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
	const prefix = settings.prefix;
	const editors = settings.editors ?? [];

	const accessToken = await getAccessToken(userId);
	if (!accessToken) throw new Error("Could not retrieve access token.");

	// Fetch the user's username (login) to filter out self from editors
	const userDetails = await getUserDetails(accessToken.accessToken);
	const userLogin = userDetails?.login;
	// Clean + dedupe editor names (and never include self)
	const editorNames = Array.from(new Set(editors.filter((name) => name && name !== userLogin)));

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

		if (rows.length === 0) return null;

		return JSON.parse(rows[0].value) as T;
	} catch (error) {
		console.error("Error reading twitch cache:", error);
		return null;
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

		if (rows.length === 0) return null;

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
