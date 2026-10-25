import { defaultProgress, journeys, parseProgress, routeForTask, storageKey, transition, type GuideEvent } from "@lib/userTour";

describe("user tour progress", () => {
	const apply = (event: GuideEvent, progress = defaultProgress()) => transition(progress, event, "owner");
	it("offers five bounded sections and a four-task activation path", () => {
		expect(journeys.map((journey) => journey.id)).toEqual(["overlay", "appearance", "playlist", "website", "explore"]);
		expect(journeys[0].tasks).toHaveLength(4);
		expect(defaultProgress().completed).toEqual([]);
	});
	it.each([null, "{", "null", "[]", '{"version":2}', '{"version":1,"completed":"all"}'])("recovers invalid storage %s", (raw) => {
		expect(parseProgress(raw)).toEqual(defaultProgress());
	});
	it("validates and deduplicates persisted fields and restores tours paused", () => {
		const parsed = parseProgress(JSON.stringify({ version: 1, completed: ["overlay.name", "overlay.name", "unknown"], overlayId: "../../secret", playlistId: "playlist-1", active: { task: "overlay.source", index: 999 }, minimized: false }));
		expect(parsed.completed).toEqual(["overlay.name"]);
		expect(parsed.overlayId).toBeNull();
		expect(parsed.playlistId).toBe("playlist-1");
		expect(parsed.active).toBeNull();
		const resumed = parseProgress(JSON.stringify({ ...defaultProgress(), overlayId: "overlay-1", active: { task: "overlay.name", index: 1, paused: false } }));
		expect(resumed.active?.paused).toBe(true);
	});
	it("keeps account keys distinct", () => {
		expect(storageKey("a")).not.toBe(storageKey("b"));
	});
	it("selects an owned existing overlay without claiming actions", () => {
		const next = apply({ type: "overlay.ready", ownerId: "owner", id: "overlay-1" });
		expect(next.overlayId).toBe("overlay-1");
		expect(next.completed).toEqual([]);
		expect(apply({ type: "overlay.ready", ownerId: "other", id: "foreign" })).toEqual(defaultProgress());
	});
	it("recognizes successful saved configuration independently of tours", () => {
		const next = apply({ type: "overlay.saved", ownerId: "owner", id: "overlay-1", named: true, source: true });
		expect(next.completed).toEqual(["overlay.name", "overlay.source"]);
		expect(apply({ type: "overlay.saved", ownerId: "owner", id: "overlay-1", named: false, source: false }).completed).toEqual([]);
	});
	it("requires nonempty preview and successful copy plus explicit setup confirmation", () => {
		let next = apply({ type: "overlay.ready", ownerId: "owner", id: "overlay-1" });
		next = apply({ type: "overlay.previewed", ownerId: "owner", id: "overlay-1", count: 0 }, next);
		expect(next.completed).not.toContain("overlay.preview");
		next = apply({ type: "overlay.previewed", ownerId: "owner", id: "overlay-1", count: 3 }, next);
		expect(next.completed).toContain("overlay.preview");
		expect(apply({ type: "setup.confirmed" }, next).completed).not.toContain("overlay.setup");
		next = apply({ type: "overlay.copied", ownerId: "owner", id: "overlay-1" }, next);
		expect(next.completed).not.toContain("overlay.setup");
		expect(apply({ type: "setup.confirmed" }, next).completed).toContain("overlay.setup");
		expect(apply({ type: "overlay.copied", ownerId: "owner", id: "unrelated" }, next)).toEqual(next);
	});
	it("requires a successful visible style change", () => {
		expect(apply({ type: "theme.saved", ownerId: "owner", id: "overlay-1", changed: false }).completed).toEqual([]);
		expect(apply({ type: "theme.saved", ownerId: "owner", id: "overlay-1", changed: true }).completed).toContain("appearance.style");
	});
	it("tracks playlist name, populated saved order, and the selected association", () => {
		let next = apply({ type: "playlist.saved", ownerId: "owner", id: "playlist-1", named: true, count: 0 });
		expect(next.completed).toEqual(["playlist.name"]);
		next = apply({ type: "playlist.saved", ownerId: "owner", id: "playlist-1", named: true, count: 2 }, next);
		expect(next.completed).toEqual(["playlist.name", "playlist.clips"]);
		expect(apply({ type: "overlay.saved", ownerId: "owner", id: "overlay-1", named: true, source: true, playlistId: "other" }, next).completed).not.toContain("playlist.use");
		expect(apply({ type: "overlay.saved", ownerId: "owner", id: "overlay-1", named: true, source: true, playlistId: "playlist-1" }, next).completed).toContain("playlist.use");
	});
	it("starts, pauses, resumes and replays without changing resource identities", () => {
		let next = apply({ type: "overlay.ready", ownerId: "owner", id: "overlay-1" });
		next = apply({ type: "start", task: "overlay.name" }, next);
		expect(next.active).toEqual({ task: "overlay.name", index: 0, paused: false });
		next = apply({ type: "pause" }, next);
		expect(next.active?.paused).toBe(true);
		next = apply({ type: "resume" }, next);
		expect(next.active?.paused).toBe(false);
		next = apply({ type: "next" }, next);
		expect(next.completed).toEqual([]);
		expect(next.overlayId).toBe("overlay-1");
	});
	it("finishes the active task only when its actual completion condition occurs", () => {
		const next = apply({ type: "start", task: "overlay.name" });
		expect(apply({ type: "overlay.saved", ownerId: "owner", id: "overlay-1", named: true, source: true }, next).active).toMatchObject({ done: true });
	});
	it("routes tasks to existing resources and missing prerequisites to the dashboard", () => {
		const next = { ...defaultProgress(), overlayId: "overlay-1", playlistId: "playlist-1" };
		expect(routeForTask("appearance.style", next)).toBe("/dashboard/overlay/overlay-1");
		expect(routeForTask("playlist.clips", next)).toBe("/dashboard/playlist/playlist-1");
		expect(routeForTask("playlist.use", next)).toBe("/dashboard/overlay/overlay-1");
		expect(routeForTask("overlay.name", defaultProgress())).toBe("/dashboard");
	});
	it("returns playlist association to its missing playlist prerequisite", () => {
		const state = { ...defaultProgress(), overlayId: "overlay-1" };
		expect(routeForTask("playlist.use", state)).toBe("/dashboard");
	});
	it("lets users explicitly replace a missing resource without losing completed work", () => {
		const state = { ...defaultProgress(), overlayId: "deleted", copiedOverlayId: "deleted", completed: ["overlay.name" as const], active: { task: "overlay.source" as const, index: 1, paused: true } };
		const reset = apply({ type: "resource.reset", resource: "overlay" }, state);
		expect(reset.overlayId).toBeNull();
		expect(reset.copiedOverlayId).toBeNull();
		expect(reset.completed).toEqual(["overlay.name"]);
		expect(reset.active).toEqual({ task: "overlay.source", index: 0, paused: true });
	});

	it("uses an explicitly opened owned resource instead of a stale dashboard choice", () => {
		const state = { ...defaultProgress(), overlayId: "old", copiedOverlayId: "old" };
		const selected = apply({ type: "overlay.ready", ownerId: "owner", id: "opened", select: true }, state);
		expect(selected.overlayId).toBe("opened");
		expect(selected.copiedOverlayId).toBeNull();
		expect(apply({ type: "overlay.ready", ownerId: "other", id: "foreign", select: true }, state)).toEqual(state);
	});
});
