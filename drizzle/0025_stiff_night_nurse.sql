CREATE TABLE "mcp_connection_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"resource" text NOT NULL,
	"issuer" text NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"scopes" text[] NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "mcp_grant_generation_positive" CHECK ("mcp_connection_grants"."generation" > 0)
);
--> statement-breakpoint
CREATE TABLE "mcp_grant_creators" (
	"grant_id" uuid NOT NULL,
	"creator_id" varchar NOT NULL,
	"scopes" text[],
	"agency_organization_id" text,
	CONSTRAINT "mcp_grant_creators_grant_id_creator_id_pk" PRIMARY KEY("grant_id","creator_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_mutation_retries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" uuid NOT NULL,
	"grant_generation" integer NOT NULL,
	"auth_user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"creator_id" varchar NOT NULL,
	"tool_name" varchar(128) NOT NULL,
	"retry_key" varchar(128) NOT NULL,
	"input_digest" varchar(64) NOT NULL,
	"safe_response" jsonb NOT NULL,
	"resource_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "mcp_retry_generation_positive" CHECK ("mcp_mutation_retries"."grant_generation" > 0),
	CONSTRAINT "mcp_retry_key_bounds" CHECK (length("mcp_mutation_retries"."retry_key") BETWEEN 1 AND 128),
	CONSTRAINT "mcp_retry_digest_format" CHECK ("mcp_mutation_retries"."input_digest" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "mcp_retry_minimum_retention" CHECK ("mcp_mutation_retries"."expires_at" >= "mcp_mutation_retries"."created_at" + interval '24 hours'),
	CONSTRAINT "mcp_retry_safe_response_object" CHECK (jsonb_typeof("mcp_mutation_retries"."safe_response") = 'object')
);
--> statement-breakpoint
CREATE TABLE "overlay_effect_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"overlay_id" uuid NOT NULL,
	"creator_id" varchar NOT NULL,
	"reward_id" varchar(255) NOT NULL,
	"configuration_revision" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_by" uuid,
	"claim_expires_at" timestamp with time zone,
	"last_error" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "overlay_effect_revision_positive" CHECK ("overlay_effect_jobs"."configuration_revision" > 0),
	CONSTRAINT "overlay_effect_attempts_nonnegative" CHECK ("overlay_effect_jobs"."attempts" >= 0),
	CONSTRAINT "overlay_effect_status_valid" CHECK ("overlay_effect_jobs"."status" IN ('pending','claimed','retry','done','obsolete'))
);
--> statement-breakpoint
CREATE TABLE "auth"."jwks" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"alg" text,
	"crv" text
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_access_token" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"client_id" text NOT NULL,
	"session_id" text,
	"user_id" text,
	"reference_id" text,
	"authorization_code_id" text,
	"resources" text[],
	"requested_user_info_claims" text[],
	"refresh_id" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"revoked" timestamp,
	"confirmation" jsonb,
	"scopes" text[] NOT NULL,
	CONSTRAINT "oauth_access_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_client" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text,
	"client_discovery_id" text,
	"disabled" boolean DEFAULT false,
	"skip_consent" boolean,
	"enable_end_session" boolean,
	"subject_type" text,
	"scopes" text[],
	"client_credentials_scopes" text[] DEFAULT '{}',
	"user_id" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	"name" text,
	"uri" text,
	"icon" text,
	"contacts" text[],
	"tos" text,
	"policy" text,
	"software_id" text,
	"software_version" text,
	"software_statement" text,
	"redirect_uris" text[] NOT NULL,
	"post_logout_redirect_uris" text[],
	"backchannel_logout_uri" text,
	"backchannel_logout_session_required" boolean,
	"token_endpoint_auth_method" text,
	"application_type" text,
	"jwks" text,
	"jwks_uri" text,
	"grant_types" text[],
	"response_types" text[],
	"require_pkce" boolean,
	"dpop_bound_access_tokens" boolean DEFAULT false,
	"reference_id" text,
	"metadata" jsonb,
	CONSTRAINT "oauth_client_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_client_assertion" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_client_resource" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_consent" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text,
	"reference_id" text,
	"resources" text[],
	"requested_user_info_claims" text[],
	"scopes" text[] NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_refresh_token" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"client_id" text NOT NULL,
	"session_id" text,
	"user_id" text NOT NULL,
	"reference_id" text,
	"authorization_code_id" text,
	"resources" text[],
	"requested_user_info_claims" text[],
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"revoked" timestamp,
	"rotated_at" timestamp,
	"rotation_replay_response" text,
	"rotation_replay_expires_at" timestamp,
	"auth_time" timestamp,
	"confirmation" jsonb,
	"scopes" text[] NOT NULL,
	CONSTRAINT "oauth_refresh_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_resource" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"name" text NOT NULL,
	"access_token_ttl" integer,
	"refresh_token_ttl" integer,
	"signing_algorithm" text,
	"signing_key_id" text,
	"allowed_scopes" text[],
	"custom_claims" jsonb,
	"dpop_bound_access_tokens_required" boolean DEFAULT false,
	"disabled" boolean DEFAULT false,
	"created_at" timestamp,
	"updated_at" timestamp,
	"policy_version" integer DEFAULT 1,
	"metadata" jsonb,
	CONSTRAINT "oauth_resource_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
DROP INDEX "creator_accounts_creator_unique";--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "configuration_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "configuration_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "configuration_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "runners" ADD COLUMN "configuration_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "userSettings" ADD COLUMN "configuration_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD COLUMN "configuration_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_connection_grants" ADD CONSTRAINT "mcp_connection_grants_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_grant_creators" ADD CONSTRAINT "mcp_grant_creators_grant_id_mcp_connection_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."mcp_connection_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_grant_creators" ADD CONSTRAINT "mcp_grant_creators_creator_id_creator_accounts_creator_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_accounts"("creator_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_grant_creators" ADD CONSTRAINT "mcp_grant_creators_agency_organization_id_organization_id_fk" FOREIGN KEY ("agency_organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_mutation_retries" ADD CONSTRAINT "mcp_mutation_retries_grant_id_mcp_connection_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."mcp_connection_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_mutation_retries" ADD CONSTRAINT "mcp_mutation_retries_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_mutation_retries" ADD CONSTRAINT "mcp_mutation_retries_creator_id_creator_accounts_creator_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_accounts"("creator_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overlay_effect_jobs" ADD CONSTRAINT "overlay_effect_jobs_overlay_id_overlays_id_fk" FOREIGN KEY ("overlay_id") REFERENCES "public"."overlays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overlay_effect_jobs" ADD CONSTRAINT "overlay_effect_jobs_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."oauth_access_token" ADD CONSTRAINT "oauth_access_token_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."oauth_access_token" ADD CONSTRAINT "oauth_access_token_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "auth"."session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."oauth_access_token" ADD CONSTRAINT "oauth_access_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."oauth_access_token" ADD CONSTRAINT "oauth_access_token_refresh_id_oauth_refresh_token_id_fk" FOREIGN KEY ("refresh_id") REFERENCES "auth"."oauth_refresh_token"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."oauth_client" ADD CONSTRAINT "oauth_client_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."oauth_client_resource" ADD CONSTRAINT "oauth_client_resource_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."oauth_client_resource" ADD CONSTRAINT "oauth_client_resource_resource_id_oauth_resource_identifier_fk" FOREIGN KEY ("resource_id") REFERENCES "auth"."oauth_resource"("identifier") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."oauth_consent" ADD CONSTRAINT "oauth_consent_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."oauth_consent" ADD CONSTRAINT "oauth_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "auth"."session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_grants_actor_client_idx" ON "mcp_connection_grants" USING btree ("auth_user_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_retries_context_key_unique" ON "mcp_mutation_retries" USING btree ("grant_id","grant_generation","auth_user_id","client_id","creator_id","tool_name","retry_key");--> statement-breakpoint
CREATE INDEX "mcp_retries_expiry_idx" ON "mcp_mutation_retries" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "overlay_effect_revision_unique" ON "overlay_effect_jobs" USING btree ("overlay_id","configuration_revision");--> statement-breakpoint
CREATE INDEX "overlay_effect_due_idx" ON "overlay_effect_jobs" USING btree ("status","scheduled_at","claim_expires_at");--> statement-breakpoint
CREATE INDEX "oauthAccessToken_clientId_idx" ON "auth"."oauth_access_token" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauthAccessToken_sessionId_idx" ON "auth"."oauth_access_token" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "oauthAccessToken_userId_idx" ON "auth"."oauth_access_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauthAccessToken_authorizationCodeId_idx" ON "auth"."oauth_access_token" USING btree ("authorization_code_id");--> statement-breakpoint
CREATE INDEX "oauthAccessToken_refreshId_idx" ON "auth"."oauth_access_token" USING btree ("refresh_id");--> statement-breakpoint
CREATE INDEX "oauthClient_userId_idx" ON "auth"."oauth_client" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauthClientResource_clientId_resourceId_uidx" ON "auth"."oauth_client_resource" USING btree ("client_id","resource_id");--> statement-breakpoint
CREATE INDEX "oauthClientResource_clientId_idx" ON "auth"."oauth_client_resource" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauthClientResource_resourceId_idx" ON "auth"."oauth_client_resource" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "oauthConsent_clientId_idx" ON "auth"."oauth_consent" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauthConsent_userId_idx" ON "auth"."oauth_consent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauthRefreshToken_clientId_idx" ON "auth"."oauth_refresh_token" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauthRefreshToken_sessionId_idx" ON "auth"."oauth_refresh_token" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "oauthRefreshToken_userId_idx" ON "auth"."oauth_refresh_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauthRefreshToken_authorizationCodeId_idx" ON "auth"."oauth_refresh_token" USING btree ("authorization_code_id");--> statement-breakpoint
ALTER TABLE "creator_accounts" ADD CONSTRAINT "creator_accounts_creator_unique" UNIQUE("creator_id");--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_revision_positive" CHECK ("galleries"."configuration_revision" > 0);--> statement-breakpoint
ALTER TABLE "overlays" ADD CONSTRAINT "overlays_revision_positive" CHECK ("overlays"."configuration_revision" > 0);--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_revision_positive" CHECK ("playlists"."configuration_revision" > 0);--> statement-breakpoint
ALTER TABLE "runners" ADD CONSTRAINT "runners_revision_positive" CHECK ("runners"."configuration_revision" > 0);--> statement-breakpoint
ALTER TABLE "userSettings" ADD CONSTRAINT "creator_page_revision_positive" CHECK ("userSettings"."configuration_revision" > 0);--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD CONSTRAINT "stream_sessions_revision_positive" CHECK ("stream_sessions"."configuration_revision" > 0);