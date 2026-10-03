import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { requiredAuthSetting } from "./environment";

export const ACCOUNT_DATA_EXPORT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export type AccountDataExportTokenPayload = {
	version: 1;
	authUserId: string;
	creatorId: string;
	organizationId: string;
	expiresAt: number;
};

function secret() {
	return requiredAuthSetting("BETTER_AUTH_SECRET", "JWT_SECRET");
}

function sign(encodedPayload: string) {
	return createHmac("sha256", secret()).update(`clipify-account-export:${encodedPayload}`).digest("base64url");
}

export function createAccountDataExportToken(input: Omit<AccountDataExportTokenPayload, "version" | "expiresAt"> & { now?: Date; ttlMs?: number }) {
	const payload: AccountDataExportTokenPayload = {
		version: 1,
		authUserId: input.authUserId,
		creatorId: input.creatorId,
		organizationId: input.organizationId,
		expiresAt: (input.now ?? new Date()).getTime() + (input.ttlMs ?? ACCOUNT_DATA_EXPORT_TTL_MS),
	};
	const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
	return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyAccountDataExportToken(token: string, now = new Date()): AccountDataExportTokenPayload | null {
	const [encodedPayload, suppliedSignature, extra] = token.split(".");
	if (!encodedPayload || !suppliedSignature || extra) return null;
	const expectedSignature = sign(encodedPayload);
	const supplied = Buffer.from(suppliedSignature);
	const expected = Buffer.from(expectedSignature);
	if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
	try {
		const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<AccountDataExportTokenPayload>;
		if (payload.version !== 1 || !payload.authUserId || !payload.creatorId || !payload.organizationId || typeof payload.expiresAt !== "number" || payload.expiresAt <= now.getTime()) return null;
		return payload as AccountDataExportTokenPayload;
	} catch {
		return null;
	}
}
