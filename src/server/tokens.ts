import "server-only";

import { db } from "@/db/client";
import { tokenTable, usersTable } from "@/db/schema";
import { disableUserAccess, setAccessToken } from "@actions/database";
import { refreshAccessTokenWithContext } from "@actions/twitch";
import { decryptToken } from "@lib/tokenCrypto";
import { eq } from "drizzle-orm";
import { UserToken } from "@types";

export type AccessTokenResult = {
	token: UserToken | null;
	reason?: "user_disabled" | "token_row_missing" | "token_decrypt_failed" | "refresh_invalid_token" | "refresh_failed";
};

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
			const refreshResult = await refreshAccessTokenWithContext(refreshToken, userId);
			const newToken = refreshResult.token;
			if (!newToken) {
				if (refreshResult.invalidRefreshToken) await disableUserAccess(userId, "invalid_refresh_token");
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
