-- Run manually against the development database only. Never run in production.
-- Adds one labelled demo stream for thedannicraft using up to five unassigned,
-- owned cached clips. It changes no source clip fields and downloads no media.
-- Re-running is safe. No schema changes or deployment hooks are required.
BEGIN;
DO $$
DECLARE
  owner_id constant text := '274252231';
  stream_id constant text := '999999999999999546';
  selected jsonb;
  item jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('preview-demo:546:' || owner_id));
  PERFORM 1 FROM users WHERE id=owner_id AND lower(username)='thedannicraft' AND NOT disabled FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active thedannicraft account not found'; END IF;
  IF EXISTS (SELECT 1 FROM user_content_states WHERE user_id=owner_id AND content_key='broadcast:v1:' || stream_id) THEN
    RAISE NOTICE 'Demo stream already exists'; RETURN;
  END IF;
  SELECT jsonb_agg(jsonb_build_object('key',key,'broadcast',NULL)) INTO selected FROM (
    SELECT key FROM "twitchCache"
    WHERE type='clip' AND starts_with(key,'clip:' || owner_id || ':')
      AND value::jsonb#>>'{clip,broadcaster_id}'=owner_id
      AND nullif(value::jsonb#>>'{clip,id}','') IS NOT NULL
      AND coalesce(value::jsonb#>>'{clip,video_id}','')=''
      AND coalesce(value::jsonb->'broadcast','null'::jsonb)='null'::jsonb
      AND coalesce(value::jsonb->'unavailable','false'::jsonb)='false'::jsonb
      AND (value::jsonb#>>'{clip,view_count}')::bigint>=10
    ORDER BY key LIMIT 5 FOR UPDATE
  ) AS candidates;
  IF selected IS NULL THEN RAISE EXCEPTION 'No unassigned owned clips with at least 10 views; no changes made'; END IF;
  INSERT INTO user_content_states(user_id,content_key,state)
    VALUES(owner_id,'preview-demo-backup:546',selected::text);
  FOR item IN SELECT * FROM jsonb_array_elements(selected) LOOP
    UPDATE "twitchCache" SET value=jsonb_set(value::jsonb,'{broadcast}',jsonb_build_object('id',stream_id,'offset',NULL))::text
      WHERE type='clip' AND key=item->>'key';
  END LOOP;
  INSERT INTO user_content_states(user_id,content_key,state) VALUES(owner_id,'broadcast:v1:' || stream_id,
    jsonb_build_object('video',jsonb_build_object('id',stream_id,'user_id',owner_id,'title','[DEMO] Manual export review',
      'type','archive','created_at',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'duration','Demo','thumbnail_url',''),
      'lastSeenAt',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'unavailable',true)::text);
  RAISE NOTICE 'Demo stream created with % clips: /dashboard/streams/%',jsonb_array_length(selected),stream_id;
END $$;
COMMIT;
