CREATE TABLE "clip_crawl_jobs" (
	"creator_id" varchar NOT NULL,
	"kind" varchar NOT NULL,
	"next_run_at" timestamp with time zone,
	"requested_at" timestamp with time zone,
	"lease_id" uuid,
	"lease_expires_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clip_crawl_jobs_creator_id_kind_pk" PRIMARY KEY("creator_id","kind"),
	CONSTRAINT "clip_crawl_job_kind" CHECK ("clip_crawl_jobs"."kind" IN ('recent', 'backfill')),
	CONSTRAINT "clip_crawl_job_attempts" CHECK ("clip_crawl_jobs"."attempts" >= 0 AND "clip_crawl_jobs"."failures" >= 0),
	CONSTRAINT "clip_crawl_job_lease_pair" CHECK (("clip_crawl_jobs"."lease_id" IS NULL) = ("clip_crawl_jobs"."lease_expires_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "clip_crawl_jobs" ADD CONSTRAINT "clip_crawl_jobs_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clip_crawl_jobs_due_idx" ON "clip_crawl_jobs" USING btree ("next_run_at","creator_id","kind") WHERE "clip_crawl_jobs"."next_run_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "clip_crawl_jobs_manual_idx" ON "clip_crawl_jobs" USING btree ("next_run_at","creator_id","kind") WHERE "clip_crawl_jobs"."requested_at" IS NOT NULL;