"use server";

import { drizzle } from "drizzle-orm/node-postgres";
import { tokenTable, usersTable, overlaysTable, queueTable, settingsTable, modQueueTable, editorsTable } from "@/db/schema";
import { AuthenticatedUser, Overlay, TwitchUserResponse, TwitchTokenApiResponse, UserToken, Plan, Role, UserSettings } from "@types";
import { getUserDetails, getUsersDetailsBulk, refreshAccessToken, subscribeToReward } from "@actions/twitch";
import { eq, inArray, and } from "drizzle-orm";
import { validateAuth } from "@actions/auth";

const db = drizzle(process.env.DATABASE_URL!);

async function isEditor(user: AuthenticatedUser, overlay: Overlay): Promise<boolean> {
	const isOwner = user.id === overlay.ownerId;
	if (!isOwner) {
		const editorRows = await db
			.select()
			.from(editorsTable)
			.where(and(eq(editorsTable.editorId, user.id), eq(editorsTable.userId, overlay.ownerId)))
			.limit(1)
			.execute();

		if (!editorRows || editorRows.length === 0) {
			return false;
		}

		return true;
	}

	return true;
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

export async function getUserPlan(id: string): Promise<Plan | null> {
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
		const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, userId)).execute();

		return overlays;
	} catch (error) {
		console.error("Error fetching overlays:", error);
		throw new Error("Failed to fetch overlays");
	}
}

export async function getAllOverlayIds(userId: string) {
	try {
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

export async function getEditorOverlays(ownerId: string) {
	try {
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

	await db.delete(editorsTable).where(eq(editorsTable.userId, userId)).execute();
}

export async function saveOverlay(overlay: Overlay) {
	try {
		const isAuthenticated = await validateAuth(true);
		if (!isAuthenticated) {
			console.warn(`Unauthenticated "saveOverlay" API request`);
			return null;
		}

		if (!(await isEditor(isAuthenticated, overlay))) {
			console.warn(`Unauthorized "saveOverlay" API request for user id: ${isAuthenticated.id} on overlay id: ${overlay.id}`);
			return null;
		}
		// Use the owner's plan to determine whether rewardId is allowed
		const ownerRows = await db.select().from(usersTable).where(eq(usersTable.id, overlay.ownerId)).limit(1).execute();
		const plan = ownerRows && ownerRows[0] ? ownerRows[0].plan : Plan.Free;

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
		if (!isAuthenticated) {
			console.warn(`Unauthenticated "deleteOverlay" API request`);
			return;
		}
		if (!(await isEditor(isAuthenticated, overlay))) {
			console.warn(`Unauthorized "deleteOverlay" API request for user id: ${isAuthenticated.id} on overlay id: ${overlay.id}`);
			return;
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

export async function getClipQueue(overlayId: string) {
	try {
		const result = await db.select().from(queueTable).where(eq(queueTable.overlayId, overlayId)).execute();
		return result;
	} catch (error) {
		console.error("Error fetching clip queue:", error);
		throw new Error("Failed to fetch clip queue");
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

export async function clearClipQueue(overlayId: string) {
	try {
		await db.delete(queueTable).where(eq(queueTable.overlayId, overlayId)).execute();
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

export async function getModQueue(broadcasterId: string) {
	try {
		const result = await db.select().from(modQueueTable).where(eq(modQueueTable.broadcasterId, broadcasterId)).execute();
		return result;
	} catch (error) {
		console.error("Error fetching mod queue:", error);
		throw new Error("Failed to fetch mod queue");
	}
}

export async function getFirstFromModQueue(broadcasterId: string) {
	try {
		const result = await db.select().from(modQueueTable).where(eq(modQueueTable.broadcasterId, broadcasterId)).limit(1).execute();
		return result[0] || null;
	} catch (error) {
		console.error("Error fetching first clip from mod queue:", error);
		throw new Error("Failed to fetch first clip from mod queue");
	}
}

export async function removeFromModQueue(id: string) {
	try {
		await db.delete(modQueueTable).where(eq(modQueueTable.id, id)).execute();
	} catch (error) {
		console.error("Error removing clip from mod queue:", error);
		throw new Error("Failed to remove clip from mod queue");
	}
}

export async function clearModQueue(broadcasterId: string) {
	try {
		await db.delete(modQueueTable).where(eq(modQueueTable.broadcasterId, broadcasterId)).execute();
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

	// Clean + dedupe editor names (and never include self)
	const editorNames = Array.from(new Set(editors.filter((name) => name && name !== userId)));

	// Do network calls BEFORE the transaction (keeps tx short)
	let rows: Array<{ userId: string; editorId: string }> = [];

	if (editorNames.length > 0) {
		const accessToken = await getAccessToken(userId);
		if (!accessToken) return;

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
