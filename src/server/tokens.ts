import "server-only";

import { db } from "@/db/client";
import { overlaysTable, tokenTable, usersTable } from "@/db/schema";
import { refreshAccessTokenWithContextInternal } from "@/server/twitch-auth";
import { decryptToken, encryptToken } from "@lib/tokenCrypto";
import { StatusOptions } from "@types";
import { eq } from "drizzle-orm";
import { UserToken } from "@types";

export type AccessTokenResult = {
	token: UserToken | null;
	reason?: "user_disabled" | "token_row_missing" | "token_decrypt_failed" | "refresh_invalid_token" | "refresh_failed";
};

async function disableUserAccessInternal(userId: string, reason: string) {
	const now = new Date();
	await db
		.update(usersTable)
		.set({
			disabled: true,
			disableType: "automatic",
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
}

async function persistRefreshedTokenInternal(userId: string, token: { access_token: string; refresh_token: string; expires_in: number; scope: string[]; token_type: string }) {
	const expiresAt = new Date(Date.now() + token.expires_in * 1000);
	const aad = `twitchUser:${userId}:oauth`;
	await db
		.update(tokenTable)
		.set({
			accessToken: encryptToken(token.access_token, aad),
			refreshToken: encryptToken(token.refresh_token, aad),
			expiresAt,
			scope: token.scope,
			tokenType: token.token_type,
		})
		.where(eq(tokenTable.id, userId))
		.execute();
}

export async function getAccessTokenResultInternal(userId: string): Promise<AccessTokenResult> {
	try {
		const userRows = await db.select({ disabled: usersTable.disabled }).from(usersTable).where(eq(usersTable.id, userId)).limit(1).execute();
		const userRow = userRows[0];
		if (userRow?.disabled) return { token: null, reason: "user_disabled" };

		const rows = await db.select().from(tokenTable).where(eq(tokenTable.id, userId)).limit(1).execute();
		if (rows.length === 0) return { token: null, reason: "token_row_missing" };

		const row = rows[0];
		const aad = `twitchUser:${userId}:oauth`;

		let accessToken: string;
		let refreshToken: string;
		try {
			accessToken = decryptToken(row.accessToken, aad);
			refreshToken = decryptToken(row.refreshToken, aad);
		} catch {
			console.error("Token decrypt failed for user:", userId);
			return { token: null, reason: "token_decrypt_failed" };
		}

		const EXPIRATION_BUFFER_MS = 60000;
		if (Date.now() + EXPIRATION_BUFFER_MS > row.expiresAt.getTime()) {
			const refreshResult = await refreshAccessTokenWithContextInternal(refreshToken, userId);
			const newToken = refreshResult.token;
			if (!newToken) {
				if (refreshResult.invalidRefreshToken) await disableUserAccessInternal(userId, "invalid_refresh_token");
				return { token: null, reason: refreshResult.invalidRefreshToken ? "refresh_invalid_token" : "refresh_failed" };
			}
			await persistRefreshedTokenInternal(userId, newToken);
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
				accessToken,
				refreshToken,
				expiresAt: row.expiresAt,
				scope: row.scope,
				tokenType: row.tokenType,
			},
		};
	} catch (error) {
		console.error("Error fetching access token:", error);
		throw new Error("Failed to fetch access token");
	}
}

export async function getAccessTokenInternal(userId: string): Promise<UserToken | null> {
	const result = await getAccessTokenResultInternal(userId);
	return result.token;
}
