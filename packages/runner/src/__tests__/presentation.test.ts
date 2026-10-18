import { createPlaybackDrain, type PlaybackClip } from "../presentation";

test("TDD-US1-FR004 only the matching generation drains all already-playing crossfade slots", () => {
	const clips: PlaybackClip[] = [
		{ id: "a", time: 8, duration: 12, started: true, ended: false },
		{ id: "b", time: 1, duration: 10, started: true, ended: false },
		{ id: "queued", time: 0, duration: 10, started: false, ended: false },
		{ id: "retired", time: 10, duration: 10, started: true, ended: true },
	];
	const preventNext = jest.fn();
	const player = createPlaybackDrain({ generation: "current", readClips: () => clips, preventNext });
	player.notifyEnded("a");
	expect(player.canAdvance()).toBe(true);
	expect(player.requestDrain("old").state).toBe("playing");
	expect(preventNext).not.toHaveBeenCalled();
	expect(player.requestDrain("current")).toMatchObject({ state: "draining", pendingClipIds: ["a", "b"] });
	expect(player.canAdvance()).toBe(false);
	player.requestDrain("current");
	expect(preventNext).toHaveBeenCalledTimes(1);
	player.notifyEnded("unknown");
	player.notifyEnded("a");
	expect(player.snapshot()).toMatchObject({ state: "draining", pendingClipIds: ["b"] });
	player.notifyEnded("b");
	player.notifyEnded("b");
	expect(player.snapshot()).toMatchObject({ state: "drained", pendingClipIds: [] });
	expect(player.canAdvance()).toBe(false);
});

test("TDD-US1-FR004 standby without a started clip drains promptly and cannot advance", () => {
	const preventNext = jest.fn();
	const player = createPlaybackDrain({ generation: "standby", readClips: () => [], preventNext });
	expect(player.requestDrain("standby")).toEqual({ generation: "standby", state: "drained", clips: [], pendingClipIds: [] });
	expect(preventNext).toHaveBeenCalledTimes(1);
	expect(player.canAdvance()).toBe(false);
});

test("TDD-US3-EC010: a generation-bound deadline replacement fences the next clip at the original end and cannot revive draining playback", () => {
	let now = 100;
	const preventNext = jest.fn();
	const player = createPlaybackDrain({ generation: "current", deadlineMonotonic: 300, now: () => now, readClips: () => [{ id: "clip", time: 10, duration: 12, started: true, ended: false }], preventNext });
	const update = Reflect.get(player, "updateDeadline");
	expect(typeof update).toBe("function");
	update("stale", 150);
	now = 150;
	expect(player.canAdvance()).toBe(true);
	update("current", 200);
	now = 199;
	expect(player.canAdvance()).toBe(true);
	now = 200;
	expect(player.canAdvance()).toBe(false);
	expect(player.snapshot()).toMatchObject({ state: "draining", pendingClipIds: ["clip"] });
	update("current", 400);
	expect(player.canAdvance()).toBe(false);
	player.notifyEnded("clip");
	expect(player.snapshot().state).toBe("drained");
	expect(preventNext).toHaveBeenCalledTimes(1);
});
