/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/db/client", () => ({ db: {} }));
import { createMcpPostgresFixture } from "../../support/mcp/postgres";
import { applyUserTourEvent, loadUserTourProgress } from "@/server/user-tour/progress";
import { guideContentKey } from "@lib/userTour";
let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
beforeEach(async () => {
	fixture = await createMcpPostgresFixture();
	await fixture.pool.query("INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('owner','owner@example.invalid','Owner','','user','free'),('other','other@example.invalid','Other','','user','free')");
});
afterEach(async () => {
	await fixture?.close();
});
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
	expect(saved.progress.active).toBeNull();
});
