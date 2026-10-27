CREATE TYPE "public"."runner_admission_state" AS ENUM('authorized', 'reserved', 'starting', 'active', 'draining', 'uncertain', 'stopped', 'failed_before_output');--> statement-breakpoint
CREATE TYPE "public"."runner_destination_provider" AS ENUM('youtube', 'twitch', 'custom');--> statement-breakpoint
CREATE TYPE "public"."runner_schedule_recurrence" AS ENUM('once', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."runner_watermark_corner" AS ENUM('top_left', 'top_right', 'bottom_left', 'bottom_right');--> statement-breakpoint
CREATE TYPE "public"."stream_control_mode" AS ENUM('manual', 'scheduled');--> statement-breakpoint
CREATE TABLE "runner_branding_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"kind" varchar(10) NOT NULL,
	"normalized_mime" varchar(20) NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runner_branding_assets_owner_id_unique" UNIQUE("owner_id","id"),
	CONSTRAINT "runner_branding_assets_kind_valid" CHECK ("runner_branding_assets"."kind" IN ('logo','background')),
	CONSTRAINT "runner_branding_assets_mime_valid" CHECK ("runner_branding_assets"."normalized_mime" IN ('image/png','image/jpeg','image/webp')),
	CONSTRAINT "runner_branding_assets_bounds_valid" CHECK ("runner_branding_assets"."size_bytes" > 0 AND "runner_branding_assets"."size_bytes" <= 2097152 AND octet_length("runner_branding_assets"."bytes") = "runner_branding_assets"."size_bytes" AND "runner_branding_assets"."width" > 0 AND "runner_branding_assets"."width" <= 4096 AND "runner_branding_assets"."height" > 0 AND "runner_branding_assets"."height" <= 4096 AND "runner_branding_assets"."width"::bigint * "runner_branding_assets"."height" <= 16000000)
);
--> statement-breakpoint
CREATE TABLE "runner_branding_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"runner_id" uuid NOT NULL,
	"watermark_corner" "runner_watermark_corner" DEFAULT 'bottom_right' NOT NULL,
	"pro_show_attribution" boolean DEFAULT false NOT NULL,
	"standby_background_color" varchar(7) DEFAULT '#000000' NOT NULL,
	"background_asset_id" uuid,
	"logo_asset_id" uuid,
	"message" varchar(160) DEFAULT '' NOT NULL,
	"show_next_broadcast_time" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runner_branding_profiles_revision_positive" CHECK ("runner_branding_profiles"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "runner_broadcast_admissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"runner_id" uuid,
	"session_id" uuid,
	"execution_generation" uuid NOT NULL,
	"command_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" varchar,
	"continuity_root_admission_id" uuid,
	"state" "runner_admission_state" DEFAULT 'reserved' NOT NULL,
	"stop_mode" text DEFAULT 'graceful' NOT NULL,
	"dispatched_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"last_observed_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"configuration_revision" integer NOT NULL,
	"benefits_at_start" jsonb NOT NULL,
	"target_ids_snapshot" uuid[],
	"encrypted_targets_snapshot" text,
	"output_states" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_end" timestamp with time zone,
	"transition_policy" jsonb DEFAULT '{"generatedStop":"finish_clip","liveStop":"immediate","noProgressMs":60000,"maxDrainMs":300000}'::jsonb NOT NULL,
	"terminal_reason" varchar,
	"revoked_at" timestamp with time zone,
	"terminal_credential_hash" text,
	"lease_id" uuid,
	"lease_expires_at" timestamp with time zone,
	"protocol_supports_lease" boolean DEFAULT false NOT NULL,
	"recovered_at" timestamp with time zone,
	CONSTRAINT "runner_admissions_owner_identity_unique" UNIQUE("owner_id","id"),
	CONSTRAINT "runner_admissions_continuity_not_self" CHECK ("runner_broadcast_admissions"."continuity_root_admission_id" is null or "runner_broadcast_admissions"."continuity_root_admission_id" <> "runner_broadcast_admissions"."id"),
	CONSTRAINT "runner_admissions_revision_positive" CHECK ("runner_broadcast_admissions"."configuration_revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "runner_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"name" varchar(80) NOT NULL,
	"provider" "runner_destination_provider" NOT NULL,
	"rtmp_url" text NOT NULL,
	"encrypted_stream_key" text,
	"connection_id" uuid,
	"provider_stream_id" varchar(128),
	"credential_revision" integer DEFAULT 1 NOT NULL,
	"configuration_revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runner_destinations_owner_identity" UNIQUE("owner_id","id"),
	CONSTRAINT "runner_destinations_name_length" CHECK (char_length(trim("runner_destinations"."name")) BETWEEN 1 AND 80),
	CONSTRAINT "runner_destinations_url_length" CHECK (char_length("runner_destinations"."rtmp_url") BETWEEN 1 AND 4096),
	CONSTRAINT "runner_destinations_revisions_positive" CHECK ("runner_destinations"."credential_revision" > 0 AND "runner_destinations"."configuration_revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "runner_provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"provider" "runner_destination_provider" NOT NULL,
	"channel_id" varchar(128) NOT NULL,
	"channel_name" varchar(120) NOT NULL,
	"encrypted_tokens" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runner_provider_connections_owner_channel" UNIQUE("owner_id","provider","channel_id"),
	CONSTRAINT "runner_provider_connections_owner_identity" UNIQUE("owner_id","id"),
	CONSTRAINT "runner_provider_connections_supported" CHECK ("runner_provider_connections"."provider" IN ('twitch','youtube'))
);
--> statement-breakpoint
CREATE TABLE "runner_provider_states" (
	"digest" varchar(64) PRIMARY KEY NOT NULL,
	"owner_id" varchar NOT NULL,
	"auth_user_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"provider" "runner_destination_provider" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runner_schedule_event_destinations" (
	"event_id" uuid NOT NULL,
	"owner_id" varchar NOT NULL,
	"destination_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "runner_schedule_event_destinations_event_id_destination_id_pk" PRIMARY KEY("event_id","destination_id"),
	CONSTRAINT "runner_schedule_event_destinations_position" CHECK ("runner_schedule_event_destinations"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "runner_schedule_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"runner_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"overlay_id" uuid NOT NULL,
	"title" varchar(80) NOT NULL,
	"set_stream_details" boolean DEFAULT false NOT NULL,
	"stream_details" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timezone" varchar(128) NOT NULL,
	"recurrence" "runner_schedule_recurrence" NOT NULL,
	"recurrence_anchor" varchar(80) NOT NULL,
	"weekday_anchors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excluded_dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"series_parent_id" uuid,
	"original_occurrence_date" varchar(10),
	"repeat_until_date" varchar(10),
	"local_start_date" varchar(10) NOT NULL,
	"local_end_date" varchar(10),
	"weekdays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"local_start_time" varchar(8) NOT NULL,
	"local_end_time" varchar(8) NOT NULL,
	"end_day_offset" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"configuration_revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runner_schedule_events_owner_identity" UNIQUE("owner_id","id"),
	CONSTRAINT "runner_schedule_events_title_bounds" CHECK (char_length(trim("runner_schedule_events"."title")) BETWEEN 1 AND 80),
	CONSTRAINT "runner_schedule_events_revision_positive" CHECK ("runner_schedule_events"."configuration_revision" > 0),
	CONSTRAINT "runner_schedule_events_offset_bounds" CHECK ("runner_schedule_events"."end_day_offset" BETWEEN 0 AND 7),
	CONSTRAINT "runner_schedule_events_recurrence_shape" CHECK (("runner_schedule_events"."recurrence"='once' AND "runner_schedule_events"."local_end_date" IS NOT NULL) OR ("runner_schedule_events"."recurrence"='weekly' AND jsonb_typeof("runner_schedule_events"."weekdays")='array' AND jsonb_array_length("runner_schedule_events"."weekdays") BETWEEN 1 AND 7))
);
--> statement-breakpoint
CREATE TABLE "stream_session_destinations" (
	"session_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"owner_id" varchar NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "stream_session_destinations_session_id_destination_id_pk" PRIMARY KEY("session_id","destination_id"),
	CONSTRAINT "stream_session_destinations_position_nonnegative" CHECK ("stream_session_destinations"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "agency_accounts" DROP CONSTRAINT "agency_accounts_seat_limit_nonnegative";--> statement-breakpoint
ALTER TABLE "agency_billing_accounts" DROP CONSTRAINT "agency_billing_runner_minimum_nonnegative";--> statement-breakpoint
ALTER TABLE "agency_billing_accounts" DROP CONSTRAINT "agency_billing_runner_quantity_nonnegative";--> statement-breakpoint
-- Preserve retired Runner enum values for existing grants, allocations and rollback compatibility.
ALTER TABLE "runners" ADD COLUMN "protocol_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "runners" ADD COLUMN "capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "runners" ADD COLUMN "last_acknowledged_config_revision" integer;--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD COLUMN "control_mode" "stream_control_mode" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD COLUMN "test_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD COLUMN "automation_paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD COLUMN "automation_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "runners" ADD CONSTRAINT "runners_owner_id_unique" UNIQUE("owner_id","id");--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD CONSTRAINT "stream_sessions_owner_identity" UNIQUE("owner_id","id");--> statement-breakpoint
ALTER TABLE "runner_branding_assets" ADD CONSTRAINT "runner_branding_assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_branding_profiles" ADD CONSTRAINT "runner_branding_profiles_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_branding_profiles" ADD CONSTRAINT "runner_branding_profiles_owner_id_background_asset_id_runner_branding_assets_owner_id_id_fk" FOREIGN KEY ("owner_id","background_asset_id") REFERENCES "public"."runner_branding_assets"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_branding_profiles" ADD CONSTRAINT "runner_branding_profiles_owner_id_logo_asset_id_runner_branding_assets_owner_id_id_fk" FOREIGN KEY ("owner_id","logo_asset_id") REFERENCES "public"."runner_branding_assets"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_branding_profiles" ADD CONSTRAINT "runner_branding_profiles_owner_id_runner_id_runners_owner_id_id_fk" FOREIGN KEY ("owner_id","runner_id") REFERENCES "public"."runners"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_broadcast_admissions" ADD CONSTRAINT "runner_broadcast_admissions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_broadcast_admissions" ADD CONSTRAINT "runner_broadcast_admissions_runner_id_runners_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."runners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_broadcast_admissions" ADD CONSTRAINT "runner_broadcast_admissions_session_id_stream_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."stream_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_broadcast_admissions" ADD CONSTRAINT "runner_admissions_continuity_owner_fk" FOREIGN KEY ("owner_id","continuity_root_admission_id") REFERENCES "public"."runner_broadcast_admissions"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_destinations" ADD CONSTRAINT "runner_destinations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_destinations" ADD CONSTRAINT "runner_destinations_owner_id_connection_id_runner_provider_connections_owner_id_id_fk" FOREIGN KEY ("owner_id","connection_id") REFERENCES "public"."runner_provider_connections"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_provider_connections" ADD CONSTRAINT "runner_provider_connections_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_provider_states" ADD CONSTRAINT "runner_provider_states_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_schedule_event_destinations" ADD CONSTRAINT "runner_schedule_event_destinations_owner_id_event_id_runner_schedule_events_owner_id_id_fk" FOREIGN KEY ("owner_id","event_id") REFERENCES "public"."runner_schedule_events"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_schedule_event_destinations" ADD CONSTRAINT "runner_schedule_event_destinations_owner_id_destination_id_runner_destinations_owner_id_id_fk" FOREIGN KEY ("owner_id","destination_id") REFERENCES "public"."runner_destinations"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_schedule_events" ADD CONSTRAINT "runner_schedule_events_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_schedule_events" ADD CONSTRAINT "runner_schedule_events_runner_id_runners_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."runners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_schedule_events" ADD CONSTRAINT "runner_schedule_events_overlay_id_overlays_id_fk" FOREIGN KEY ("overlay_id") REFERENCES "public"."overlays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_schedule_events" ADD CONSTRAINT "runner_schedule_events_owner_id_series_parent_id_runner_schedule_events_owner_id_id_fk" FOREIGN KEY ("owner_id","series_parent_id") REFERENCES "public"."runner_schedule_events"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_schedule_events" ADD CONSTRAINT "runner_schedule_events_owner_id_session_id_stream_sessions_owner_id_id_fk" FOREIGN KEY ("owner_id","session_id") REFERENCES "public"."stream_sessions"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_session_destinations" ADD CONSTRAINT "stream_session_destinations_owner_id_session_id_stream_sessions_owner_id_id_fk" FOREIGN KEY ("owner_id","session_id") REFERENCES "public"."stream_sessions"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_session_destinations" ADD CONSTRAINT "stream_session_destinations_owner_id_destination_id_runner_destinations_owner_id_id_fk" FOREIGN KEY ("owner_id","destination_id") REFERENCES "public"."runner_destinations"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "runner_branding_profiles_runner_unique" ON "runner_branding_profiles" USING btree ("runner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_admissions_generation_unique" ON "runner_broadcast_admissions" USING btree ("owner_id","execution_generation");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_admissions_open_session_unique" ON "runner_broadcast_admissions" USING btree ("session_id") WHERE "runner_broadcast_admissions"."state" not in ('authorized','stopped','failed_before_output') and "runner_broadcast_admissions"."continuity_root_admission_id" is null;--> statement-breakpoint
CREATE INDEX "runner_admissions_owner_state_idx" ON "runner_broadcast_admissions" USING btree ("owner_id","state");--> statement-breakpoint
CREATE INDEX "runner_destinations_owner_created" ON "runner_destinations" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "runner_provider_states_expiry" ON "runner_provider_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "runner_schedule_events_device" ON "runner_schedule_events" USING btree ("owner_id","runner_id");--> statement-breakpoint
ALTER TABLE "agency_accounts" DROP COLUMN "runner_seat_limit";--> statement-breakpoint
ALTER TABLE "agency_billing_accounts" DROP COLUMN "runner_seat_price_id";--> statement-breakpoint
ALTER TABLE "agency_billing_accounts" DROP COLUMN "runner_seat_item_id";--> statement-breakpoint
ALTER TABLE "agency_billing_accounts" DROP COLUMN "runner_seat_minimum";--> statement-breakpoint
ALTER TABLE "agency_billing_accounts" DROP COLUMN "runner_seat_quantity";--> statement-breakpoint
ALTER TABLE "agency_billing_accounts" DROP COLUMN "pending_runner_seat_quantity";--> statement-breakpoint
ALTER TABLE "agency_accounts" ADD CONSTRAINT "agency_accounts_seat_limit_nonnegative" CHECK ("agency_accounts"."creator_seat_limit" >= 0);--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD CONSTRAINT "stream_sessions_automation_revision_nonnegative" CHECK ("stream_sessions"."automation_revision" >= 0);--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD CONSTRAINT "stream_sessions_scheduled_clips_only" CHECK ("stream_sessions"."control_mode" <> 'scheduled' OR "stream_sessions"."mode" = '24/7');
