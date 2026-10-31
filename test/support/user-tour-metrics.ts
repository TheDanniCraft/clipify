import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { QueryClient } from "@/db/client";
import { getUserTourHealthStats } from "@/server/user-tour/metrics";
import { defaultProgress, guideContentKey, journeys, parseProgress } from "@lib/userTour";

let postgres: PGlite;
before(async () => {
	postgres = new PGlite();
	await postgres.exec("CREATE TABLE user_content_states(user_id text, content_key text, state text)");
});
after(async () => postgres.close());
const stats = () => getUserTourHealthStats(drizzle(postgres) as unknown as QueryClient, 8);
const states = [
	JSON.stringify({ ...defaultProgress(), completed: journeys.flatMap((section) => section.tasks.map((task) => task.id)) }),
	JSON.stringify({ ...defaultProgress(), overlayId: "overlay-1", copiedOverlayId: "overlay-1", completed: ["overlay.name", "overlay.source", "overlay.name", "unknown"], skipped: ["overlay.name", "overlay.preview", "overlay.preview", "unknown"] }),
	JSON.stringify({ version: 1, completed: ["overlay.source"], skipped: ["appearance.filters", "website.embed"] }),
	JSON.stringify(defaultProgress()),
	"malformed private account data",
];
test("no saved guide records has finite zero percentages and all current sections", async () => {
	const result = await stats();
	assert.equal(result.trackedAccounts, 0);
	assert.equal(result.untrackedAccounts, 8);
	assert.equal(result.completionRate, 0);
	assert.equal(result.averageProgress, 0);
	assert.equal(result.startedAccounts, 0);
	assert.equal(result.overlayLinkCopiedAccounts, 0);
	assert.equal(result.tasks.overlay_name.pendingAccounts, 0);
	assert.equal(Object.keys(result.sections).length, journeys.length);
});
test("one aggregate matches guide completion, migrations, duplicate and skip semantics", async () => {
	for (const [index, state] of states.entries()) await postgres.query("INSERT INTO user_content_states VALUES($1,$2,$3)", [`private-${index}`, guideContentKey, state]);
	await postgres.query("INSERT INTO user_content_states VALUES('unrelated','another-content-key',$1)", [states[0]]);
	const result = await stats();
	assert.equal(result.trackedAccounts, 5);
	assert.equal(result.untrackedAccounts, 3);
	assert.equal(result.invalidProgressAccounts, 1);
	assert.equal(result.accountsWithProgress, 3);
	assert.equal(result.startedAccounts, 3);
	assert.equal(result.inProgressAccounts, 2);
	assert.equal(result.overlayLinkCopiedAccounts, 1);
	assert.deepEqual(result.tasks.overlay_name, { title: "Create and name your overlay", section: "overlay", completedAccounts: 2, skippedAccounts: 0, pendingAccounts: 2, completionRate: 0.5 });
	assert.equal(result.tasks.overlay_preview.skippedAccounts, 1);
	assert.equal(result.tasks.appearance_clip_filters.completedAccounts, 2);
	assert.equal(result.tasks.explore_tools.skippedAccounts, 1);
	assert.equal(Object.keys(result.tasks).length, 18);
	assert.equal(result.completedAccounts, 1);
	assert.equal(result.completionRate, 0.2);
	const parsed = states.map((state) => parseProgress(state));
	assert.equal(
		result.completedTasks,
		parsed.reduce((sum, progress) => sum + progress.completed.length, 0),
	);
	assert.equal(
		result.skippedTasks,
		parsed.reduce((sum, progress) => sum + progress.skipped.length, 0),
	);
	assert.equal(result.averageProgress, 22 / 90);
	assert.equal(result.sections.overlay.averageProgress, 7 / 20);
	assert.equal(result.sections.overlay.completedAccounts, 1);
	assert.equal(result.sections.appearance.completedTasks, 5);
	assert.equal(result.sections.explore.skippedTasks, 1);
	assert(!JSON.stringify(result).includes("private-"));
	assert(!JSON.stringify(result).includes("malformed private"));
});
test("health reflects resets immediately instead of treating gauges as cumulative events", async () => {
	await postgres.query("UPDATE user_content_states SET state=$1 WHERE user_id='private-0'", [JSON.stringify(defaultProgress())]);
	const result = await stats();
	assert.equal(result.completedAccounts, 0);
	assert.equal(result.completedTasks, 4);
	assert.equal(result.completionRate, 0);
});
test("invalid shapes cannot break the aggregate or claim completion", async () => {
	for (const value of ["null", "[]", '{"version":2,"completed":{}}', '{"version":3,"completed":[]}', '{"version":2,"completed":[],"skipped":{}}']) await postgres.query("INSERT INTO user_content_states VALUES('invalid',$1,$2)", [guideContentKey, value]);
	const result = await stats();
	assert.equal(result.invalidProgressAccounts, 5);
	assert.equal(result.completedTasks, 4);
	assert.equal(result.skippedTasks, 2);
});

test("an active task counts as started without claiming a completed milestone", async () => {
	const before = await stats();
	await postgres.query("INSERT INTO user_content_states VALUES('active-only',$1,$2)", [guideContentKey, JSON.stringify({ ...defaultProgress(), active: { task: "overlay.name", index: 0, paused: true } })]);
	const result = await stats();
	assert.equal(result.startedAccounts, before.startedAccounts + 1);
	assert.equal(result.inProgressAccounts, before.inProgressAccounts + 1);
	assert.equal(result.tasks.overlay_name.completedAccounts, before.tasks.overlay_name.completedAccounts);
});
