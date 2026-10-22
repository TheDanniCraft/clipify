import "server-only";

import { createHmac } from "node:crypto";
import { c15tInstance } from "@c15t/backend";
import { getConsentTrustedOrigins } from "./origins";
import { consentPolicyRules } from "./policy";

let c15t: ReturnType<typeof c15tInstance> | undefined;

export function getC15t() {
	if (c15t) return c15t;
	const secret = process.env.ENCRYPTION_SECRET;
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("DATABASE_URL is required for the consent backend");
	if (!secret && process.env.NODE_ENV === "production") {
		throw new Error("ENCRYPTION_SECRET is required to sign consent policy snapshots");
	}
	const signingKey = secret ? createHmac("sha256", secret).update("clipify:c15t:policy-snapshot:v1").digest("hex") : undefined;
	c15t = c15tInstance({
		database: { dialect: "postgres", url: databaseUrl },
		basePath: "/api/c15t",
		trustedOrigins: getConsentTrustedOrigins(),
		ipAddress: { tracking: false },
		openapi: { enabled: false },
		manifest: { appName: "Clipify", policyRules: consentPolicyRules },
		...(signingKey ? { policySnapshot: { signingKey } } : {}),
	});
	return c15t;
}
