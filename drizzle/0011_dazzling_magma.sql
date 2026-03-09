CREATE TYPE "public"."max_duration_mode" AS ENUM('filter', 'cut');--> statement-breakpoint
CREATE TYPE "public"."playback_mode" AS ENUM('random', 'top', 'smart_shuffle');--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "max_duration_mode" "max_duration_mode" DEFAULT 'filter' NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "playback_mode" "playback_mode" DEFAULT 'random' NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "prefer_current_category" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "clip_creators_only" varchar[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "clip_creators_blocked" varchar[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "clip_pack_size" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "player_volume" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "show_channel_info" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "show_clip_info" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "show_timer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "show_progress_bar" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "overlay_info_fade_out_seconds" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "theme_font_family" varchar DEFAULT 'inherit' NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "theme_text_color" varchar DEFAULT '#FFFFFF' NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "theme_accent_color" varchar DEFAULT '#7C3AED' NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "theme_background_color" varchar DEFAULT 'rgba(10,10,10,0.65)' NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "progress_bar_start_color" varchar DEFAULT '#26018E' NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "progress_bar_end_color" varchar DEFAULT '#8D42F9' NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "border_size" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "border_radius" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "effect_scanlines" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "effect_static" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "effect_crt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "channel_info_x" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "channel_info_y" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "clip_info_x" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "clip_info_y" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "timer_x" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "timer_y" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "channel_scale" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "clip_scale" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "timer_scale" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
CREATE INDEX "twitch_cache_expires_at_idx" ON "twitchCache" USING btree ("expires_at");