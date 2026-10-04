import { OBS_ACTIVITY_BOOTSTRAP, OVERLAY_PRESENCE_INTERVAL_MS, startOverlayPresence } from "@lib/overlayPresence";

type ObsWindow = Window & { obsstudio?: { onActiveChange?: (active: boolean) => void }; __clipifyObsActive?: boolean };
const obsWindow = window as ObsWindow;
const fetchMock = jest.fn();
let stop: (() => void) | undefined;
const reports = () => fetchMock.mock.calls.map((call) => JSON.parse(call[1].body));
const activity = (active: unknown) => window.dispatchEvent(new CustomEvent("obsSourceActiveChanged", { detail: { active } }));

beforeEach(() => {
	jest.useFakeTimers();
	fetchMock.mockReset().mockResolvedValue({ ok: true });
	global.fetch = fetchMock;
	obsWindow.obsstudio = {};
	delete obsWindow.__clipifyObsActive;
});
afterEach(() => {
	stop?.();
	stop = undefined;
	delete obsWindow.obsstudio;
	delete obsWindow.__clipifyObsActive;
	jest.useRealTimers();
});

it("does not report regular browser visits", () => {
	delete obsWindow.obsstudio;
	stop = startOverlayPresence("overlay", "secret");
	activity(true);
	jest.advanceTimersByTime(OVERLAY_PRESENCE_INTERVAL_MS * 3);
	expect(fetchMock).not.toHaveBeenCalled();
});

it("leaves unknown and preview-only sources unconfirmed", () => {
	stop = startOverlayPresence("overlay", "secret");
	window.dispatchEvent(new CustomEvent("obsSourceVisibleChanged", { detail: { visible: true } }));
	activity("true");
	jest.advanceTimersByTime(OVERLAY_PRESENCE_INTERVAL_MS * 3);
	expect(fetchMock).not.toHaveBeenCalled();
});

it("reports activation, heartbeats, and deactivation with increasing sequence numbers", () => {
	stop = startOverlayPresence("overlay", "secret");
	activity(true);
	activity(true);
	jest.advanceTimersByTime(OVERLAY_PRESENCE_INTERVAL_MS);
	activity(false);
	jest.advanceTimersByTime(OVERLAY_PRESENCE_INTERVAL_MS * 2);
	expect(reports().map(({ active, sequence }) => ({ active, sequence }))).toEqual([
		{ active: true, sequence: 1 },
		{ active: true, sequence: 2 },
		{ active: false, sequence: 3 },
	]);
	expect(new Set(reports().map((report) => report.instanceId)).size).toBe(1);
	expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer secret");
	expect(fetchMock.mock.calls[0][1].body).not.toContain("secret");
});

it("supports legacy callbacks without duplicating modern events or replacing previous listeners", () => {
	const previous = jest.fn();
	obsWindow.obsstudio!.onActiveChange = previous;
	stop = startOverlayPresence("overlay", "secret");
	obsWindow.obsstudio!.onActiveChange!(true);
	activity(true);
	expect(reports()).toHaveLength(1);
	expect(previous).toHaveBeenCalledWith(true);
	stop();
	stop = undefined;
	expect(obsWindow.obsstudio!.onActiveChange).toBe(previous);
	activity(true);
	expect(reports().map((report) => report.active)).toEqual([true, false]);
});

it("captures activation before hydration", () => {
	window.eval(OBS_ACTIVITY_BOOTSTRAP);
	obsWindow.obsstudio!.onActiveChange!(true);
	stop = startOverlayPresence("overlay", "secret");
	expect(reports()[0].active).toBe(true);
});

it("clears presence on pagehide and stops renewing it", () => {
	stop = startOverlayPresence("overlay", "secret");
	activity(true);
	window.dispatchEvent(new Event("pagehide"));
	jest.advanceTimersByTime(OVERLAY_PRESENCE_INTERVAL_MS * 3);
	expect(reports().map((report) => report.active)).toEqual([true, false]);
	expect(obsWindow.__clipifyObsActive).toBeUndefined();
});

it("uses separate instance ids when the same overlay has multiple sources", () => {
	stop = startOverlayPresence("overlay", "secret");
	const stopOther = startOverlayPresence("overlay", "secret");
	activity(true);
	expect(new Set(reports().map((report) => report.instanceId)).size).toBe(2);
	stopOther();
});

it("tolerates heartbeat network failures", async () => {
	fetchMock.mockRejectedValue(new Error("offline"));
	stop = startOverlayPresence("overlay", "secret");
	activity(true);
	await Promise.resolve();
	jest.advanceTimersByTime(OVERLAY_PRESENCE_INTERVAL_MS);
	expect(reports()).toHaveLength(2);
});
