CREATE TYPE "public"."gallery_layout" AS ENUM('grid', 'list', 'carousel');--> statement-breakpoint
CREATE TYPE "public"."gallery_live_sort" AS ENUM('newest', 'most_viewed', 'stable_random');--> statement-breakpoint
CREATE TYPE "public"."gallery_source" AS ENUM('curated', 'live');--> statement-breakpoint
CREATE TYPE "public"."gallery_theme" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TYPE "public"."gallery_time_window" AS ENUM('today', '7d', '30d', 'all', 'custom');--> statement-breakpoint
CREATE TABLE "galleries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"source" "gallery_source" DEFAULT 'curated' NOT NULL,
	"playlist_id" uuid,
	"layout" "gallery_layout" DEFAULT 'grid' NOT NULL,
	"grid_auto" boolean DEFAULT true NOT NULL,
	"grid_mobile_columns" integer DEFAULT 1 NOT NULL,
	"grid_tablet_columns" integer DEFAULT 3 NOT NULL,
	"grid_desktop_columns" integer DEFAULT 4 NOT NULL,
	"list_density" varchar DEFAULT 'comfortable' NOT NULL,
	"carousel_mobile_cards" integer DEFAULT 1 NOT NULL,
	"carousel_tablet_cards" integer DEFAULT 2 NOT NULL,
	"carousel_desktop_cards" integer DEFAULT 3 NOT NULL,
	"carousel_show_navigation" boolean DEFAULT true NOT NULL,
	"carousel_show_indicators" boolean DEFAULT true NOT NULL,
	"show_title" boolean DEFAULT true NOT NULL,
	"show_creator" boolean DEFAULT true NOT NULL,
	"show_views" boolean DEFAULT true NOT NULL,
	"show_duration" boolean DEFAULT true NOT NULL,
	"show_created_at" boolean DEFAULT false NOT NULL,
	"live_sort" "gallery_live_sort" DEFAULT 'newest' NOT NULL,
	"live_time_window" "gallery_time_window" DEFAULT '30d' NOT NULL,
	"live_custom_start" timestamp with time zone,
	"live_custom_end" timestamp with time zone,
	"live_result_limit" integer DEFAULT 12 NOT NULL,
	"include_categories" varchar[] DEFAULT '{}' NOT NULL,
	"exclude_categories" varchar[] DEFAULT '{}' NOT NULL,
	"minimum_views" integer DEFAULT 0 NOT NULL,
	"minimum_duration" integer DEFAULT 0 NOT NULL,
	"maximum_duration" integer DEFAULT 0 NOT NULL,
	"title_blacklist" varchar[] DEFAULT '{}' NOT NULL,
	"creator_allowlist" varchar[] DEFAULT '{}' NOT NULL,
	"creator_blocklist" varchar[] DEFAULT '{}' NOT NULL,
	"theme" "gallery_theme" DEFAULT 'system' NOT NULL,
	"accent_color" varchar DEFAULT '#7C3AED' NOT NULL,
	"background_mode" varchar DEFAULT 'transparent' NOT NULL,
	"background_color" varchar DEFAULT '#000000' NOT NULL,
	"card_surface_color" varchar DEFAULT '#18181B' NOT NULL,
	"text_color" varchar DEFAULT '#FFFFFF' NOT NULL,
	"card_radius" integer DEFAULT 16 NOT NULL,
	"gap" integer DEFAULT 16 NOT NULL,
	"thumbnail_treatment" varchar DEFAULT 'cover' NOT NULL,
	"modal_backdrop" varchar DEFAULT 'rgba(0,0,0,0.72)' NOT NULL,
	"desktop_modal_width" integer DEFAULT 960 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plausible_stats_cache" (
	"owner_id" varchar NOT NULL,
	"cache_key" varchar NOT NULL,
	"value" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_error_at" timestamp with time zone,
	CONSTRAINT "plausible_stats_cache_owner_id_cache_key_pk" PRIMARY KEY("owner_id","cache_key")
);
--> statement-breakpoint
CREATE TABLE "user_content_states" (
	"user_id" varchar NOT NULL,
	"content_key" varchar NOT NULL,
	"state" varchar NOT NULL,
	"state_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_content_states_user_id_content_key_pk" PRIMARY KEY("user_id","content_key")
);
--> statement-breakpoint
ALTER TABLE "userSettings" ADD COLUMN "creator_page_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "userSettings" ADD COLUMN "creator_page_visibility" varchar;--> statement-breakpoint
ALTER TABLE "userSettings" ADD COLUMN "creator_page_show_bio" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "userSettings" ADD COLUMN "creator_page_social_title" varchar;--> statement-breakpoint
ALTER TABLE "userSettings" ADD COLUMN "creator_page_social_description" varchar;--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plausible_stats_cache" ADD CONSTRAINT "plausible_stats_cache_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_content_states" ADD CONSTRAINT "user_content_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "galleries_owner_created_at_idx" ON "galleries" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "galleries_playlist_idx" ON "galleries" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "plausible_stats_cache_expiry_idx" ON "plausible_stats_cache" USING btree ("expires_at");