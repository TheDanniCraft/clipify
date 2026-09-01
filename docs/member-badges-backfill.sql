-- Manual production runbook. Review and replace the sample mapping before use.
-- PostgreSQL does not expose a durable row-creation timestamp unless the application stored one.
-- Do not derive ordering from xmin, ctid, physical row order, or Twitch account creation time alone.

BEGIN;

CREATE TEMP TABLE member_number_backfill (
	user_id varchar PRIMARY KEY,
	member_number integer NOT NULL CHECK (member_number >= 0)
) ON COMMIT DROP;

-- Populate the reviewed mapping here. Zero means "legacy order could not be reconstructed".
-- INSERT INTO member_number_backfill (user_id, member_number) VALUES
--   ('reviewed-twitch-user-id', 1),
--   ('another-reviewed-user-id', 0);

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM member_number_backfill
		WHERE member_number > 0
		GROUP BY member_number
		HAVING COUNT(*) > 1
	) THEN
		RAISE EXCEPTION 'Positive member numbers must be unique';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM member_number_backfill mapping
		LEFT JOIN users ON users.id = mapping.user_id
		WHERE users.id IS NULL
	) THEN
		RAISE EXCEPTION 'Backfill contains unknown user IDs';
	END IF;
END $$;

UPDATE users
SET member_number = mapping.member_number
FROM member_number_backfill mapping
WHERE users.id = mapping.user_id;

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM users WHERE member_number IS NULL) THEN
		RAISE EXCEPTION 'Backfill must resolve every legacy account before resetting the sequence';
	END IF;
END $$;

-- Keep all future signups above both the current population reservation and reviewed numbers.
SELECT setval(
	'clipify_member_number_seq',
	GREATEST(
		(SELECT COUNT(*) FROM users),
		COALESCE((SELECT MAX(member_number) FROM users WHERE member_number > 0), 0),
		1
	),
	true
);

-- Review before committing.
SELECT id, username, created_at, twitch_created_at, member_number
FROM users
ORDER BY CASE WHEN member_number = 0 THEN 1 ELSE 0 END, member_number NULLS LAST, id;

COMMIT;

-- Run only after the first 100 positive member numbers have been reviewed and approved.
-- INSERT INTO badges (slug, name, description, icon, priority)
-- VALUES ('founder', 'Founder', 'One of the first 100 registered Clipify members.', 'crown', 100)
-- ON CONFLICT (slug) DO UPDATE
-- SET name = EXCLUDED.name,
--     description = EXCLUDED.description,
--     icon = EXCLUDED.icon,
--     priority = EXCLUDED.priority;
--
-- INSERT INTO user_badges (user_id, badge_slug, source)
-- SELECT id, 'founder', 'founder_backfill_2026'
-- FROM users
-- WHERE member_number BETWEEN 1 AND 100
-- ON CONFLICT (user_id, badge_slug) DO NOTHING;
