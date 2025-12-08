CREATE TABLE "modQueue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broadcaster_id" varchar NOT NULL,
	"clip_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userSettings" (
	"id" varchar PRIMARY KEY NOT NULL,
	"prefix" varchar DEFAULT '!' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "userSettings" ADD CONSTRAINT "userSettings_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;