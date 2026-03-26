ALTER TYPE "public"."overlay_type" ADD VALUE 'Playlist';--> statement-breakpoint
ALTER TYPE "public"."twitch_cache_type" ADD VALUE 'game_query' BEFORE 'clip';--> statement-breakpoint
CREATE TABLE "playlist_clips" (
	"playlist_id" uuid NOT NULL,
	"clip_id" varchar NOT NULL,
	"position" integer NOT NULL,
	"clip_data" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_clips_playlist_id_clip_id_pk" PRIMARY KEY("playlist_id","clip_id")
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "userSettings" ALTER COLUMN "marketing_opt_in" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "playlist_id" uuid;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "categories_only" varchar[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "categories_blocked" varchar[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "playlist_clips" ADD CONSTRAINT "playlist_clips_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playlist_clips_position_idx" ON "playlist_clips" USING btree ("playlist_id","position");--> statement-breakpoint
ALTER TABLE "overlays" ADD CONSTRAINT "overlays_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE set null ON UPDATE no action;