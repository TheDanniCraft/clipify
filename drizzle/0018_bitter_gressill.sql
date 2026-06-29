ALTER TYPE "public"."entitlement_grant_source" ADD VALUE 'partner' BEFORE 'support';--> statement-breakpoint
ALTER TABLE "userSettings" ADD COLUMN "show_in_community" boolean DEFAULT false NOT NULL;