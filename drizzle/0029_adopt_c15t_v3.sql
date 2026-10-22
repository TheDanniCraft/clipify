ALTER TABLE "c15t_subject" RENAME TO "subject";
--> statement-breakpoint
ALTER TABLE "c15t_domain" RENAME TO "domain";
--> statement-breakpoint
ALTER TABLE "c15t_consentPolicy" RENAME TO "consentPolicy";
--> statement-breakpoint
ALTER TABLE "c15t_consentPurpose" RENAME TO "consentPurpose";
--> statement-breakpoint
ALTER TABLE "c15t_runtimePolicyDecision" RENAME TO "runtimePolicyDecision";
--> statement-breakpoint
ALTER TABLE "c15t_consent" RENAME TO "consent";
--> statement-breakpoint
ALTER TABLE "c15t_auditLog" RENAME TO "auditLog";
--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "verifiedExternalId" text;
--> statement-breakpoint
ALTER TABLE "consent" ADD COLUMN "choice" json;
--> statement-breakpoint
ALTER TABLE "consent" ADD COLUMN "vendorChoice" json;
--> statement-breakpoint
ALTER TABLE "consent" ADD COLUMN "experimentId" text;
--> statement-breakpoint
ALTER TABLE "consent" ADD COLUMN "experimentArm" text;
--> statement-breakpoint
ALTER TABLE "consent" ADD COLUMN "timeToDecisionMs" integer;
--> statement-breakpoint
ALTER TABLE "consent" ADD COLUMN "addtlConsent" text;
--> statement-breakpoint
ALTER TABLE "runtimePolicyDecision" ALTER COLUMN "jurisdiction" DROP NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_subject_externalId_idx" ON "subject" ("externalId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_consent_subjectId_idx" ON "consent" ("subjectId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_consent_domainId_idx" ON "consent" ("domainId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_consent_policyId_idx" ON "consent" ("policyId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_consent_runtimePolicyDecisionId_idx" ON "consent" ("runtimePolicyDecisionId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_auditLog_subjectId_idx" ON "auditLog" ("subjectId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_consentPolicy_type_isActive_effectiveDate_idx" ON "consentPolicy" ("type", "isActive", "effectiveDate");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_domain_name_idx" ON "domain" ("name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_consentPurpose_code_idx" ON "consentPurpose" ("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_subject_tenantId_idx" ON "subject" ("tenantId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_domain_tenantId_idx" ON "domain" ("tenantId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_consentPolicy_tenantId_idx" ON "consentPolicy" ("tenantId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_consentPurpose_tenantId_idx" ON "consentPurpose" ("tenantId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_runtimePolicyDecision_tenantId_idx" ON "runtimePolicyDecision" ("tenantId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_consent_tenantId_idx" ON "consent" ("tenantId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_auditLog_tenantId_idx" ON "auditLog" ("tenantId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "c15t_consent_tenantId_experimentId_experimentArm_idx" ON "consent" ("tenantId", "experimentId", "experimentArm");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "c15t_migrations" (
	"id" integer PRIMARY KEY,
	"name" text NOT NULL,
	"appliedAt" timestamp NOT NULL
);
--> statement-breakpoint
INSERT INTO "c15t_migrations" ("id", "name", "appliedAt") VALUES
	(1, '1-baseline', CURRENT_TIMESTAMP),
	(2, '2-hot-path-indexes', CURRENT_TIMESTAMP),
	(3, '3-consent-receipts-and-privacy-directives', CURRENT_TIMESTAMP),
	(4, '4-vendor-choice', CURRENT_TIMESTAMP),
	(5, '5-drop-subject-identity-authority', CURRENT_TIMESTAMP),
	(6, '6-experiment-attribution', CURRENT_TIMESTAMP),
	(7, '7-optional-decision-jurisdiction', CURRENT_TIMESTAMP),
	(8, '8-verified-external-id', CURRENT_TIMESTAMP),
	(9, '9-additional-consent', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
