/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/db/client", () => ({ db: {} }));
import { createMcpPostgresFixture } from "../../support/mcp/postgres";
import { applyUserTourEvent, loadUserTourProgress } from "@/server/user-tour/progress";
import { guideContentKey, defaultProgress, journeys } from "@lib/userTour";
let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
// Cold disposable schema/template provisioning uses the same budget as other database suites.
beforeEach(async () => {
	fixture = await createMcpPostgresFixture();
	await fixture.pool.query("INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('owner','owner@example.invalid','Owner','','user','free'),('other','other@example.invalid','Other','','user','free')");
}, 35000);
afterEach(async () => {
	await fixture?.close();
}, 35000);
it("remembers completed and skipped tasks and minimization on a fresh server read", async () => {
	await loadUserTourProgress("owner", fixture.db);
	await applyUserTourEvent("owner", { type: "overlay.saved", ownerId: "owner", id: "overlay", named: true, source: true }, fixture.db);
	await applyUserTourEvent("owner", { type: "task.skip", task: "overlay.preview" }, fixture.db);
	await applyUserTourEvent("owner", { type: "panel", minimized: true }, fixture.db);
	const next = await loadUserTourProgress("owner", fixture.db);
	expect(next.progress).toMatchObject({ completed: ["overlay.name", "overlay.source"], skipped: ["overlay.preview"], minimized: true });
	expect(next.importLegacy).toBe(false);
});
it("serializes simultaneous task updates without losing either completion", async () => {
	await Promise.all(["overlay.name", "overlay.source", "overlay.preview"].map((task) => applyUserTourEvent("owner", { type: "task.skip", task: task as "overlay.name" | "overlay.source" | "overlay.preview" }, fixture.db)));
	expect((await loadUserTourProgress("owner", fixture.db)).progress.skipped.sort()).toEqual(["overlay.name", "overlay.preview", "overlay.source"]);
});
it("keeps account state separate and cascades it on account deletion", async () => {
	await applyUserTourEvent("owner", { type: "task.skip", task: "overlay.name" }, fixture.db);
	expect((await loadUserTourProgress("other", fixture.db)).progress.skipped).toEqual([]);
	await fixture.pool.query("DELETE FROM users WHERE id='owner'");
	expect((await fixture.pool.query("SELECT user_id FROM user_content_states WHERE user_id='owner' AND content_key=$1", [guideContentKey])).rows).toEqual([]);
});
it("keeps a stored action checkpoint and restores it paused on a fresh session", async () => {
	const {
		rows: [overlay],
	} = await fixture.pool.query("INSERT INTO overlays (owner_id,name,status,type) VALUES ('owner','Checkpoint overlay','active','All') RETURNING id");
	await applyUserTourEvent("owner", { type: "overlay.ready", ownerId: "owner", id: overlay.id }, fixture.db);
	await applyUserTourEvent("owner", { type: "start", task: "overlay.source", location: "overlay" }, fixture.db);
	await applyUserTourEvent("owner", { type: "next" }, fixture.db);
	const saved = await loadUserTourProgress("owner", fixture.db);
	expect(saved.progress.active).toMatchObject({ task: "overlay.source", index: 1, paused: true });
});
it("recognizes existing owned resources without reopening onboarding", async () => {
	await fixture.pool.query("INSERT INTO overlays (owner_id,name,status,type) VALUES ('owner','Existing overlay','active','All')");
	const saved = await loadUserTourProgress("owner", fixture.db);
	expect(saved.progress.completed).toEqual(["overlay.name", "overlay.source"]);
	expect(saved.progress.minimized).toBe(true);
	expect(saved.progress.welcomeSeen).toBe(true);
	expect(saved.progress.active).toBeNull();
});
it("persists welcome dismissal and starts only the unfinished core tasks on request", async () => {
	await applyUserTourEvent("owner", { type: "welcome.dismiss" }, fixture.db);
	expect((await loadUserTourProgress("owner", fixture.db)).progress).toMatchObject({ welcomeSeen: true, minimized: true, active: null });
	await applyUserTourEvent("owner", { type: "task.skip", task: "overlay.name" }, fixture.db);
	const started = await applyUserTourEvent("owner", { type: "welcome.start", location: "dashboard" }, fixture.db);
	expect(started.active).toMatchObject({ task: "overlay.source", paused: false });
});
it("awards only after every guide and keeps the badge across replay and reload", async () => {
	const {
		rows: [overlay],
	} = await fixture.pool.query("INSERT INTO overlays (owner_id,name,status,type) VALUES ('owner','Badge overlay','active','All') RETURNING id");
	await loadUserTourProgress("owner", fixture.db);
	await applyUserTourEvent("owner", { type: "overlay.previewed", ownerId: "owner", id: overlay.id, count: 1 }, fixture.db);
	await applyUserTourEvent("owner", { type: "overlay.copied", ownerId: "owner", id: overlay.id }, fixture.db);
	const core = await applyUserTourEvent("owner", { type: "setup.confirmed" }, fixture.db);
	expect(core.expertAwardedAt).toBeUndefined();
	const allTasks = journeys.flatMap((journey) => journey.tasks.map((task) => task.id));
	await fixture.pool.query("UPDATE user_content_states SET state=$1 WHERE user_id='owner' AND content_key=$2", [JSON.stringify({ ...core, completed: allTasks.filter((task) => task !== "appearance.style") }), guideContentKey]);
	const awarded = await applyUserTourEvent("owner", { type: "theme.saved", ownerId: "owner", id: overlay.id, changed: true }, fixture.db);
	expect(awarded.expertAwardedAt).toEqual(expect.any(String));
	expect(awarded.skipped).toEqual([]);
	await applyUserTourEvent("owner", { type: "task.restore", task: "overlay.name" }, fixture.db);
	const reloaded = await loadUserTourProgress("owner", fixture.db);
	expect(reloaded.progress.expertAwardedAt).toBe(awarded.expertAwardedAt);
	expect((await loadUserTourProgress("other", fixture.db)).progress.expertAwardedAt).toBeUndefined();
});
it("does not award a badge for skipping every core task", async () => {
	for (const task of ["overlay.name", "overlay.source", "overlay.preview", "overlay.setup"] as const) await applyUserTourEvent("owner", { type: "task.skip", task }, fixture.db);
	expect((await loadUserTourProgress("owner", fixture.db)).progress.expertAwardedAt).toBeUndefined();
});

it("does not count skipped guides and invalidates the previous core-only award", async () => {
	const completed = journeys.flatMap((journey) => journey.tasks.map((task) => task.id)).filter((task) => task !== "explore.support");
	const state = { ...defaultProgress(), completed, skipped: ["explore.support"], expertAwardedAt: "2026-01-01T00:00:00.000Z" };
	await fixture.pool.query("INSERT INTO user_content_states (user_id,content_key,state) VALUES ('owner',$1,$2)", [guideContentKey, JSON.stringify(state)]);
	const loaded = await loadUserTourProgress("owner", fixture.db);
	expect(loaded.progress.expertAwardedAt).toBeUndefined();
	expect(loaded.progress.skipped).toContain("explore.support");
});
