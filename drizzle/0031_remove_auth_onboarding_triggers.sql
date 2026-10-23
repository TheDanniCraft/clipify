-- Creator setup and verified profile sync now run in Better Auth hooks.
-- Explicitly authorized custom migration: retire the old auth trigger boundary.
DROP TRIGGER IF EXISTS clipify_twitch_creator_on_account_insert ON auth.account;
--> statement-breakpoint
DROP TRIGGER IF EXISTS clipify_twitch_creator_profile_sync ON auth."user";
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.clipify_provision_twitch_creator();
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.clipify_sync_twitch_creator_profile();
