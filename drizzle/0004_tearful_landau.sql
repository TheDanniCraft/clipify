CREATE TABLE "editors" (
	"user_id" varchar NOT NULL,
	"editor_id" varchar NOT NULL,
	CONSTRAINT "editors_user_id_editor_id_pk" PRIMARY KEY("user_id","editor_id"),
	CONSTRAINT "editors_no_self" CHECK ("editors"."user_id" <> "editors"."editor_id")
);
--> statement-breakpoint
ALTER TABLE "editors" ADD CONSTRAINT "editors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;