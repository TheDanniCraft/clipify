import { relations, sql } from "drizzle-orm";
import { pgSchema, jsonb, text, bigint, timestamp, boolean, integer, index, uniqueIndex, check } from "drizzle-orm/pg-core";

export const authSchema = pgSchema("auth");

export const user = authSchema.table("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const session = authSchema.table(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		activeOrganizationId: text("active_organization_id"),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const account = authSchema.table(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId), uniqueIndex("account_provider_account_unique").on(table.providerId, table.accountId)],
);

export const verification = authSchema.table(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const passkey = authSchema.table(
	"passkey",
	{
		id: text("id").primaryKey(),
		name: text("name"),
		publicKey: text("public_key").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		credentialID: text("credential_id").notNull(),
		counter: integer("counter").notNull(),
		deviceType: text("device_type").notNull(),
		backedUp: boolean("backed_up").notNull(),
		transports: text("transports"),
		createdAt: timestamp("created_at"),
		aaguid: text("aaguid"),
	},
	(table) => [index("passkey_userId_idx").on(table.userId), uniqueIndex("passkey_credentialID_unique").on(table.credentialID)],
);

export const organization = authSchema.table("organization", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	logo: text("logo"),
	createdAt: timestamp("created_at").notNull(),
	metadata: text("metadata"),
});

export const organizationRole = authSchema.table(
	"organization_role",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		role: text("role").notNull(),
		permission: text("permission").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(table) => [
		index("organizationRole_organizationId_idx").on(table.organizationId),
		index("organizationRole_role_idx").on(table.role),
		uniqueIndex("organization_role_name_unique").on(table.organizationId, table.role),
		check("organization_role_slug_format", sql`${table.role} ~ '^[a-z][a-z0-9-]{0,63}$'`),
		check("organization_role_permission_delegable", sql`jsonb_typeof(${table.permission}::jsonb) = 'object' AND ${table.permission} !~* '(account:delete|ownership:transfer|agency:provision|account:force-purge|account:restore)'`),
	],
);

export const member = authSchema.table(
	"member",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text("role").default("member").notNull(),
		createdAt: timestamp("created_at").notNull(),
	},
	(table) => [index("member_organizationId_idx").on(table.organizationId), index("member_userId_idx").on(table.userId), uniqueIndex("member_organization_user_unique").on(table.organizationId, table.userId)],
);

export const invitation = authSchema.table(
	"invitation",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		role: text("role"),
		status: text("status").default("pending").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		inviterId: text("inviter_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("invitation_organizationId_idx").on(table.organizationId), index("invitation_email_idx").on(table.email)],
);

export const rateLimit = authSchema.table("rate_limit", {
	id: text("id").primaryKey(),
	key: text("key").notNull().unique(),
	count: integer("count").notNull(),
	lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	passkeys: many(passkey),
	members: many(member),
	invitations: many(invitation),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
	user: one(user, {
		fields: [passkey.userId],
		references: [user.id],
	}),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
	organizationRoles: many(organizationRole),
	members: many(member),
	invitations: many(invitation),
}));

export const organizationRoleRelations = relations(organizationRole, ({ one }) => ({
	organization: one(organization, {
		fields: [organizationRole.organizationId],
		references: [organization.id],
	}),
}));

export const memberRelations = relations(member, ({ one }) => ({
	organization: one(organization, {
		fields: [member.organizationId],
		references: [organization.id],
	}),
	user: one(user, {
		fields: [member.userId],
		references: [user.id],
	}),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
	organization: one(organization, {
		fields: [invitation.organizationId],
		references: [organization.id],
	}),
	user: one(user, {
		fields: [invitation.inviterId],
		references: [user.id],
	}),
}));

// Provider models generated by auth@1.7.6 with test/support/mcp/provider-config.ts.
export const jwks = authSchema.table("jwks", {
	id: text("id").primaryKey(),
	publicKey: text("public_key").notNull(),
	privateKey: text("private_key").notNull(),
	createdAt: timestamp("created_at").notNull(),
	expiresAt: timestamp("expires_at"),
	alg: text("alg"),
	crv: text("crv"),
});

export const oauthClient = authSchema.table(
	"oauth_client",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id").notNull().unique(),
		clientSecret: text("client_secret"),
		clientDiscoveryId: text("client_discovery_id"),
		disabled: boolean("disabled").default(false),
		skipConsent: boolean("skip_consent"),
		enableEndSession: boolean("enable_end_session"),
		subjectType: text("subject_type"),
		scopes: text("scopes").array(),
		clientCredentialsScopes: text("client_credentials_scopes").array().default([]),
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at"),
		updatedAt: timestamp("updated_at"),
		name: text("name"),
		uri: text("uri"),
		icon: text("icon"),
		contacts: text("contacts").array(),
		tos: text("tos"),
		policy: text("policy"),
		softwareId: text("software_id"),
		softwareVersion: text("software_version"),
		softwareStatement: text("software_statement"),
		redirectUris: text("redirect_uris").array().notNull(),
		postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
		backchannelLogoutUri: text("backchannel_logout_uri"),
		backchannelLogoutSessionRequired: boolean("backchannel_logout_session_required"),
		tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
		applicationType: text("application_type"),
		jwks: text("jwks"),
		jwksUri: text("jwks_uri"),
		grantTypes: text("grant_types").array(),
		responseTypes: text("response_types").array(),
		requirePKCE: boolean("require_pkce"),
		dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
		referenceId: text("reference_id"),
		metadata: jsonb("metadata"),
	},
	(table) => [index("oauthClient_userId_idx").on(table.userId)],
);

export const oauthResource = authSchema.table("oauth_resource", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull().unique(),
	name: text("name").notNull(),
	accessTokenTtl: integer("access_token_ttl"),
	refreshTokenTtl: integer("refresh_token_ttl"),
	signingAlgorithm: text("signing_algorithm"),
	signingKeyId: text("signing_key_id"),
	allowedScopes: text("allowed_scopes").array(),
	customClaims: jsonb("custom_claims"),
	dpopBoundAccessTokensRequired: boolean("dpop_bound_access_tokens_required").default(false),
	disabled: boolean("disabled").default(false),
	createdAt: timestamp("created_at"),
	updatedAt: timestamp("updated_at"),
	policyVersion: integer("policy_version").default(1),
	metadata: jsonb("metadata"),
});

export const oauthClientResource = authSchema.table(
	"oauth_client_resource",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		resourceId: text("resource_id")
			.notNull()
			.references(() => oauthResource.identifier, { onDelete: "cascade" }),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at"),
	},
	(table) => [uniqueIndex("oauthClientResource_clientId_resourceId_uidx").on(table.clientId, table.resourceId), index("oauthClientResource_clientId_idx").on(table.clientId), index("oauthClientResource_resourceId_idx").on(table.resourceId)],
);

export const oauthRefreshToken = authSchema.table(
	"oauth_refresh_token",
	{
		id: text("id").primaryKey(),
		token: text("token").notNull().unique(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		sessionId: text("session_id").references(() => session.id, {
			onDelete: "set null",
		}),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		referenceId: text("reference_id"),
		authorizationCodeId: text("authorization_code_id"),
		resources: text("resources").array(),
		requestedUserInfoClaims: text("requested_user_info_claims").array(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").notNull(),
		revoked: timestamp("revoked"),
		rotatedAt: timestamp("rotated_at"),
		rotationReplayResponse: text("rotation_replay_response"),
		rotationReplayExpiresAt: timestamp("rotation_replay_expires_at"),
		authTime: timestamp("auth_time"),
		confirmation: jsonb("confirmation"),
		scopes: text("scopes").array().notNull(),
	},
	(table) => [index("oauthRefreshToken_clientId_idx").on(table.clientId), index("oauthRefreshToken_sessionId_idx").on(table.sessionId), index("oauthRefreshToken_userId_idx").on(table.userId), index("oauthRefreshToken_authorizationCodeId_idx").on(table.authorizationCodeId)],
);

export const oauthAccessToken = authSchema.table(
	"oauth_access_token",
	{
		id: text("id").primaryKey(),
		token: text("token").notNull().unique(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		sessionId: text("session_id").references(() => session.id, {
			onDelete: "set null",
		}),
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
		referenceId: text("reference_id"),
		authorizationCodeId: text("authorization_code_id"),
		resources: text("resources").array(),
		requestedUserInfoClaims: text("requested_user_info_claims").array(),
		refreshId: text("refresh_id").references(() => oauthRefreshToken.id, {
			onDelete: "cascade",
		}),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").notNull(),
		revoked: timestamp("revoked"),
		confirmation: jsonb("confirmation"),
		scopes: text("scopes").array().notNull(),
	},
	(table) => [index("oauthAccessToken_clientId_idx").on(table.clientId), index("oauthAccessToken_sessionId_idx").on(table.sessionId), index("oauthAccessToken_userId_idx").on(table.userId), index("oauthAccessToken_authorizationCodeId_idx").on(table.authorizationCodeId), index("oauthAccessToken_refreshId_idx").on(table.refreshId)],
);

export const oauthConsent = authSchema.table(
	"oauth_consent",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
		referenceId: text("reference_id"),
		resources: text("resources").array(),
		requestedUserInfoClaims: text("requested_user_info_claims").array(),
		scopes: text("scopes").array().notNull(),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at").notNull(),
	},
	(table) => [index("oauthConsent_clientId_idx").on(table.clientId), index("oauthConsent_userId_idx").on(table.userId)],
);

export const oauthClientAssertion = authSchema.table("oauth_client_assertion", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at").notNull(),
});
