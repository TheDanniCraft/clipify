import "server-only";

import { createHmac } from "node:crypto";
import { c15tInstance } from "@c15t/backend";
import { drizzleAdapter } from "@c15t/backend/db/adapters/drizzle";
import { db } from "@/db/client";
import { consentPolicyPacks } from "./policy";

let c15t: ReturnType<typeof c15tInstance> | undefined;

export function getC15t() {
	if (c15t) return c15t;
	const secret = process.env.ENCRYPTION_SECRET;
	if (!secret && process.env.NODE_ENV === "production") {
		throw new Error("ENCRYPTION_SECRET is required to sign consent policy snapshots");
	}
	const signingKey = secret ? createHmac("sha256", secret).update("clipify:c15t:policy-snapshot:v1").digest("hex") : undefined;
	c15t = c15tInstance({
		appName: "Clipify",
		basePath: "/api/c15t",
		adapter: drizzleAdapter({ db, provider: "postgresql" }),
		tablePrefix: "c15t_",
		trustedOrigins: ["https://clipify.us", "https://www.clipify.us", "http://localhost:3000", ...(process.env.NEXT_PUBLIC_BASE_URL ? [process.env.NEXT_PUBLIC_BASE_URL] : [])],
		disableGeoLocation: true,
		ipAddress: { tracking: false },
		openapi: { enabled: false },
		policyPacks: consentPolicyPacks,
		...(signingKey ? { policySnapshot: { signingKey, onValidationFailure: "reject" as const } } : {}),
	});
	return c15t;
}
