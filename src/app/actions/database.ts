"use server";

import { drizzle } from "drizzle-orm/node-postgres";
import { tokenTable, usersTable, overlaysTable } from "@/db/schema";
import { AuthenticatedUser, Overlay, TwitchTokenResponse, TwitchUserResponse } from "@types";
import { getSubscriptionStatus, getUserDetails, refreshAccessToken } from "@actions/twitch";
import { eq } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL!);

export async function setUser(user: TwitchUserResponse, token: TwitchTokenResponse): Promise<AuthenticatedUser> {
	try {
		const plan = await getSubscriptionStatus(token.access_token, user.id);

		return await db
			.insert(usersTable)
			.values({
				id: user.id,
				username: user.login,
				email: user.email,
				avatar: user.profile_image_url,
				role: "user",
				plan: plan,
			})
			.onConflictDoUpdate({
				target: usersTable.id,
				set: {
					username: user.login,
					email: user.email,
					avatar: user.profile_image_url,
					role: "user",
					plan: plan,
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
		const user = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1).execute();

		return user[0] || null;
	} catch (error) {
		console.error("Error fetching user:", error);
		throw new Error("Failed to fetch user");
	}
}

export async function setAccessToken(token: TwitchTokenResponse): Promise<AuthenticatedUser> {
	try {
		const user = await getUserDetails(token.access_token);
		const dbUser = await setUser(user, token);

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

export async function getAccessToken(userId: string): Promise<TwitchTokenResponse | null> {
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
			return newToken;
		}

		return {
			access_token: token[0].accessToken,
			refresh_token: token[0].refreshToken,
			expires_in: Math.floor((new Date(token[0].expiresAt).getTime() - Date.now()) / 1000),
			scope: token[0].scope,
			token_type: token[0].tokenType,
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

export async function getOverlay(overlayId: string) {
	try {
		const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.id, overlayId)).execute();

		return overlays[0];
	} catch (error) {
		console.error("Error fetching overlay:", error);
		throw new Error("Failed to fetch overlay");
	}
}

export async function saveOverlay(overlayId: string, overlay: Overlay) {
	try {
		await db
			.insert(overlaysTable)
			.values({
				id: overlay.id,
				ownerId: overlay.ownerId,
				name: overlay.name,
				status: overlay.status,
				type: overlay.type,
			})
			.onConflictDoUpdate({
				target: overlaysTable.id,
				set: {
					name: overlay.name,
					status: overlay.status,
					type: overlay.type,
				},
			});
	} catch (error) {
		console.log(overlay);
		console.error("Error saving overlay:", error);
		throw new Error("Failed to save overlay");
	}
}
