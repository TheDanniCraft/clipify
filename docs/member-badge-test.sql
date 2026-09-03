-- Manual test data only, not a Drizzle migration. Run after the badge enum and user_badges table exist.
-- Grants the code-defined beta-tester badge only to Twitch user 274252231.
-- Re-running is safe; an existing award is not overwritten.
BEGIN;

INSERT INTO user_badges (user_id, badge, awarded_by, source)
VALUES ('274252231', 'beta-tester', '274252231', 'manual-test')
ON CONFLICT (user_id, badge) DO NOTHING;

COMMIT;

SELECT badge, user_id, awarded_at
FROM user_badges
WHERE user_id = '274252231' AND badge = 'beta-tester';

-- Optional cleanup of this test award (run separately):
-- DELETE FROM user_badges
-- WHERE user_id = '274252231' AND badge = 'beta-tester' AND source = 'manual-test';
