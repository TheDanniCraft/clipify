import type { PoolClient } from "pg";

type SqlClient = Pick<PoolClient, "query">;

const CREATOR_ONBOARDING_SQL = `
SELECT pg_advisory_xact_lock(hashtextextended('clipify:install-twitch-creator-triggers', 0));

CREATE OR REPLACE FUNCTION public.clipify_provision_twitch_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
	identity auth.user%ROWTYPE;
	v_organization_id text := 'creator:' || NEW.account_id;
	existing_auth_user_id text;
	existing_creator_id varchar;
	existing_organization_id text;
BEGIN
	IF NEW.provider_id <> 'twitch' THEN
		RETURN NEW;
	END IF;

	PERFORM pg_advisory_xact_lock(hashtextextended('clipify:twitch-onboarding:' || NEW.account_id, 0));
	SELECT * INTO identity FROM auth.user WHERE id = NEW.user_id;
	IF NOT FOUND OR identity.email_verified IS NOT TRUE OR btrim(identity.email) = '' THEN
		RAISE EXCEPTION 'TWITCH_VERIFIED_IDENTITY_REQUIRED' USING ERRCODE = '23514';
	END IF;

	SELECT auth_user_id INTO existing_auth_user_id
	FROM public.creator_identity_links
	WHERE creator_id = NEW.account_id;
	IF FOUND AND existing_auth_user_id <> NEW.user_id THEN
		RAISE EXCEPTION 'TWITCH_SUBJECT_ALREADY_LINKED' USING ERRCODE = '23505';
	END IF;

	SELECT creator_id INTO existing_creator_id
	FROM public.creator_identity_links
	WHERE auth_user_id = NEW.user_id AND creator_id <> NEW.account_id
	LIMIT 1;
	IF FOUND THEN
		RAISE EXCEPTION 'AUTH_USER_ALREADY_LINKED_TO_CREATOR' USING ERRCODE = '23505';
	END IF;

	INSERT INTO public.users (id, email, username, avatar, role, plan, created_at, updated_at, last_login)
	VALUES (NEW.account_id, lower(identity.email), identity.name, coalesce(identity.image, ''), 'user', 'free', identity.created_at, now(), now())
	ON CONFLICT (id) DO UPDATE
	SET email = EXCLUDED.email,
		username = EXCLUDED.username,
		avatar = EXCLUDED.avatar,
		updated_at = now(),
		last_login = now();

	INSERT INTO auth.organization (id, name, slug, logo, created_at, metadata)
	VALUES (
		v_organization_id,
		identity.name,
		'creator-' || substr(md5(NEW.account_id), 1, 20),
		identity.image,
		identity.created_at,
		jsonb_build_object('kind', 'creator', 'creatorId', NEW.account_id)::text
	)
	ON CONFLICT (id) DO UPDATE
	SET name = EXCLUDED.name,
		logo = EXCLUDED.logo,
		metadata = EXCLUDED.metadata;

	SELECT creator_account.organization_id INTO existing_organization_id
	FROM public.creator_accounts creator_account
	WHERE creator_account.creator_id = NEW.account_id;
	IF FOUND AND existing_organization_id <> v_organization_id THEN
		RAISE EXCEPTION 'CREATOR_ORGANIZATION_CONFLICT' USING ERRCODE = '23505';
	END IF;

	INSERT INTO public.creator_accounts (organization_id, creator_id, status, created_at, updated_at)
	VALUES (v_organization_id, NEW.account_id, 'active', now(), now())
	ON CONFLICT (creator_id) DO UPDATE SET updated_at = now();

	INSERT INTO public.creator_identity_links (creator_id, auth_user_id, source, created_at, updated_at)
	VALUES (NEW.account_id, NEW.user_id, 'twitch_onboarding', now(), now())
	ON CONFLICT (creator_id) DO UPDATE
	SET auth_user_id = EXCLUDED.auth_user_id,
		source = EXCLUDED.source,
		updated_at = now();

	INSERT INTO auth.member (id, organization_id, user_id, role, created_at)
	VALUES ('owner:' || NEW.id, v_organization_id, NEW.user_id, 'owner', now())
	ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner';

	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS clipify_twitch_creator_on_account_insert ON auth.account;
CREATE TRIGGER clipify_twitch_creator_on_account_insert
AFTER INSERT ON auth.account
FOR EACH ROW
WHEN (NEW.provider_id = 'twitch')
EXECUTE FUNCTION public.clipify_provision_twitch_creator();

CREATE OR REPLACE FUNCTION public.clipify_sync_twitch_creator_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth
AS $function$
BEGIN
	IF NEW.email_verified IS NOT TRUE OR btrim(NEW.email) = '' THEN
		RETURN NEW;
	END IF;

	UPDATE public.users creator
	SET email = lower(NEW.email),
		username = NEW.name,
		avatar = coalesce(NEW.image, ''),
		updated_at = now()
	FROM public.creator_identity_links link
	JOIN auth.account account ON account.user_id = link.auth_user_id AND account.provider_id = 'twitch'
	WHERE link.auth_user_id = NEW.id
		AND creator.id = link.creator_id;

	UPDATE auth.organization organization
	SET name = NEW.name,
		logo = NEW.image,
		metadata = jsonb_build_object('kind', 'creator', 'creatorId', account.creator_id)::text
	FROM public.creator_accounts account
	JOIN public.creator_identity_links link ON link.creator_id = account.creator_id
	WHERE link.auth_user_id = NEW.id
		AND organization.id = account.organization_id;

	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS clipify_twitch_creator_profile_sync ON auth.user;
CREATE TRIGGER clipify_twitch_creator_profile_sync
AFTER UPDATE OF name, email, email_verified, image ON auth.user
FOR EACH ROW
EXECUTE FUNCTION public.clipify_sync_twitch_creator_profile();
`;

export async function installCreatorOnboardingTriggers(client: SqlClient): Promise<void> {
	await client.query(CREATOR_ONBOARDING_SQL);
}
