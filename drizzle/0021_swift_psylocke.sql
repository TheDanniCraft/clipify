CREATE TYPE "public"."badge" AS ENUM('founder', 'founder-supporter', 'partner', 'beta-tester', 'contributor');--> statement-breakpoint
CREATE TABLE "member_number_allocator" (
	"id" integer PRIMARY KEY NOT NULL,
	"legacy_reserved_through" integer NOT NULL,
	"last_allocated" integer NOT NULL,
	CONSTRAINT "member_number_allocator_singleton" CHECK ("member_number_allocator"."id" = 1),
	CONSTRAINT "member_number_allocator_range" CHECK ("member_number_allocator"."legacy_reserved_through" >= 0 AND "member_number_allocator"."last_allocated" >= "member_number_allocator"."legacy_reserved_through")
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"user_id" varchar NOT NULL,
	"badge" "badge" NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"awarded_by" varchar,
	"source" varchar(80),
	CONSTRAINT "user_badges_user_id_badge_pk" PRIMARY KEY("user_id","badge")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "member_number" integer;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_badges_badge_idx" ON "user_badges" USING btree ("badge");--> statement-breakpoint
CREATE UNIQUE INDEX "users_member_number_unique" ON "users" USING btree ("member_number") WHERE "users"."member_number" > 0;