-- Manual test data only, not a Drizzle migration. Run after the badge tables exist.
-- Defines one test badge and grants it only to Twitch user 274252231.
-- Re-running is safe; existing definitions/awards are not overwritten.
BEGIN;

INSERT INTO badges (slug, name, description, priority)
VALUES ('beta-member-test', 'Beta Member', 'A test badge for previewing the Clipify badge experience.', 10)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO user_badges (user_id, badge_slug, awarded_by, source)
VALUES ('274252231', 'beta-member-test', '274252231', 'manual-test')
ON CONFLICT (user_id, badge_slug) DO NOTHING;

COMMIT;

SELECT b.name, ub.user_id, ub.awarded_at
FROM user_badges ub JOIN badges b ON b.slug = ub.badge_slug
WHERE ub.user_id = '274252231' AND ub.badge_slug = 'beta-member-test';

-- Optional cleanup of this test award (run separately):
-- DELETE FROM user_badges
-- WHERE user_id = '274252231' AND badge_slug = 'beta-member-test' AND source = 'manual-test';
-- The badge definition can stay; an unassigned badge is not displayed on a card.
