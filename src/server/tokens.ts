import "server-only";

import { db } from "@/db/client";
import { usersTable } from "@/db/schema";
import { getBetterAuthProviderAccessToken } from "@/server/provider-credentials";
import { eq } from "drizzle-orm";
import { UserToken } from "@types";

export type AccessTokenResult = {
	token: UserToken | null;
	reason?: "user_disabled" | "token_row_missing" | "refresh_failed";
};

async function getBetterAuthAccessToken(userId: string): Promise<AccessTokenResult> {
	try {
		const value = await getBetterAuthProviderAccessToken(userId);
		if (!value) return { token: null, reason: "token_row_missing" };
		return { token: { id: userId, accessToken: value.accessToken, refreshToken: "", expiresAt: value.accessTokenExpiresAt ?? new Date(Date.now() + 60_000), scope: value.scopes, tokenType: "bearer" } };
	} catch {
		return { token: null, reason: "refresh_failed" };
	}
}

export async function getAccessTokenResultInternal(userId: string): Promise<AccessTokenResult> {
	try {
		const userRows = await db.select({ disabled: usersTable.disabled }).from(usersTable).where(eq(usersTable.id, userId)).limit(1).execute();
		const userRow = userRows[0];
		if (userRow?.disabled) return { token: null, reason: "user_disabled" };
		return getBetterAuthAccessToken(userId);
	} catch (error) {
		console.error("Error fetching access token:", error);
		throw new Error("Failed to fetch access token");
	}
}

export async function getAccessTokenInternal(userId: string): Promise<UserToken | null> {
	const result = await getAccessTokenResultInternal(userId);
	return result.token;
}
