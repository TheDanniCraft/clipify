# Approved exception: retire Runner references in the notification trigger

The user authorized this exact proposal with “Please continue” in direct response to the migration and one-commit approval-marker request. The named custom SQL and journal entry are now implemented; no production database has been changed. Ordinary generated migration ownership remains unchanged.

## Confirmed failure

Removing the retired `runner_access` enum value leaves the existing `clipify_entitlement_notification` PostgreSQL function referring to that value. Pro grant inserts then fail with `invalid input value for enum entitlement: "runner_access"`. Full CI database-2 exposes the actual database behavior; keeping the obsolete enum or hiding this failure in the fixture would defeat the authorized hard cut.

## Exact proposed exception

Authorize `drizzle/0028_retire_runner_notification_branch.sql` plus its single index28 entry in `drizzle/meta/_journal.json`, replacing **only** `public.clipify_entitlement_notification()` with the definition below. Do not edit historical migration0026, shared grant tables, billing records, schema-generation guards or unrelated triggers. This function is safe with both the old enum and its Pro-only replacement: compare the value as text and emit only Pro notifications. All event keys, deduplication, trials, Partner grace, expiry scheduling and rollback behavior remain unchanged.

Drizzle schema generation does not express replacements of existing PL/pgSQL function bodies. Ordinary enum/column migration generation remains owned by the post-merge Generate Migrations workflow. Adding this custom migration and its journal entry requires explicit approval. Also authorize `CLIPIFY_MANUAL_MIGRATION_APPROVED=1` only for committing those approved files; do not export it globally or use it to generate migrations. The marker was supplied only to the approved migration commit114f4a1b; it was not exported globally or used for generation. No schema snapshot is created or edited.

AGENTS.md: “A manual/custom migration is allowed only when Drizzle cannot express the required database behavior and the user explicitly authorizes that exact migration. Stop and explain the unsupported behavior before creating it.”

## Exact SQL for approval

```sql
CREATE OR REPLACE FUNCTION public.clipify_entitlement_notification()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
 recipient text; benefit text; payload jsonb; event text; event_key text;
 boundary text; scheduled timestamptz; expiry_key text;
BEGIN
 IF NEW.user_id IS NULL OR NEW.source='billing' OR NEW.entitlement::text <> 'pro_access' THEN RETURN NEW; END IF;
 recipient := public.clipify_notification_email(NEW.user_id);
 IF recipient IS NULL THEN RETURN NEW; END IF;
 benefit := 'pro';
 payload := jsonb_build_object('type','benefit','benefit',benefit,'grantId',NEW.id,'trial',NEW.source='reverse_trial','partner',NEW.source='partner' AND NEW.entitlement='pro_access','complimentary',NEW.source<>'managed_contract','reason',CASE WHEN NEW.source='reverse_trial' THEN NULL ELSE NEW.reason END,'startsAt',to_char(NEW.starts_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'endsAt',CASE WHEN NEW.ends_at IS NULL THEN NULL ELSE to_char(NEW.ends_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END);
 IF TG_OP='INSERT' THEN
  IF NEW.revoked_at IS NOT NULL THEN RETURN NEW; END IF;
  event := 'granted'; event_key := 'benefit:'||NEW.id::text||':granted';
 ELSIF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
  event := 'revoked'; event_key := 'benefit:'||NEW.id::text||':revoked:'||floor(extract(epoch FROM NEW.revoked_at)*1000)::text;
 ELSIF NEW.revoked_at IS NOT NULL THEN RETURN NEW;
 ELSIF OLD.revoked_at IS NOT NULL THEN
  event := 'restored'; event_key := 'benefit:'||NEW.id::text||':restored:'||floor(extract(epoch FROM OLD.revoked_at)*1000)::text||':'||md5(payload::text);
 ELSIF (OLD.starts_at,OLD.ends_at,OLD.entitlement,OLD.source) IS DISTINCT FROM (NEW.starts_at,NEW.ends_at,NEW.entitlement,NEW.source) THEN
  event := CASE WHEN NEW.source='partner' AND NEW.entitlement='pro_access' AND NEW.ends_at IS NOT NULL AND OLD.ends_at IS DISTINCT FROM NEW.ends_at THEN 'partner-scheduled' ELSE 'updated' END; event_key := 'benefit:'||NEW.id::text||':'||event||':'||md5(payload::text);
 ELSE RETURN NEW;
 END IF;
 INSERT INTO public.notification_outbox(event_type,recipient,template_version,locale,payload,scheduled_at,dedupe_key)
 VALUES('entitlement',recipient,'benefit-v1','en',payload||jsonb_build_object('event',event),CASE WHEN event='granted' THEN NEW.starts_at ELSE now() END,event_key)
 ON CONFLICT(dedupe_key) DO NOTHING;
 IF NEW.revoked_at IS NOT NULL OR NEW.ends_at IS NULL THEN RETURN NEW; END IF;
 expiry_key := floor(extract(epoch FROM NEW.ends_at)*1000)::text;
 FOR boundary,scheduled IN
 SELECT 'ended',NEW.ends_at + CASE WHEN NEW.source='partner' AND NEW.entitlement='pro_access' THEN interval '7 days' ELSE interval '0 days' END
 UNION ALL SELECT 'trial-30d',NEW.ends_at-interval '30 days' WHERE NEW.source='reverse_trial'
 UNION ALL SELECT 'trial-7d',NEW.ends_at-interval '7 days' WHERE NEW.source='reverse_trial'
 UNION ALL SELECT 'access-30d',NEW.ends_at-interval '30 days' WHERE NEW.source<>'reverse_trial' AND NOT (NEW.source='partner' AND NEW.entitlement='pro_access')
 UNION ALL SELECT 'access-7d',NEW.ends_at-interval '7 days' WHERE NEW.source<>'reverse_trial' AND NOT (NEW.source='partner' AND NEW.entitlement='pro_access')
 UNION ALL SELECT 'access-3d',NEW.ends_at-interval '3 days' WHERE NEW.source<>'reverse_trial' AND NOT (NEW.source='partner' AND NEW.entitlement='pro_access')
 UNION ALL SELECT 'access-1d',NEW.ends_at-interval '1 days' WHERE NEW.source<>'reverse_trial' AND NOT (NEW.source='partner' AND NEW.entitlement='pro_access')
 UNION ALL SELECT 'trial-3d',NEW.ends_at-interval '3 days' WHERE NEW.source='reverse_trial'
 UNION ALL SELECT 'trial-1d',NEW.ends_at-interval '1 day' WHERE NEW.source='reverse_trial'
 UNION ALL SELECT 'partner-ending-30d',NEW.ends_at-interval '30 days' WHERE NEW.source='partner' AND NEW.entitlement='pro_access'
 UNION ALL SELECT 'partner-ending-7d',NEW.ends_at-interval '7 days' WHERE NEW.source='partner' AND NEW.entitlement='pro_access'
 UNION ALL SELECT 'partner-ending-3d',NEW.ends_at-interval '3 days' WHERE NEW.source='partner' AND NEW.entitlement='pro_access'
 UNION ALL SELECT 'partner-ending-1d',NEW.ends_at-interval '1 days' WHERE NEW.source='partner' AND NEW.entitlement='pro_access'
 UNION ALL SELECT 'partner-ended',NEW.ends_at WHERE NEW.source='partner' AND NEW.entitlement='pro_access'
 UNION ALL SELECT 'partner-3d',NEW.ends_at+interval '4 days' WHERE NEW.source='partner' AND NEW.entitlement='pro_access'
 UNION ALL SELECT 'partner-1d',NEW.ends_at+interval '6 days' WHERE NEW.source='partner' AND NEW.entitlement='pro_access'
 LOOP
  IF scheduled<=NEW.starts_at AND boundary<>'ended' THEN CONTINUE; END IF;
  INSERT INTO public.notification_outbox(event_type,recipient,template_version,locale,payload,scheduled_at,dedupe_key)
  VALUES('entitlement',recipient,'benefit-v1','en',payload||jsonb_build_object('event',boundary),scheduled,'benefit:'||NEW.id::text||':'||boundary||':'||expiry_key)
  ON CONFLICT(dedupe_key) DO UPDATE SET payload=EXCLUDED.payload,scheduled_at=EXCLUDED.scheduled_at,updated_at=now()
  WHERE notification_outbox.status IN ('pending','retry');
 END LOOP;
 RETURN NEW;
END
$$;
```

## Local validation

Confirmed: the original whole-file Jest owner reproduces the failure against the Pro-only schema. A temporary local copy of its unchanged23 underlying database behaviors then passes23/23 after applying exactly the proposed function replacement to its disposable fixture. Event keys, Partner grace, expiry, revocation/restoration, account/badge notifications, deduplication and rollback assertions are unchanged. The prototype initially ran from `/tmp` and could not resolve repository dependencies; rerunning it from ignored test-results resolves setup. That prototype validated the proposal before approval. The named migration was subsequently created after authorization; no production database was changed.

Evidence: [original failure](tdd/evidence/ux-correction/notification-trigger-red.log), [proposed replacement validation](tdd/evidence/ux-correction/notification-trigger-proposal-23.log). The real owning test now loads the approved migration after historical0026; it does not rewrite or stub the old SQL.

## Implementation validation

The approved SQL and single journal entry are implemented. The original whole-file notification owner passes with all23 underlying assertions preserved, loading historical0026 then0028. Evidence: [actual owner Green](tdd/evidence/ux-correction/notification-trigger-approved-green.log). Full CI rerun remains required.
