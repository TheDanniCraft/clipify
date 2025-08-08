"use server";

import { drizzle } from "drizzle-orm/node-postgres";
import { tokenTable, usersTable, overlaysTable, queueTable } from "@/db/schema";
import { AuthenticatedUser, Overlay, TwitchUserResponse, TwitchTokenApiResponse, UserToken, Plan, Role } from "@types";
import { getUserDetails, refreshAccessToken, subscribeToReward } from "@actions/twitch";
import { eq, inArray } from "drizzle-orm";
import { validateAuth } from "@actions/auth";

const db = drizzle(process.env.DATABASE_URL!);

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

export async function getUserPlan(id: string): Promise<string | null> {
	try {
		const isAuthenticated = await validateAuth(true);
		if (!isAuthenticated || isAuthenticated.id !== id) {
			console.warn(`Unauthenticated "getUserPlan" API request for user id: ${id}`);
			return null;
		}

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

		await db
			.insert(tokenTable)
			.values({
				id: user.id,
				accessToken: token.access_token,
				refreshToken: token.refresh_token,
				expiresAt: expiresAt.toISOString(),
				scope: token.scope,
				tokenType: token.token_type,
			})
			.onConflictDoUpdate({
				target: tokenTable.id,
				set: {
					accessToken: token.access_token,
					refreshToken: token.refresh_token,
					expiresAt: expiresAt.toISOString(),
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
		const token = await db.select().from(tokenTable).where(eq(tokenTable.id, userId)).limit(1).execute();

		if (token.length === 0) {
			return null;
		}

		const currentTime = new Date();
		const expiresAt = new Date(token[0].expiresAt);

		if (currentTime > expiresAt) {
			const newToken = await refreshAccessToken(token[0].refreshToken);

			if (!newToken) {
				return null;
			}

			await setAccessToken(newToken);
			return {
				id: userId,
				accessToken: newToken.access_token,
				refreshToken: newToken.refresh_token,
				expiresAt: new Date(Date.now() + newToken.expires_in * 1000).toISOString(),
				scope: newToken.scope,
				tokenType: newToken.token_type,
			};
		}

		return {
			id: userId,
			accessToken: token[0].accessToken,
			refreshToken: token[0].refreshToken,
			expiresAt: expiresAt.toISOString(),
			scope: token[0].scope,
			tokenType: token[0].tokenType,
		};
	} catch (error) {
		console.error("Error fetching access token:", error);
		throw new Error("Failed to fetch access token");
	}
}

export async function getAllOverlays(userId: string) {
	try {
		const isAuthenticated = await validateAuth(true);
		if (!isAuthenticated || isAuthenticated.id !== userId) {
			console.warn(`Unauthenticated "getAllOverlays" API request for user id: ${userId}`);
			return null;
		}

		const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, userId)).execute();

		return overlays;
	} catch (error) {
		console.error("Error fetching overlays:", error);
		throw new Error("Failed to fetch overlays");
	}
}

export async function getOverlay(overlayId: string) {
	try {
		const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.id, overlayId)).execute();

		return overlays[0];
	} catch (error) {
		console.error("Error fetching overlay:", error);
		throw new Error("Failed to fetch overlay");
	}
}

export async function createOverlay(userId: string) {
	try {
		const overlay = await db
			.insert(overlaysTable)
			.values({
				id: crypto.randomUUID(),
				ownerId: userId,
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

	await db.update(overlaysTable).set({ rewardId: null }).where(eq(overlaysTable.id, overlays[0].id)).execute();
}

export async function saveOverlay(overlay: Overlay) {
	try {
		const isAuthenticated = await validateAuth(true);
		if (!isAuthenticated || isAuthenticated.id !== overlay.ownerId) {
			console.warn(`Unauthenticated "saveOverlay" API request for user id: ${overlay.ownerId}`);
			return null;
		}

		const plan = isAuthenticated.plan;

		await db
			.insert(overlaysTable)
			.values({
				id: overlay.id,
				ownerId: overlay.ownerId,
				name: overlay.name,
				status: overlay.status,
				type: overlay.type,
				rewardId: plan === Plan.Free ? null : overlay.rewardId,
			})
			.onConflictDoUpdate({
				target: overlaysTable.id,
				set: {
					name: overlay.name,
					status: overlay.status,
					type: overlay.type,
					rewardId: plan === Plan.Free ? null : overlay.rewardId,
				},
			});

		if (overlay.rewardId) {
			subscribeToReward(overlay.ownerId, overlay.rewardId);
		}
	} catch (error) {
		console.log(overlay);
		console.error("Error saving overlay:", error);
		throw new Error("Failed to save overlay");
	}
}

export async function deleteOverlay(overlay: Overlay) {
	try {
		const isAuthenticated = await validateAuth(true);
		if (!isAuthenticated || isAuthenticated.id !== overlay.ownerId) {
			console.warn(`Unauthenticated "deleteOverlay" API request for user id: ${overlay.ownerId}`);
			return null;
		}
		await db.delete(overlaysTable).where(eq(overlaysTable.id, overlay.id)).execute();
	} catch (error) {
		console.error("Error deleting overlay:", error);
		throw new Error("Failed to delete overlay");
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

export async function getFirstFromClipQueue(overlayId: string) {
	try {
		const result = await db.select().from(queueTable).where(eq(queueTable.overlayId, overlayId)).limit(1).execute();

		return result[0] || null;
	} catch (error) {
		console.error("Error fetching first clip from queue:", error);
		throw new Error("Failed to fetch first clip from queue");
	}
}

export async function removeFromClipQueue(id: string) {
	try {
		await db.delete(queueTable).where(eq(queueTable.id, id)).execute();
	} catch (error) {
		console.error("Error removing clip from queue:", error);
		throw new Error("Failed to remove clip from queue");
	}
}
