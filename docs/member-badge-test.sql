-- Manual test data only, not a Drizzle migration. Run after the badge enum and user_badges table exist.
-- Grants the code-defined beta-member-test badge only to Twitch user 274252231.
-- Re-running is safe; an existing award is not overwritten.
BEGIN;

INSERT INTO user_badges (user_id, badge_slug, awarded_by, source)
VALUES ('274252231', 'beta-member-test', '274252231', 'manual-test')
ON CONFLICT (user_id, badge_slug) DO NOTHING;

COMMIT;

SELECT badge_slug, user_id, awarded_at
FROM user_badges
WHERE user_id = '274252231' AND badge_slug = 'beta-member-test';

-- Optional cleanup of this test award (run separately):
-- DELETE FROM user_badges
-- WHERE user_id = '274252231' AND badge_slug = 'beta-member-test' AND source = 'manual-test';
