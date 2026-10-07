/** @jest-environment node */
let runtime: any;
try {
	runtime = require("@/server/resources/player-runtime");
} catch {}
describe("TDD-US1-STATE bounded authenticated player state", () => {
	test("accepts known fields while projecting credentials and untrusted identity away", () => {
		expect(runtime?.recordPlayerRuntime).toEqual(expect.any(Function));
		runtime.recordPlayerRuntime("authenticated-overlay", { kind: "now_playing", overlayId: "forged-overlay", clipId: "Clip", title: "Title", duration: 12, currentTime: 3, secret: "private" }, 1000);
		const read = runtime.getPlayerRuntime("authenticated-overlay", true, 1100);
		expect(read.nowPlaying).toMatchObject({ clipId: "Clip", currentTime: 3 });
		expect(JSON.stringify(read)).not.toContain("private");
		expect(runtime.getPlayerRuntime("forged-overlay", true, 1100).status).toBe("unavailable");
	});
	test("reports stale and disconnected rather than claiming current playback", () => {
		expect(runtime?.recordPlayerRuntime).toEqual(expect.any(Function));
		runtime.recordPlayerRuntime("stale", { kind: "heartbeat", playerAttached: true, paused: false, showPlayer: true, standby: false }, 1000);
		expect(runtime.getPlayerRuntime("stale", true, 1100).status).toBe("connected");
		expect(runtime.getPlayerRuntime("stale", true, 9000).status).toBe("stale");
		expect(runtime.getPlayerRuntime("stale", false, 1100).status).toBe("disconnected");
	});
	test("ignores malformed and unsupported report kinds", () => {
		expect(runtime?.recordPlayerRuntime).toEqual(expect.any(Function));
		expect(runtime.recordPlayerRuntime("bad", { kind: "playback_state", volume: 101, paused: false, showPlayer: true, muted: false })).toBe(false);
		expect(runtime.recordPlayerRuntime("bad", { kind: "arbitrary", token: "credential" })).toBe(false);
	});
});

export {};

describe("runtime retention and report freshness boundaries", () => {
	beforeEach(() => globalThis.__clipifyPlayerReports?.clear());
	test("an attached websocket without an attached player is explicit", () => {
		runtime.recordPlayerRuntime("detached", { kind: "heartbeat", playerAttached: false, paused: true, showPlayer: false, standby: true }, 1000);
		expect(runtime.getPlayerRuntime("detached", true, 1000).status).toBe("player_missing");
	});
	test("a fresh clip report does not renew an old heartbeat", () => {
		runtime.recordPlayerRuntime("old-heartbeat", { kind: "heartbeat", playerAttached: true, paused: false, showPlayer: true, standby: false }, 1000);
		runtime.recordPlayerRuntime("old-heartbeat", { kind: "now_playing", clipId: "Clip", title: "Title", duration: 12, currentTime: 1 }, 7000);
		const row = runtime.getPlayerRuntime("old-heartbeat", true, 7100);
		expect(row.status).toBe("stale");
		expect(row.nowPlaying.stale).toBe(false);
		expect(row.heartbeat.stale).toBe(true);
	});
	test("writing a report expires records older than sixty seconds", () => {
		const heartbeat = { kind: "heartbeat", playerAttached: true, paused: false, showPlayer: true, standby: false };
		runtime.recordPlayerRuntime("old", heartbeat, 1000);
		runtime.recordPlayerRuntime("current", heartbeat, 61001);
		expect(runtime.getPlayerRuntime("old", true, 61001).status).toBe("unavailable");
		expect(runtime.getPlayerRuntime("current", true, 61001).status).toBe("connected");
	});
	test("bounded retention evicts the oldest untouched player while retaining the newest", () => {
		const heartbeat = { kind: "heartbeat", playerAttached: true, paused: false, showPlayer: true, standby: false };
		for (let n = 0; n <= 1000; n++) runtime.recordPlayerRuntime(`player-${n}`, heartbeat, 1000);
		expect(runtime.getPlayerRuntime("player-0", true, 1000).status).toBe("unavailable");
		expect(runtime.getPlayerRuntime("player-1000", true, 1000).status).toBe("connected");
		expect(globalThis.__clipifyPlayerReports?.size).toBe(1000);
	});
	test("queue reports project clip metadata without credentials", () => {
		runtime.recordPlayerRuntime("queue", { kind: "queue_preview", items: [{ clipId: "Clip", title: "Title", duration: 12, token: "private" }] }, 1000);
		const row = runtime.getPlayerRuntime("queue", true, 1000);
		expect(row.queuePreview.items).toEqual([{ clipId: "Clip", title: "Title", creatorName: null, duration: 12, thumbnailUrl: null }]);
		expect(JSON.stringify(row)).not.toContain("private");
	});
});
