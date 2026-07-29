CREATE TYPE "public"."runner_status" AS ENUM('online', 'offline');--> statement-breakpoint
CREATE TYPE "public"."stream_mode" AS ENUM('24/7', 'failsafe');--> statement-breakpoint
CREATE TYPE "public"."stream_state" AS ENUM('stopped', 'starting', 'running', 'error');--> statement-breakpoint
ALTER TYPE "public"."entitlement" ADD VALUE 'runner_access';--> statement-breakpoint
ALTER TYPE "public"."entitlement_grant_source" ADD VALUE 'billing';--> statement-breakpoint
ALTER TYPE "public"."entitlement_grant_source" ADD VALUE 'managed_contract';--> statement-breakpoint
CREATE TABLE "billing_subscription_items" (
	"id" varchar PRIMARY KEY NOT NULL,
	"subscription_id" varchar NOT NULL,
	"product_key" varchar NOT NULL,
	"stripe_product_id" varchar NOT NULL,
	"stripe_price_id" varchar NOT NULL,
	"unit_amount" integer,
	"currency" varchar NOT NULL,
	"billing_interval" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"stripe_customer_id" varchar NOT NULL,
	"status" varchar NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"event_type" varchar NOT NULL,
	"status" varchar DEFAULT 'processing' NOT NULL,
	"last_error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processing_started_at" timestamp with time zone,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "runner_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_code" varchar NOT NULL,
	"user_code" varchar NOT NULL,
	"api_base" varchar NOT NULL,
	"hostname" varchar,
	"os_info" varchar,
	"version" varchar,
	"owner_id" varchar,
	"runner_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runner_enrollments_device_code_unique" UNIQUE("device_code"),
	CONSTRAINT "runner_enrollments_user_code_unique" UNIQUE("user_code")
);
--> statement-breakpoint
CREATE TABLE "runners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"token" varchar NOT NULL,
	"status" "runner_status" DEFAULT 'offline' NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"os_info" varchar,
	"version" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runners_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "stream_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"runner_id" uuid,
	"overlay_id" uuid NOT NULL,
	"mode" "stream_mode" NOT NULL,
	"encrypted_stream_key" text,
	"rtmp_url" varchar DEFAULT 'rtmp://live.twitch.tv/app' NOT NULL,
	"desired_state" "stream_state" DEFAULT 'stopped' NOT NULL,
	"actual_state" "stream_state" DEFAULT 'stopped' NOT NULL,
	"resolution" varchar DEFAULT '1080p' NOT NULL,
	"fps" integer DEFAULT 60 NOT NULL,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entitlement_grants" ADD COLUMN "external_reference" varchar;--> statement-breakpoint
ALTER TABLE "entitlement_grants" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_subscription_items" ADD CONSTRAINT "billing_subscription_items_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_enrollments" ADD CONSTRAINT "runner_enrollments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_enrollments" ADD CONSTRAINT "runner_enrollments_runner_id_runners_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."runners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runners" ADD CONSTRAINT "runners_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD CONSTRAINT "stream_sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD CONSTRAINT "stream_sessions_runner_id_runners_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."runners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD CONSTRAINT "stream_sessions_overlay_id_overlays_id_fk" FOREIGN KEY ("overlay_id") REFERENCES "public"."overlays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscription_product_unique" ON "billing_subscription_items" USING btree ("subscription_id","product_key");--> statement-breakpoint
CREATE INDEX "billing_subscription_items_product_idx" ON "billing_subscription_items" USING btree ("product_key");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_user_idx" ON "billing_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_customer_status_idx" ON "billing_subscriptions" USING btree ("stripe_customer_id","status");--> statement-breakpoint
CREATE INDEX "runner_enrollments_device_code_idx" ON "runner_enrollments" USING btree ("device_code");--> statement-breakpoint
CREATE INDEX "runner_enrollments_user_code_idx" ON "runner_enrollments" USING btree ("user_code");--> statement-breakpoint
CREATE INDEX "runner_enrollments_expires_at_idx" ON "runner_enrollments" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_grants_external_ref_unique" ON "entitlement_grants" USING btree ("source","external_reference","entitlement");