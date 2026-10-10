-- Explicitly authorized custom migration: entitlement and badge notification fallback.
-- Database triggers only write durable events; application workers render/send mail.
CREATE OR REPLACE FUNCTION public.clipify_notification_email(creator_id varchar)
RETURNS text LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
 SELECT COALESCE(NULLIF(identity.email,''),NULLIF(creator.email,''))
 FROM public.users creator
 LEFT JOIN public.creator_identity_links link ON link.creator_id=creator.id
 LEFT JOIN auth."user" identity ON identity.id=link.auth_user_id
 WHERE creator.id=$1
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.clipify_entitlement_notification()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
 recipient text; benefit text; payload jsonb; event text; event_key text;
 boundary text; scheduled timestamptz; expiry_key text;
BEGIN
 IF NEW.user_id IS NULL OR NEW.source='billing' OR NEW.entitlement NOT IN ('pro_access','runner_access') THEN RETURN NEW; END IF;
 recipient := public.clipify_notification_email(NEW.user_id);
 IF recipient IS NULL THEN RETURN NEW; END IF;
 benefit := CASE WHEN NEW.entitlement='runner_access' THEN 'runner' ELSE 'pro' END;
 payload := jsonb_build_object('type','benefit','benefit',benefit,'grantId',NEW.id,'trial',NEW.source='reverse_trial','partner',NEW.source='partner' AND NEW.entitlement='pro_access','complimentary',NEW.source<>'managed_contract','reason',CASE WHEN NEW.source='reverse_trial' THEN NULL ELSE NEW.reason END,'startsAt',to_char(NEW.starts_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'endsAt',CASE WHEN NEW.ends_at IS NULL THEN NULL ELSE to_char(NEW.ends_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END);
 IF TG_OP='INSERT' THEN
  IF NEW.revoked_at IS NOT NULL THEN RETURN NEW; END IF;
  event := 'granted'; event_key := 'benefit:'||NEW.id::text||':granted';
 ELSIF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
  event := 'revoked'; event_key := 'benefit:'||NEW.id::text||':revoked:'||floor(extract(epoch FROM NEW.revoked_at)*1000)::text;
 ELSIF NEW.revoked_at IS NOT NULL THEN RETURN NEW;
 ELSIF OLD.revoked_at IS NOT NULL THEN
  event := 'restored'; event_key := 'benefit:'||NEW.id::text||':restored:'||md5(payload::text);
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
--> statement-breakpoint
CREATE TRIGGER clipify_entitlement_notification AFTER INSERT OR UPDATE ON public.entitlement_grants FOR EACH ROW EXECUTE FUNCTION public.clipify_entitlement_notification();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.clipify_badge_notification()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE award public.user_badges%ROWTYPE; recipient text; event text;
BEGIN
 IF TG_OP='DELETE' THEN award:=OLD; event:='removed'; ELSE award:=NEW; event:='awarded'; END IF;
 -- Partner is derived from entitlement eligibility, not a stored manual badge.
 IF award.badge='partner' THEN RETURN NULL; END IF;
 recipient:=public.clipify_notification_email(award.user_id);
 -- Cascading account deletion must not produce badge-removal emails.
 IF recipient IS NULL THEN RETURN NULL; END IF;
 INSERT INTO public.notification_outbox(event_type,recipient,template_version,locale,payload,scheduled_at,dedupe_key)
 VALUES('badge',recipient,'badge-v1','en',jsonb_build_object('type','badge','badge',award.badge,'event',event,'userId',award.user_id),now(),'badge:'||award.user_id||':'||award.badge::text||':'||to_char(award.awarded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')||':'||event)
 ON CONFLICT(dedupe_key) DO NOTHING;
 RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE TRIGGER clipify_badge_notification AFTER INSERT OR DELETE ON public.user_badges FOR EACH ROW EXECUTE FUNCTION public.clipify_badge_notification();
--> statement-breakpoint
-- Additional account-status fallback explicitly requested by the user.
CREATE OR REPLACE FUNCTION public.clipify_account_access_notification()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE recipient text; changed_at timestamptz;
BEGIN
 IF OLD.disabled IS NOT DISTINCT FROM NEW.disabled THEN RETURN NEW; END IF;
 changed_at := CASE WHEN NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN NEW.updated_at ELSE clock_timestamp() END;
 recipient := public.clipify_notification_email(NEW.id);
 IF recipient IS NULL THEN RETURN NEW; END IF;
 INSERT INTO public.notification_outbox(event_type,recipient,template_version,locale,payload,scheduled_at,dedupe_key)
 VALUES('account-access',recipient,'account-access-v1','en',jsonb_build_object('userId',NEW.id,'name',NEW.username,'disabled',NEW.disabled,'automatic',COALESCE(NEW.disable_type='automatic',false),'reason',COALESCE(NEW.disabled_reason,''),'changedAt',to_char(changed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),now(),'account-access:'||NEW.id||':'||CASE WHEN NEW.disabled THEN 'disabled' ELSE 'enabled' END||':'||floor(extract(epoch FROM changed_at)*1000)::text)
 ON CONFLICT(dedupe_key) DO NOTHING;
 RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER clipify_account_access_notification AFTER UPDATE OF disabled ON public.users FOR EACH ROW EXECUTE FUNCTION public.clipify_account_access_notification();
