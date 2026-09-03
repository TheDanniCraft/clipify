-- Manual production runbook. Review and replace the sample mapping before use.
-- PostgreSQL does not expose a durable row-creation timestamp unless the application stored one.
-- Do not derive ordering from xmin, ctid, physical row order, or Twitch account creation time alone.

BEGIN;

-- Same lock order as allocation: allocator first, then users.
-- Reserve once even if backfill happens before the first post-release signup.
LOCK TABLE member_number_allocator IN EXCLUSIVE MODE;
LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO member_number_allocator (id, legacy_reserved_through, last_allocated)
SELECT 1, baseline, baseline
FROM (SELECT GREATEST(COUNT(*), COALESCE(MAX(member_number), 0))::integer AS baseline FROM users) AS seed
ON CONFLICT (id) DO NOTHING;

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

	IF EXISTS (
		SELECT 1 FROM member_number_backfill
		WHERE member_number > (SELECT legacy_reserved_through FROM member_number_allocator WHERE id = 1)
	) THEN
		RAISE EXCEPTION 'Backfill number exceeds the reserved legacy range';
	END IF;

	IF EXISTS (
		SELECT 1 FROM member_number_backfill mapping JOIN users ON users.id = mapping.user_id
		WHERE users.member_number IS NOT NULL AND users.member_number <> mapping.member_number
	) THEN
		RAISE EXCEPTION 'Backfill cannot change an already assigned member number';
	END IF;
END $$;

UPDATE users
SET member_number = mapping.member_number
FROM member_number_backfill mapping
WHERE users.id = mapping.user_id AND users.member_number IS NULL;

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM users WHERE member_number IS NULL) THEN
		RAISE EXCEPTION 'Backfill must resolve every legacy account';
	END IF;
END $$;

-- Never reset the allocator: it also remembers allocated numbers whose user
-- insert failed, is still in flight, or was subsequently deleted.

-- Review before committing.
SELECT id, username, created_at, twitch_created_at, member_number
FROM users
ORDER BY CASE WHEN member_number = 0 THEN 1 ELSE 0 END, member_number NULLS LAST, id;

COMMIT;

-- Run only after the first 100 positive member numbers have been reviewed and approved.
-- The founder badge must already exist in the generated PostgreSQL badge enum.
-- INSERT INTO user_badges (user_id, badge_slug, source)
-- SELECT id, 'founder', 'founder_backfill_2026'
-- FROM users
-- WHERE member_number BETWEEN 1 AND 100
-- ON CONFLICT (user_id, badge_slug) DO NOTHING;
