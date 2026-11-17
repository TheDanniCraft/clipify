CREATE TABLE "connected_app_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"creator_id" varchar NOT NULL,
	"operations" text[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"provisioned_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connected_app_grants_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
ALTER TABLE "connected_app_grants" ADD CONSTRAINT "connected_app_grants_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_app_grants" ADD CONSTRAINT "connected_app_grants_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_app_grants" ADD CONSTRAINT "connected_app_grants_provisioned_by_user_id_fk" FOREIGN KEY ("provisioned_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connected_app_creator_idx" ON "connected_app_grants" USING btree ("creator_id");