CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE TYPE "public"."account_deletion_choice" AS ENUM('paid_through', 'immediate');--> statement-breakpoint
CREATE TYPE "public"."account_deletion_status" AS ENUM('scheduled', 'suspended', 'recovered', 'purge_eligible', 'purged', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."agency_account_status" AS ENUM('provisioned', 'owner_invited', 'active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "public"."agency_creator_link_status" AS ENUM('proposed', 'accepted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."agency_license_allocation_status" AS ENUM('active', 'removal_scheduled', 'ended', 'released_by_deletion');--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('success', 'denied', 'error');--> statement-breakpoint
CREATE TYPE "public"."creator_account_status" AS ENUM('active', 'suspension_scheduled', 'suspended', 'purge_eligible');--> statement-breakpoint
CREATE TYPE "public"."creator_identity_link_source" AS ENUM('migration', 'twitch_onboarding', 'admin_repair');--> statement-breakpoint
CREATE TYPE "public"."migration_anomaly_status" AS ENUM('open', 'resolved', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."migration_checkpoint_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."migration_run_status" AS ENUM('created', 'preflighted', 'backup_verified', 'migrating', 'validated', 'switched', 'reopened', 'contracted', 'maintenance_blocked');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'claimed', 'sent', 'retry', 'dead');--> statement-breakpoint
CREATE TYPE "public"."rate_limit_signal" AS ENUM('identity', 'network');--> statement-breakpoint
CREATE TABLE "account_deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"choice" "account_deletion_choice" NOT NULL,
	"status" "account_deletion_status" NOT NULL,
	"requested_by" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"suspension_at" timestamp with time zone NOT NULL,
	"suspended_at" timestamp with time zone,
	"purge_eligible_at" timestamp with time zone,
	"recovered_by" text,
	"recovered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	"stripe_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_deletion_requests_version_positive" CHECK ("account_deletion_requests"."version" > 0),
	CONSTRAINT "account_deletion_requests_purge_after_suspend" CHECK ("account_deletion_requests"."purge_eligible_at" IS NULL OR ("account_deletion_requests"."suspended_at" IS NOT NULL AND "account_deletion_requests"."purge_eligible_at" >= "account_deletion_requests"."suspended_at")),
	CONSTRAINT "account_deletion_requests_snapshot_object" CHECK (jsonb_typeof("account_deletion_requests"."stripe_snapshot") = 'object'),
	CONSTRAINT "account_deletion_requests_snapshot_redacted" CHECK ("account_deletion_requests"."stripe_snapshot"::text !~* '"[^"]*(secret|token|password|credential|authorization|cookie|otp|code)[^"]*"[[:space:]]*:')
);
--> statement-breakpoint
CREATE TABLE "agency_accounts" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"status" "agency_account_status" DEFAULT 'provisioned' NOT NULL,
	"commercial_reference" varchar(160),
	"creator_seat_limit" integer DEFAULT 0 NOT NULL,
	"provisioned_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agency_accounts_seat_limit_nonnegative" CHECK ("agency_accounts"."creator_seat_limit" >= 0),
	CONSTRAINT "agency_accounts_commercial_reference_non_secret" CHECK ("agency_accounts"."commercial_reference" IS NULL OR "agency_accounts"."commercial_reference" !~* '(bearer[[:space:]]+|token=|password=|secret=|credential=)')
);
--> statement-breakpoint
CREATE TABLE "agency_creator_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_organization_id" text NOT NULL,
	"creator_organization_id" text NOT NULL,
	"status" "agency_creator_link_status" DEFAULT 'proposed' NOT NULL,
	"permission_ceiling" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposed_by" text,
	"proposed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_by" text,
	"accepted_at" timestamp with time zone,
	"revoked_by" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agency_creator_links_distinct_accounts" CHECK ("agency_creator_links"."agency_organization_id" <> "agency_creator_links"."creator_organization_id"),
	CONSTRAINT "agency_creator_links_ceiling_array" CHECK (jsonb_typeof("agency_creator_links"."permission_ceiling") = 'array'),
	CONSTRAINT "agency_creator_links_acceptance_state" CHECK (("agency_creator_links"."status" <> 'accepted') OR ("agency_creator_links"."accepted_by" IS NOT NULL AND "agency_creator_links"."accepted_at" IS NOT NULL)),
	CONSTRAINT "agency_creator_links_revocation_state" CHECK (("agency_creator_links"."status" <> 'revoked') OR ("agency_creator_links"."revoked_by" IS NOT NULL AND "agency_creator_links"."revoked_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "agency_license_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"creator_id" varchar NOT NULL,
	"status" "agency_license_allocation_status" DEFAULT 'active' NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"removal_requested_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"source_reference" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agency_license_allocations_grace_state" CHECK (("agency_license_allocations"."status" <> 'removal_scheduled') OR ("agency_license_allocations"."removal_requested_at" IS NOT NULL AND "agency_license_allocations"."ends_at" IS NOT NULL AND "agency_license_allocations"."ends_at" > "agency_license_allocations"."removal_requested_at")),
	CONSTRAINT "agency_license_allocations_source_non_secret" CHECK ("agency_license_allocations"."source_reference" !~* '(bearer[[:space:]]+|token=|password=|secret=|credential=)')
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" text,
	"actor_session_id" text,
	"account_organization_id" text,
	"target_type" varchar(80) NOT NULL,
	"target_id" text,
	"action" varchar(120) NOT NULL,
	"outcome" "audit_outcome" NOT NULL,
	"reason" varchar(160),
	"correlation_id" varchar(120) NOT NULL,
	"ip_prefix" varchar(80),
	"user_agent_family" varchar(120),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "audit_events_metadata_object" CHECK (jsonb_typeof("audit_events"."metadata") = 'object'),
	CONSTRAINT "audit_events_metadata_size" CHECK (octet_length("audit_events"."metadata"::text) <= 16384),
	CONSTRAINT "audit_events_metadata_secret_redacted" CHECK ("audit_events"."metadata"::text !~* '"[^"]*(secret|token|password|credential|authorization|cookie|otp|code)[^"]*"[[:space:]]*:')
);
--> statement-breakpoint
CREATE TABLE "creator_accounts" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"creator_id" varchar NOT NULL,
	"status" "creator_account_status" DEFAULT 'active' NOT NULL,
	"suspension_at" timestamp with time zone,
	"purge_eligible_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_identity_links" (
	"creator_id" varchar PRIMARY KEY NOT NULL,
	"auth_user_id" text NOT NULL,
	"source" "creator_identity_link_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_anomalies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"source_hash" varchar(128) NOT NULL,
	"category" varchar(80) NOT NULL,
	"blocking" boolean DEFAULT true NOT NULL,
	"status" "migration_anomaly_status" DEFAULT 'open' NOT NULL,
	"resolution" varchar(240),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "migration_anomaly_source_hash_format" CHECK ("migration_anomalies"."source_hash" ~ '^[0-9a-f]{64,128}$'),
	CONSTRAINT "migration_anomaly_resolution_redacted" CHECK ("migration_anomalies"."resolution" IS NULL OR "migration_anomalies"."resolution" !~* '(bearer[[:space:]]+|token=|password=|secret=|credential=)')
);
--> statement-breakpoint
CREATE TABLE "migration_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"phase" varchar(80) NOT NULL,
	"cursor" varchar(200) NOT NULL,
	"checksum" varchar(128) NOT NULL,
	"status" "migration_checkpoint_status" DEFAULT 'pending' NOT NULL,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "migration_checkpoint_count_nonnegative" CHECK ("migration_checkpoints"."processed_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "migration_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "migration_run_status" DEFAULT 'created' NOT NULL,
	"source_fingerprint" varchar(128) NOT NULL,
	"manifest_checksum" varchar(128) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"authority_organization_id" text,
	"template_version" varchar(40) NOT NULL,
	"locale" varchar(20) DEFAULT 'en' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claimed_by" varchar(120),
	"claim_expires_at" timestamp with time zone,
	"provider_message_id" varchar(200),
	"last_error" varchar(500),
	"dedupe_key" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_outbox_attempts_nonnegative" CHECK ("notification_outbox"."attempts" >= 0),
	CONSTRAINT "notification_outbox_payload_object" CHECK (jsonb_typeof("notification_outbox"."payload") = 'object'),
	CONSTRAINT "notification_outbox_payload_secret_redacted" CHECK ("notification_outbox"."payload"::text !~* '"[^"]*(secret|token|password|credential|authorization|cookie|otp|code)[^"]*"[[:space:]]*:')
);
--> statement-breakpoint
CREATE TABLE "rate_limit_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar(120) NOT NULL,
	"signal_type" "rate_limit_signal" NOT NULL,
	"signal_hash" varchar(64) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_counter_nonnegative" CHECK ("rate_limit_counters"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "auth"."organization_role" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "organization_role_slug_format" CHECK ("auth"."organization_role"."role" ~ '^[a-z][a-z0-9-]{0,63}$'),
	CONSTRAINT "organization_role_permission_delegable" CHECK (jsonb_typeof("auth"."organization_role"."permission"::jsonb) = 'object' AND "auth"."organization_role"."permission" !~* '(account:delete|ownership:transfer|agency:provision|account:force-purge|account:restore)')
);
--> statement-breakpoint
CREATE TABLE "auth"."passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "auth"."rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD COLUMN "latest_stripe_event_created" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_recovered_by_user_id_fk" FOREIGN KEY ("recovered_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_accounts" ADD CONSTRAINT "agency_accounts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_accounts" ADD CONSTRAINT "agency_accounts_provisioned_by_user_id_fk" FOREIGN KEY ("provisioned_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_creator_links" ADD CONSTRAINT "agency_creator_links_agency_organization_id_organization_id_fk" FOREIGN KEY ("agency_organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_creator_links" ADD CONSTRAINT "agency_creator_links_creator_organization_id_organization_id_fk" FOREIGN KEY ("creator_organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_creator_links" ADD CONSTRAINT "agency_creator_links_proposed_by_user_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_creator_links" ADD CONSTRAINT "agency_creator_links_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_creator_links" ADD CONSTRAINT "agency_creator_links_revoked_by_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_license_allocations" ADD CONSTRAINT "agency_license_allocations_link_id_agency_creator_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."agency_creator_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_license_allocations" ADD CONSTRAINT "agency_license_allocations_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_account_organization_id_organization_id_fk" FOREIGN KEY ("account_organization_id") REFERENCES "auth"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_accounts" ADD CONSTRAINT "creator_accounts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_accounts" ADD CONSTRAINT "creator_accounts_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_identity_links" ADD CONSTRAINT "creator_identity_links_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_identity_links" ADD CONSTRAINT "creator_identity_links_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_anomalies" ADD CONSTRAINT "migration_anomalies_run_id_migration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."migration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_checkpoints" ADD CONSTRAINT "migration_checkpoints_run_id_migration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."migration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_authority_organization_id_organization_id_fk" FOREIGN KEY ("authority_organization_id") REFERENCES "auth"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."organization_role" ADD CONSTRAINT "organization_role_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_requests_nonterminal_unique" ON "account_deletion_requests" USING btree ("organization_id") WHERE "account_deletion_requests"."status" IN ('scheduled', 'suspended', 'purge_eligible');--> statement-breakpoint
CREATE INDEX "account_deletion_requests_status_time_idx" ON "account_deletion_requests" USING btree ("status","suspension_at","purge_eligible_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agency_creator_links_live_pair_unique" ON "agency_creator_links" USING btree ("agency_organization_id","creator_organization_id") WHERE "agency_creator_links"."status" <> 'revoked';--> statement-breakpoint
CREATE INDEX "agency_creator_links_creator_status_idx" ON "agency_creator_links" USING btree ("creator_organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "agency_license_allocations_live_creator_unique" ON "agency_license_allocations" USING btree ("creator_id") WHERE "agency_license_allocations"."status" IN ('active', 'removal_scheduled');--> statement-breakpoint
CREATE INDEX "agency_license_allocations_link_status_idx" ON "agency_license_allocations" USING btree ("link_id","status");--> statement-breakpoint
CREATE INDEX "agency_license_allocations_due_idx" ON "agency_license_allocations" USING btree ("status","ends_at");--> statement-breakpoint
CREATE INDEX "audit_events_account_time_idx" ON "audit_events" USING btree ("account_organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_time_idx" ON "audit_events" USING btree ("actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_correlation_idx" ON "audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_accounts_creator_unique" ON "creator_accounts" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "creator_identity_links_auth_user_idx" ON "creator_identity_links" USING btree ("auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "migration_anomalies_run_source_category_unique" ON "migration_anomalies" USING btree ("run_id","source_hash","category");--> statement-breakpoint
CREATE UNIQUE INDEX "migration_checkpoints_run_phase_cursor_unique" ON "migration_checkpoints" USING btree ("run_id","phase","cursor");--> statement-breakpoint
CREATE UNIQUE INDEX "migration_runs_source_manifest_unique" ON "migration_runs" USING btree ("source_fingerprint","manifest_checksum");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_outbox_dedupe_unique" ON "notification_outbox" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "notification_outbox_claim_idx" ON "notification_outbox" USING btree ("status","scheduled_at","claim_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_counter_signal_unique" ON "rate_limit_counters" USING btree ("action","signal_type","signal_hash");--> statement-breakpoint
CREATE INDEX "rate_limit_counter_expiry_idx" ON "rate_limit_counters" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "auth"."account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "auth"."account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "auth"."invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "auth"."invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "auth"."member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "auth"."member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_organization_user_unique" ON "auth"."member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organizationRole_organizationId_idx" ON "auth"."organization_role" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organizationRole_role_idx" ON "auth"."organization_role" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_role_name_unique" ON "auth"."organization_role" USING btree ("organization_id","role");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "auth"."passkey" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passkey_credentialID_unique" ON "auth"."passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "auth"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "auth"."verification" USING btree ("identifier");