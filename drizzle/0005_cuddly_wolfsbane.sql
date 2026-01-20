ALTER TABLE "tokens" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "modQueue" ADD COLUMN "queued_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "last_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "min_clip_duration" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "max_clip_duration" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "blacklist_words" varchar[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "clipQueue" ADD COLUMN "queued_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login" timestamp with time zone;