import { hasCompletedAllGuides, guideLocation, routeForTask, journeys, journeyGuidePercent, currentGuideStep, defaultProgress, transition, stepsForTask, navigationForTask, parseProgress, type GuideProgress } from "@lib/userTour";
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
it("starts customization inside the existing theme editor without a Dashboard detour", () => {
	const state = apply({ ...defaultProgress(), overlayId: "overlay" }, { type: "start", task: "appearance.style", location: "theme" });
	expect(state.active).toMatchObject({ index: 1, navigation: [] });
	expect(currentGuideStep(state)?.target).toBe("theme-controls");
});
it("resumes the saved-look checkpoint through Theme Studio without losing its index", () => {
	const state: GuideProgress = { ...defaultProgress(), overlayId: "overlay", active: { task: "appearance.style", index: 2, paused: true } };
	let resumed = apply(state, { type: "resume", location: "dashboard" });
	expect(resumed.active?.navigation).toEqual(["overlays", "overlay", "theme"]);
	resumed = apply(resumed, { type: "next" });
	resumed = apply(resumed, { type: "location", location: "overlay" });
	expect(currentGuideStep(resumed)?.target).toBe("overlay-customize");
	resumed = apply(resumed, { type: "location", location: "theme" });
	expect(currentGuideStep(resumed)?.target).toBe("theme-save");
	expect(apply(state, { type: "resume", location: "theme" }).active?.navigation).toEqual([]);
});
it("allows review from Save your look without resetting the task", () => {
	const state: GuideProgress = { ...defaultProgress(), overlayId: "overlay", active: { task: "appearance.style", index: 2, paused: false } };
	const reviewed = apply(state, { type: "previous" });
	expect(currentGuideStep(reviewed)?.target).toBe("theme-controls");
	expect(reviewed.completed).toEqual([]);
	const entry = apply(reviewed, { type: "previous", location: "theme" });
	expect(currentGuideStep(entry)?.target).toBe("theme-back");
	expect(currentGuideStep(apply(entry, { type: "location", location: "overlay" }))?.target).toBe("overlay-customize");
});
it("keeps the last section after completion and reload instead of showing core progress", () => {
	let state = apply({ ...defaultProgress(), overlayId: "overlay" }, { type: "start", task: "appearance.style", location: "theme" });
	state = apply(state, { type: "theme.saved", ownerId: "owner", id: "overlay", changed: true });
	expect(state.active).toBeNull();
	expect(parseProgress(JSON.stringify(state)).journeyId).toBe("appearance");
});
it("keeps filters only in the clip task and resumes a retired filter checkpoint there", () => {
	expect(journeys.find((journey) => journey.id === "appearance")!.tasks.map((task) => task.id)).toEqual(["appearance.style"]);
	expect(stepsForTask("overlay.source", { ...defaultProgress(), overlayId: "overlay" }).map((step) => step.target)).toContain("overlay-filters");
	const old = { ...defaultProgress(), overlayId: "overlay", completed: ["overlay.name", "appearance.filters"], skipped: ["appearance.filters"], active: { task: "appearance.filters", index: 0, paused: true } };
	const migrated = parseProgress(JSON.stringify(old));
	expect(migrated.completed).toEqual(["overlay.name", "overlay.source"]);
	expect(migrated.skipped).toEqual([]);
	expect(migrated.active).toMatchObject({ task: "overlay.source", index: 1, paused: true });
	expect(currentGuideStep(migrated)?.target).toBe("overlay-filters");
	expect(parseProgress(JSON.stringify({ ...old, active: { ...old.active, index: 1 } })).active?.index).toBe(2);
});

it("adds partial section credit without losing completed tasks or double counting replays", () => {
	const state: GuideProgress = { ...defaultProgress(), completed: ["overlay.name"], overlayId: "overlay", active: { task: "overlay.source", index: 0, paused: false } };
	expect(journeyGuidePercent(state)).toBe(38);
	expect(journeyGuidePercent({ ...state, active: { ...state.active!, index: 1 } })).toBeGreaterThan(38);
	expect(journeyGuidePercent({ ...state, active: { ...state.active!, paused: true } })).toBe(38);
	expect(journeyGuidePercent({ ...state, active: { task: "overlay.name", index: 1, paused: false } })).toBe(25);
	expect(journeyGuidePercent({ ...state, active: null })).toBe(25);
	expect(journeyGuidePercent({ ...state, completed: ["overlay.name", "overlay.source", "overlay.preview", "overlay.setup"], active: null })).toBe(100);
});

it("allows Back from every action step after the first, including filters", () => {
	let state: GuideProgress = { ...defaultProgress(), overlayId: "overlay", active: { task: "overlay.source", index: 2, paused: false } };
	state = apply(state, { type: "previous", location: "overlay" });
	expect(currentGuideStep(state)?.target).toBe("overlay-filters");
	state = apply(state, { type: "previous", location: "overlay" });
	expect(currentGuideStep(state)?.target).toBe("overlay-source");
	expect(apply(state, { type: "previous", location: "overlay" })).toEqual(state);
	expect(state.completed).toEqual([]);
});
it("guides search, selection and confirmation before advancing to arrangement on add", () => {
	const state: GuideProgress = { ...defaultProgress(), playlistId: "playlist", active: { task: "playlist.clips", index: 3, paused: false } };
	const steps = stepsForTask("playlist.clips", state);
	expect(steps.map((step) => step.target)).toEqual(["playlist-add", "playlist-clip-search", "playlist-clip-selection", "playlist-clip-confirm", "playlist-order", "playlist-save"]);
	expect(steps.slice(1, 4).every((step) => step.inDialog)).toBe(true);
	const added = apply(state, { type: "playlist.clips-added", ownerId: "owner", id: "playlist", count: 2 });
	expect(currentGuideStep(added)?.target).toBe("playlist-order");
	expect(added.completed).not.toContain("playlist.clips");
	for (const event of [
		{ ownerId: "foreign", id: "playlist", count: 2 },
		{ ownerId: "owner", id: "other", count: 2 },
		{ ownerId: "owner", id: "playlist", count: 0 },
	])
		expect(apply(state, { type: "playlist.clips-added", ...event }).active?.index).toBe(3);
});
it("reopens a saved picker checkpoint through Add Clips and keeps Back inside an open picker", () => {
	const state: GuideProgress = { ...defaultProgress(), playlistId: "playlist", active: { task: "playlist.clips", index: 3, paused: true } };
	const resumed = apply(state, { type: "resume", location: "playlist", pickerOpen: false });
	expect(resumed.active?.navigation).toEqual(["clip-picker"]);
	expect(currentGuideStep(apply(resumed, { type: "next" }))?.target).toBe("playlist-clip-confirm");
	const back = apply({ ...state, active: { ...state.active!, paused: false } }, { type: "previous", location: "playlist", pickerOpen: true });
	expect(back.active?.navigation).toEqual([]);
	expect(currentGuideStep(back)?.target).toBe("playlist-clip-selection");
});
it("migrates old arrangement/save checkpoints without interpreting them as modal steps", () => {
	const old = { ...defaultProgress(), playlistClipsVersion: undefined, playlistId: "playlist", active: { task: "playlist.clips", index: 1, paused: true } };
	expect(parseProgress(JSON.stringify(old)).active?.index).toBe(4);
	expect(parseProgress(JSON.stringify({ ...old, active: { ...old.active, index: 2 } })).active?.index).toBe(5);
	expect(parseProgress(JSON.stringify({ ...old, playlistClipsVersion: 2 })).active?.index).toBe(1);
});
it("ends optional sections without starting a different section", () => {
	const styled = apply({ ...defaultProgress(), overlayId: "overlay", active: { task: "appearance.style", index: 2, paused: false } }, { type: "theme.saved", ownerId: "owner", id: "overlay", changed: true });
	expect(styled.active).toBeNull();
	const installed = apply({ ...defaultProgress(), overlayId: "overlay", playlistId: "playlist", active: { task: "playlist.use", index: 2, paused: false } }, { type: "overlay.saved", ownerId: "owner", id: "overlay", named: true, source: false, playlistId: "playlist" });
	expect(installed.active).toBeNull();
});

it("returns from modal search to the real Add Clips entry instead of trapping Back", () => {
	const state: GuideProgress = { ...defaultProgress(), playlistId: "playlist", active: { task: "playlist.clips", index: 1, paused: false } };
	const back = apply(state, { type: "previous", location: "playlist", pickerOpen: true });
	expect(back.active).toMatchObject({ index: 0, navigation: ["close-picker"] });
	expect(currentGuideStep(back)?.dialogClosed).toBe(true);
	expect(currentGuideStep(apply(back, { type: "next" }))?.target).toBe("playlist-add");
});

it("advances playlist source selection automatically and recovers when its type changes away", () => {
	let state: GuideProgress = { ...defaultProgress(), overlayId: "overlay", playlistId: "playlist", active: { task: "playlist.use", index: 0, paused: false } };
	expect(currentGuideStep(state)?.nextDisabled).toBe(true);
	expect(apply(state, { type: "next" }).active?.index).toBe(0);
	state = apply(state, { type: "overlay.type-selected", ownerId: "owner", id: "overlay", playlist: true });
	expect(state.active).toMatchObject({ index: 1, paused: false });
	state = apply(state, { type: "previous", location: "overlay" });
	expect(state.active?.index).toBe(0);
	expect(currentGuideStep(state)?.nextDisabled).toBe(false);
	state = apply(state, { type: "overlay.type-selected", ownerId: "owner", id: "overlay", playlist: false });
	expect(state.active).toMatchObject({ index: 0, paused: false });
	expect(state.completed).not.toContain("playlist.use");
	const stale = { ...state, active: { task: "playlist.use" as const, index: 1, paused: true } };
	expect(apply(stale, { type: "resume", location: "overlay" }).active).toMatchObject({ index: 0, paused: false });
	expect(apply(state, { type: "overlay.type-selected", ownerId: "foreign", id: "overlay", playlist: true })).toEqual(state);
});
it("advances on playlist selection and completes when that selected playlist is saved", () => {
	const initial: GuideProgress = { ...defaultProgress(), overlayId: "overlay", playlistId: "old", playlistSource: true, active: { task: "playlist.use", index: 1, paused: false } };
	const event = { type: "overlay.playlist-selected" as const, ownerId: "owner", id: "overlay", playlistId: "chosen" };
	expect(apply(initial, { ...event, ownerId: "other" })).toEqual(initial);
	expect(apply(initial, { ...event, id: "other" })).toEqual(initial);
	const selected = apply(initial, event);
	expect(selected.active?.index).toBe(2);
	expect(selected.playlistId).toBe("chosen");
	const saved = apply(selected, { type: "overlay.saved", ownerId: "owner", id: "overlay", named: true, source: true, playlistId: "chosen" });
	expect(saved.completed).toContain("playlist.use");
});
it("offers an explicit way past unchanged overlay save steps", () => {
	for (const task of ["overlay.name", "playlist.use"] as const) {
		const state: GuideProgress = { ...defaultProgress(), overlayId: "overlay", playlistId: "playlist", active: { task, index: 2, paused: false } };
		expect(currentGuideStep(state)).toMatchObject({ next: true, nextLabel: "Use current settings" });
		expect(apply(state, { type: "next" }).completed).toContain(task);
	}
});
it("starts welcome guidance at the first unfinished core task and remembers the decision", () => {
	const state = { ...defaultProgress(), completed: ["overlay.name" as const] };
	const started = apply(state, { type: "welcome.start", location: "dashboard" });
	expect(started.welcomeSeen).toBe(true);
	expect(started.active?.task).toBe("overlay.source");
	const dismissed = apply(defaultProgress(), { type: "welcome.dismiss" });
	expect(dismissed).toMatchObject({ welcomeSeen: true, minimized: true, active: null });
	expect(parseProgress(JSON.stringify(dismissed)).welcomeSeen).toBe(true);
});
it("requires every guide task for Expert, with no credit for skipped tasks", () => {
	const tasks = journeys.flatMap((journey) => journey.tasks.map((task) => task.id));
	expect(tasks).toHaveLength(15);
	expect(hasCompletedAllGuides({ ...defaultProgress(), completed: tasks })).toBe(true);
	for (const missing of tasks) {
		expect(hasCompletedAllGuides({ ...defaultProgress(), completed: tasks.filter((task) => task !== missing), skipped: [missing] })).toBe(false);
	}
	expect(hasCompletedAllGuides({ ...defaultProgress(), completed: journeys[0].tasks.map((task) => task.id) })).toBe(false);
});
it("discards old core-only awards but preserves a versioned Expert award during replay", () => {
	const expertAwardedAt = "2026-10-26T12:00:00.000Z";
	expect(parseProgress(JSON.stringify({ ...defaultProgress(), expertAwardedAt })).expertAwardedAt).toBeUndefined();
	expect(parseProgress(JSON.stringify({ ...defaultProgress(), expertAwardedAt, expertAwardVersion: 2 }))).toMatchObject({ expertAwardedAt, expertAwardVersion: 2 });
});

it("counts guided confirmations as completion and clears a prior skip for every settings flow", () => {
	for (const task of ["overlay.name", "overlay.source", "appearance.style", "playlist.name", "playlist.clips", "playlist.use"] as const) {
		const progress = { ...defaultProgress(), overlayId: "overlay", playlistId: "playlist", skipped: [task] };
		const index = stepsForTask(task, progress).length - 1;
		const completed = apply({ ...progress, active: { task, index, paused: false } }, { type: "next" });
		expect(completed.completed).toContain(task);
		expect(completed.skipped).not.toContain(task);
	}
});
it("finishes the guided overlay save using the editor's actual playlist rather than a stale tutorial ID", () => {
	const state: GuideProgress = { ...defaultProgress(), overlayId: "overlay", playlistId: "tutorial-playlist", active: { task: "playlist.use", index: 2, paused: false } };
	const saved = { type: "overlay.saved" as const, ownerId: "owner", id: "overlay", named: true, source: true, playlistId: "preselected-playlist" };
	const completed = apply(state, saved);
	expect(completed.completed).toContain("playlist.use");
	expect(completed.playlistId).toBe("preselected-playlist");
	expect(completed.active).toBeNull();
	expect(apply(state, { ...saved, ownerId: "other" })).toEqual(state);
	expect(apply(state, { ...saved, id: "another-overlay", playlistId: "tutorial-playlist" }).completed).not.toContain("playlist.use");
	expect(apply(state, { ...saved, playlistId: null }).completed).not.toContain("playlist.use");
});
it("teaches Settings, AI and Team through the avatar menu and native tabs", () => {
	for (const task of ["explore.settings", "explore.ai", "explore.editors"] as const) {
		const state = apply(defaultProgress(), { type: "start", task, location: "dashboard" });
		expect(state.active?.navigation).toEqual(task === "explore.editors" ? ["profile", "account-settings", "team"] : ["profile", "account-settings"]);
		const menu = apply(state, { type: "next" });
		expect(currentGuideStep(menu)).toMatchObject({ target: "nav-settings", destination: "settings" });
		const settings = apply(menu, { type: "location", location: "settings" });
		expect(currentGuideStep(settings)?.target).toBe(task === "explore.editors" ? "settings-team-tab" : task === "explore.ai" ? "settings-connections-tab" : "settings-core-tab");
		if (task === "explore.editors") expect(currentGuideStep(apply(settings, { type: "location", location: "team" }))?.target).toBe("team-overview");
	}
});
it("returns from Team to account settings using the real Settings tab", () => {
	for (const task of ["explore.settings", "explore.ai"] as const) {
		const state = apply(defaultProgress(), { type: "start", task, location: "team" });
		expect(state.active?.navigation).toEqual(["core-settings"]);
		expect(currentGuideStep(state)?.target).toBe("settings-core-tab");
		expect(apply(state, { type: "location", location: "settings" }).active?.navigation).toEqual([]);
	}
});
it("keeps discovery guides informational and separately started", () => {
	for (const task of ["explore.runners", "explore.settings", "explore.ai", "explore.editors"] as const) {
		const steps = stepsForTask(task, defaultProgress());
		expect(steps.at(-1)).toMatchObject({ next: true, finish: true, nextLabel: "Done" });
		const state: GuideProgress = { ...defaultProgress(), active: { task, index: steps.length - 1, paused: false } };
		const done = apply(state, { type: "next" });
		expect(done.completed).toContain(task);
		expect(done.active).toBeNull();
	}
});
it("restores discovery checkpoints with validated new locations and navigation", () => {
	const state = apply(defaultProgress(), { type: "start", task: "explore.ai", location: "settings" });
	const next = apply(state, { type: "next" });
	expect(currentGuideStep(next)?.target).toBe("connected-ai-apps");
	expect(currentGuideStep(apply(next, { type: "previous", location: "settings" }))?.target).toBe("settings-connections-tab");
	expect(parseProgress(JSON.stringify(next)).active).toMatchObject({ task: "explore.ai", index: 1, paused: true });
	expect(apply(defaultProgress(), { type: "start", task: "explore.runners", location: "tools" }).active?.navigation).toEqual(["home"]);
});
it("reopens the Settings panel when resuming a discovery checkpoint on another local settings tab", () => {
	const state: GuideProgress = { ...defaultProgress(), active: { task: "explore.ai", index: 2, paused: true } };
	const resumed = apply(state, { type: "resume", location: "settings" });
	expect(resumed.active?.navigation).toEqual(["connections-panel"]);
	expect(currentGuideStep(resumed)?.target).toBe("settings-connections-tab");
	expect(currentGuideStep(apply(resumed, { type: "next" }))?.target).toBe("ai-connection-help");
});

it("recognizes settings routes and teaches every discovery entry point", () => {
	expect(guideLocation("/dashboard/settings")).toBe("settings");
	expect(guideLocation("/dashboard/settings/team")).toBe("team");
	expect(navigationForTask("explore.editors", "team", defaultProgress())).toEqual([]);
	expect(navigationForTask("explore.editors", "settings", defaultProgress())).toEqual(["team"]);
	expect(navigationForTask("explore.settings", "settings", defaultProgress())).toEqual([]);
	expect(navigationForTask("explore.ai", "settings", defaultProgress(), 2)).toEqual(["connections-panel"]);
	for (const task of ["explore.settings", "explore.ai"] as const) expect(routeForTask(task, defaultProgress())).toBe("/dashboard/settings");
	expect(routeForTask("explore.editors", defaultProgress())).toBe("/dashboard/settings/team");
	expect(routeForTask("explore.runners", defaultProgress())).toBe("/dashboard");
	const state = apply({ ...defaultProgress(), active: { task: "explore.ai", index: 2, paused: true } }, { type: "resume", location: "settings" });
	expect(parseProgress(JSON.stringify(state)).active?.navigation).toEqual(["connections-panel"]);
});

it("migrates saved AI checkpoints to the Connections panel without losing progress", () => {
	const state: GuideProgress = { ...defaultProgress(), active: { task: "explore.ai", index: 2, paused: true, navigation: ["settings-panel"] } };
	const restored = parseProgress(JSON.stringify(state));
	expect(restored.active).toMatchObject({ task: "explore.ai", index: 2, navigation: ["connections-panel"] });
	expect(currentGuideStep(restored)).toMatchObject({ target: "settings-connections-tab", reveals: "connected-ai-apps" });
});
