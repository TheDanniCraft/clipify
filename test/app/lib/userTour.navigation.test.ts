import { currentGuideStep, defaultProgress, transition, stepsForTask, navigationForTask, parseProgress, type GuideProgress } from "@lib/userTour";
const apply = (state: ReturnType<typeof defaultProgress>, event: Parameters<typeof transition>[1]) => transition(state, event, "owner");
it("replays creation at Add Overlay even when it was completed before", () => {
	let state: GuideProgress = { ...defaultProgress(), overlayId: "existing", completed: ["overlay.name" as const] };
	state = apply(state, { type: "start", task: "overlay.name", location: "dashboard" });
	state = apply(state, { type: "next" }); // Existing selected Overlays tab.
	expect(currentGuideStep(state)?.target).toBe("create-overlay");
	expect(state.overlayId).toBe("existing");
});
it("teaches the route to an overlay through the Dashboard link, tab and real row", () => {
	let state = apply({ ...defaultProgress(), overlayId: "overlay" }, { type: "start", task: "overlay.source", location: "tools" });
	expect(currentGuideStep(state)?.target).toBe("dashboard-home");
	state = apply(state, { type: "location", location: "dashboard" });
	expect(currentGuideStep(state)?.target).toBe("overlays-tab");
	state = apply(state, { type: "next" });
	expect(currentGuideStep(state)?.target).toBe("open-overlay");
	state = apply(state, { type: "location", location: "overlay" });
	expect(currentGuideStep(state)?.target).toBe("overlay-source");
});
it("continues the first-overlay flow after a real save without a completion card", () => {
	const state = { ...defaultProgress(), overlayId: "overlay", active: { task: "overlay.name" as const, index: 2, paused: false, navigation: [] } };
	const saved = apply(state, { type: "overlay.saved", ownerId: "owner", id: "overlay", named: true, source: true });
	expect(saved.active).toMatchObject({ task: "overlay.source", index: 0, paused: false });
	expect(saved.completed).toEqual(["overlay.name"]);
	expect(saved.minimized).toBe(true);
});
it("uses the normal profile menu and Tools action instead of navigating on behalf of users", () => {
	expect(navigationForTask("explore.tools", "overlay", { ...defaultProgress(), overlayId: "overlay" })).toEqual(["profile", "tools"]);
});
it("resumes an action checkpoint while teaching navigation from the current page", () => {
	const state = { ...defaultProgress(), overlayId: "overlay", active: { task: "overlay.source" as const, index: 1, paused: true, navigation: [] } };
	const resumed = apply(state, { type: "resume", location: "dashboard" });
	expect(resumed.active).toMatchObject({ index: 1, paused: false, navigation: ["overlays", "overlay"] });
});
it("keeps only one optional exploration section and migrates the old website task", () => {
	const stored = parseProgress(JSON.stringify({ version: 1, completed: ["website.embed"], minimized: true }));
	expect(stored.completed).toContain("explore.tools");
	expect(stepsForTask("explore.tools", { ...defaultProgress(), overlayId: "overlay" }).some((step) => step.target === "website-copy")).toBe(true);
});
it("finishes all core tasks quietly without re-opening the checklist", () => {
	const state = { ...defaultProgress(), overlayId: "overlay", copiedOverlayId: "overlay", completed: ["overlay.name", "overlay.source", "overlay.preview"] as const, active: { task: "overlay.setup" as const, index: 1, paused: false, navigation: [] } };
	const done = apply({ ...state, completed: [...state.completed] }, { type: "next" });
	expect(done.active).toBeNull();
	expect(done.minimized).toBe(true);
	expect(done.completed).toContain("overlay.setup");
});
it("pauses when the user leaves the expected page instead of moving them back", () => {
	const state = apply({ ...defaultProgress(), overlayId: "overlay" }, { type: "start", task: "overlay.source", location: "overlay" });
	expect(apply(state, { type: "location", location: "other" }).active?.paused).toBe(true);
});
it("resumes a creation action checkpoint without replaying Add Overlay", () => {
	const state = { ...defaultProgress(), overlayId: "overlay", active: { task: "overlay.name" as const, index: 1, paused: true, navigation: [] } };
	expect(apply(state, { type: "resume", location: "overlay" }).active).toMatchObject({ index: 1, navigation: [], paused: false });
	expect(apply(state, { type: "resume", location: "tools" }).active?.navigation).toEqual(["home", "overlays", "overlay"]);
	const replay = apply({ ...state, active: null, completed: ["overlay.name"] }, { type: "start", task: "overlay.name", location: "overlay" });
	expect(replay.active).toMatchObject({ index: 0, navigation: ["home", "overlays"] });
});
