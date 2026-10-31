"use server";

import { createIdentityToken } from "@c15t/node-sdk";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { validateAuth } from "./auth";
import { getConsentServerKey } from "@lib/consent/backend";
import { resolveUserEntitlements } from "@lib/entitlements";

/** Signed native consent identity proof; this action does not relay analytics events. */
export async function getAnalyticsIdentity() {
	const principal = await getVerifiedSessionPrincipal();
	const signingKey = getConsentServerKey("identity");
	if (!principal || !signingKey) return null;
	const user = await validateAuth();
	if (!user || user.adminView) return null;
	const entitlements = await resolveUserEntitlements(user);
	return {
		id: principal.authUserId,
		identityToken: await createIdentityToken({ externalId: principal.authUserId }, { signingKey, ttlSeconds: 300 }),
		plan: entitlements.effectivePlan,
		access_source: entitlements.source,
		is_paying: entitlements.isBillingPro,
	};
}
