"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { passkeyClient } from "@better-auth/passkey/client";
import { betterAuthOrganizationRoles, clipifyAccessControl } from "./organization-access";

export const authClient = createAuthClient({
	plugins: [
		oauthProviderClient(),
		emailOTPClient(),
		passkeyClient(),
		organizationClient({
			ac: clipifyAccessControl,
			roles: betterAuthOrganizationRoles,
			dynamicAccessControl: { enabled: true },
		}),
	],
});
