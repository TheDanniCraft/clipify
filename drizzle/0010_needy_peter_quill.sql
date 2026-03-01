CREATE TYPE "public"."entitlement" AS ENUM('pro_access');--> statement-breakpoint
CREATE TYPE "public"."entitlement_grant_source" AS ENUM('system', 'reverse_trial', 'promo', 'support');--> statement-breakpoint
CREATE TYPE "public"."overlay_type" AS ENUM('1', '7', '30', '90', '180', '365', 'Featured', 'All', 'Queue');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."status_options" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."twitch_cache_type" AS ENUM('avatar', 'game', 'clip', 'user');--> statement-breakpoint
CREATE TABLE "entitlement_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"entitlement" "entitlement" DEFAULT 'pro_access' NOT NULL,
	"source" "entitlement_grant_source" DEFAULT 'system' NOT NULL,
	"reason" varchar,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "overlays" ALTER COLUMN "status" SET DATA TYPE "public"."status_options" USING "status"::"public"."status_options";--> statement-breakpoint
ALTER TABLE "overlays" ALTER COLUMN "type" SET DATA TYPE "public"."overlay_type" USING "type"::"public"."overlay_type";--> statement-breakpoint
ALTER TABLE "twitchCache" ALTER COLUMN "type" SET DATA TYPE "public"."twitch_cache_type" USING "type"::"public"."twitch_cache_type";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "plan" SET DATA TYPE "public"."plan" USING "plan"::"public"."plan";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_entitlement_reconciled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entitlement_grants_user_lookup_idx" ON "entitlement_grants" USING btree ("user_id","entitlement","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "entitlement_grants_global_lookup_idx" ON "entitlement_grants" USING btree ("entitlement","starts_at","ends_at");