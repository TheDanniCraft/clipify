/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validatePullRequestTitle } = require("./check-pr-title.cjs");
test("squash commit titles use one Gitmoji and a capitalized action", () => {
	for (const title of ["🐛 Fix OAuth refresh", "📈 Add onboarding statistics", "⚡️ Speed up CI feedback"]) assert.doesNotThrow(() => validatePullRequestTitle(title));
	for (const title of ["Fix OAuth refresh", ":bug: Fix OAuth refresh", "🐛 fix OAuth refresh", "🐛 fix: OAuth refresh", "🐛 Fix OAuth\nrefresh", "🐛 Fix OAuth ✨", "🚀 " + "A".repeat(60), " 🐛 Fix OAuth refresh", "🐛 Fix OAuth refresh "]) assert.throws(() => validatePullRequestTitle(title), /title|Gitmoji/);
});
