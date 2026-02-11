CREATE TABLE "twitchCache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar NOT NULL,
	"key" varchar NOT NULL,
	"value" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "twitch_cache_type_key_unique" ON "twitchCache" USING btree ("type","key");