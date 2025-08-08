CREATE TABLE "clipQueue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"overlay_id" uuid NOT NULL,
	"clip_id" varchar NOT NULL
);
--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "reward_id" varchar;--> statement-breakpoint
ALTER TABLE "clipQueue" ADD CONSTRAINT "clipQueue_overlay_id_overlays_id_fk" FOREIGN KEY ("overlay_id") REFERENCES "public"."overlays"("id") ON DELETE cascade ON UPDATE no action;