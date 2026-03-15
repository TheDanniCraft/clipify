ALTER TABLE "userSettings" ADD COLUMN "marketing_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "userSettings" ADD COLUMN "marketing_opt_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "userSettings" ADD COLUMN "marketing_opt_in_source" varchar;--> statement-breakpoint
ALTER TABLE "userSettings" ADD COLUMN "usesend_product_updates_contact_id" varchar;