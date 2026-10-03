CREATE TYPE "public"."agency_billing_collection_method" AS ENUM('charge_automatically', 'send_invoice');--> statement-breakpoint
CREATE TYPE "public"."agency_billing_status" AS ENUM('pending', 'incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."agency_license_product" AS ENUM('creator_pro', 'runner');--> statement-breakpoint
CREATE TABLE "agency_billing_accounts" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"billing_email" varchar(320) NOT NULL,
	"status" "agency_billing_status" DEFAULT 'pending' NOT NULL,
	"collection_method" "agency_billing_collection_method" DEFAULT 'charge_automatically' NOT NULL,
	"days_until_due" integer,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"stripe_subscription_schedule_id" varchar,
	"creator_seat_price_id" varchar NOT NULL,
	"creator_seat_item_id" varchar,
	"creator_seat_minimum" integer NOT NULL,
	"creator_seat_quantity" integer NOT NULL,
	"pending_creator_seat_quantity" integer,
	"runner_seat_price_id" varchar,
	"runner_seat_item_id" varchar,
	"runner_seat_minimum" integer DEFAULT 0 NOT NULL,
	"runner_seat_quantity" integer DEFAULT 0 NOT NULL,
	"pending_runner_seat_quantity" integer,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"latest_stripe_event_created" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agency_billing_accounts_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "agency_billing_accounts_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id"),
	CONSTRAINT "agency_billing_accounts_stripe_subscription_schedule_id_unique" UNIQUE("stripe_subscription_schedule_id"),
	CONSTRAINT "agency_billing_creator_minimum_nonnegative" CHECK ("agency_billing_accounts"."creator_seat_minimum" >= 0),
	CONSTRAINT "agency_billing_creator_quantity_nonnegative" CHECK ("agency_billing_accounts"."creator_seat_quantity" >= 0),
	CONSTRAINT "agency_billing_runner_minimum_nonnegative" CHECK ("agency_billing_accounts"."runner_seat_minimum" >= 0),
	CONSTRAINT "agency_billing_runner_quantity_nonnegative" CHECK ("agency_billing_accounts"."runner_seat_quantity" >= 0),
	CONSTRAINT "agency_billing_invoice_terms" CHECK (("agency_billing_accounts"."collection_method" = 'send_invoice' AND "agency_billing_accounts"."days_until_due" BETWEEN 1 AND 90) OR ("agency_billing_accounts"."collection_method" = 'charge_automatically' AND "agency_billing_accounts"."days_until_due" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "editors" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "migration_anomalies" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "migration_checkpoints" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "migration_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tokens" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "editors" CASCADE;--> statement-breakpoint
DROP TABLE "migration_anomalies" CASCADE;--> statement-breakpoint
DROP TABLE "migration_checkpoints" CASCADE;--> statement-breakpoint
DROP TABLE "migration_runs" CASCADE;--> statement-breakpoint
DROP TABLE "tokens" CASCADE;--> statement-breakpoint
ALTER TABLE "agency_accounts" DROP CONSTRAINT "agency_accounts_seat_limit_nonnegative";--> statement-breakpoint
DROP INDEX "agency_license_allocations_live_creator_unique";--> statement-breakpoint
ALTER TABLE "agency_accounts" ADD COLUMN "runner_seat_limit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agency_license_allocations" ADD COLUMN "product" "agency_license_product" DEFAULT 'creator_pro' NOT NULL;--> statement-breakpoint
ALTER TABLE "agency_billing_accounts" ADD CONSTRAINT "agency_billing_accounts_organization_id_agency_accounts_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."agency_accounts"("organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agency_billing_status_idx" ON "agency_billing_accounts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "agency_license_allocations_live_creator_unique" ON "agency_license_allocations" USING btree ("creator_id","product") WHERE "agency_license_allocations"."status" IN ('active', 'removal_scheduled');--> statement-breakpoint
ALTER TABLE "agency_accounts" ADD CONSTRAINT "agency_accounts_seat_limit_nonnegative" CHECK ("agency_accounts"."creator_seat_limit" >= 0 AND "agency_accounts"."runner_seat_limit" >= 0);--> statement-breakpoint
DROP TYPE "public"."migration_anomaly_status";--> statement-breakpoint
DROP TYPE "public"."migration_checkpoint_status";--> statement-breakpoint
DROP TYPE "public"."migration_run_status";