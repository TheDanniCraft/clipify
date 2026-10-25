import { defaultProgress, transition, stepsForTask, routeForTask, parseProgress } from "@lib/userTour";
const apply = (state: ReturnType<typeof defaultProgress>, event: Parameters<typeof transition>[1]) => transition(state, event, "owner");
it("opens the checklist by default, without starting a blocking spotlight", () => {
	expect(defaultProgress()).toMatchObject({ minimized: false, active: null, skipped: [] });
});
it("starts creation at Add Overlay even when the dashboard discovered an existing overlay", () => {
	const state = apply({ ...defaultProgress(), overlayId: "existing" }, { type: "start", task: "overlay.name" });
	expect(routeForTask("overlay.name", state)).toBe("/dashboard");
	expect(stepsForTask("overlay.name", state)[state.active!.index].target).toBe("create-overlay");
	const created = apply(state, { type: "overlay.created", ownerId: "owner", id: "new" });
	expect(stepsForTask("overlay.name", created)[created.active!.index].target).toBe("overlay-name");
});
it("keeps a completed-task handoff instead of silently ending the guide", () => {
	const state = apply({ ...defaultProgress(), overlayId: "overlay", active: { task: "overlay.name", index: 2, paused: false } }, { type: "overlay.saved", ownerId: "owner", id: "overlay", named: true, source: true });
	expect(state.active).toMatchObject({ task: "overlay.name", done: true });
	expect(state.completed).toEqual(["overlay.name"]);
});
it("records a manual skip separately, pauses its spotlight and allows undo", () => {
	const state = apply(defaultProgress(), { type: "start", task: "overlay.source" });
	const skipped = apply(state, { type: "task.skip", task: "overlay.source" });
	expect(skipped.skipped).toContain("overlay.source");
	expect(skipped.completed).not.toContain("overlay.source");
	expect(skipped.active).toBeNull();
	expect(parseProgress(JSON.stringify(skipped)).skipped).toEqual(["overlay.source"]);
	expect(apply(skipped, { type: "task.restore", task: "overlay.source" }).skipped).toEqual([]);
});
it("teaches the actual style button before arriving at Theme Studio", () => {
	const state = apply({ ...defaultProgress(), overlayId: "overlay" }, { type: "start", task: "appearance.style" });
	expect(routeForTask("appearance.style", state)).toBe("/dashboard/overlay/overlay");
	expect(stepsForTask("appearance.style", state)[0].target).toBe("overlay-customize");
	expect(routeForTask("appearance.style", apply(state, { type: "next" }))).toBe("/dashboard/overlay/overlay/theme");
});
it("highlights filters and the copy action, with setup instructions as their own step", () => {
	const state = { ...defaultProgress(), overlayId: "overlay" };
	expect(stepsForTask("overlay.source", state).map((step) => step.target)).toContain("overlay-filters");
	expect(stepsForTask("overlay.setup", state)[0].target).toBe("overlay-copy");
	const copying = apply(state, { type: "start", task: "overlay.setup" });
	const copied = apply(copying, { type: "overlay.copied", ownerId: "owner", id: "overlay" });
	expect(copied.active?.index).toBe(1);
	expect(copied.completed).not.toContain("overlay.setup");
});
it("keeps unchanged appearance as skipped, without claiming a saved customization", () => {
	const state = { ...defaultProgress(), overlayId: "overlay", active: { task: "appearance.style" as const, index: 2, paused: false } };
	const next = apply(state, { type: "next" });
	expect(next.completed).not.toContain("appearance.style");
	expect(next.skipped).toContain("appearance.style");
	expect(next.active?.done).toBe(true);
});
it("does not let a foreign website copy advance the active instruction", () => {
	const state = { ...defaultProgress(), active: { task: "website.embed" as const, index: 1, paused: false } };
	expect(apply(state, { type: "website.copied", ownerId: "other", id: "foreign" })).toEqual(state);
	expect(apply(state, { type: "website.copied", ownerId: "owner", id: "owned" }).active?.index).toBe(2);
});

it("clears an old completion handoff when its checkbox is unchecked", () => {
	const state = { ...defaultProgress(), completed: ["overlay.name" as const], active: { task: "overlay.name" as const, index: 2, paused: false, done: true } };
	const next = apply(state, { type: "task.restore", task: "overlay.name" });
	expect(next.completed).toEqual([]);
	expect(next.active).toBeNull();
});
