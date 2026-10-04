import { OBS_ACTIVITY_BOOTSTRAP, startOverlayPresence } from "@lib/overlayPresence";
import { DEPLOYMENT_CHECK_EVENT } from "@lib/deployment";

type ObsWindow = Window & { obsstudio?: { onActiveChange?: (active: boolean) => void }; __clipifyObsActive?: boolean };
const obsWindow = window as ObsWindow;
class Socket extends EventTarget {
	readyState: number = WebSocket.OPEN;
	send = jest.fn();
}
let socket: Socket;
let stop: (() => void) | undefined;
const reports = () => socket.send.mock.calls.map((call) => JSON.parse(call[0]));
const activity = (active: unknown) => window.dispatchEvent(new CustomEvent("obsSourceActiveChanged", { detail: { active } }));
const acknowledge = (target = socket) => target.dispatchEvent(new MessageEvent("message", { data: "subscribed overlay" }));
const start = (target = socket) => startOverlayPresence(target as unknown as WebSocket, "overlay");

beforeEach(() => {
	jest.useFakeTimers();
	socket = new Socket();
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
	stop = start();
	acknowledge();
	activity(true);
	expect(socket.send).not.toHaveBeenCalled();
});
it("leaves unknown and preview-only sources unconfirmed", () => {
	stop = start();
	acknowledge();
	window.dispatchEvent(new CustomEvent("obsSourceVisibleChanged", { detail: { visible: true } }));
	activity("true");
	expect(socket.send).not.toHaveBeenCalled();
});
it("sends only state changes after subscription, without periodic heartbeats", () => {
	stop = start();
	activity(true);
	expect(socket.send).not.toHaveBeenCalled();
	acknowledge();
	activity(true);
	jest.advanceTimersByTime(5 * 60_000);
	activity(false);
	expect(reports()).toEqual([
		{ type: "source_activity", data: { active: true } },
		{ type: "source_activity", data: { active: false } },
	]);
});
it("supports legacy callbacks and checks deployment once on activation", () => {
	const check = jest.fn();
	window.addEventListener(DEPLOYMENT_CHECK_EVENT, check);
	const previous = jest.fn();
	obsWindow.obsstudio!.onActiveChange = previous;
	stop = start();
	acknowledge();
	obsWindow.obsstudio!.onActiveChange!(true);
	activity(true);
	expect(reports()).toHaveLength(1);
	expect(previous).toHaveBeenCalledWith(true);
	expect(check).toHaveBeenCalledTimes(1);
	activity(false);
	expect(check).toHaveBeenCalledTimes(1);
	window.removeEventListener(DEPLOYMENT_CHECK_EVENT, check);
	stop();
	stop = undefined;
	expect(obsWindow.obsstudio!.onActiveChange).toBe(previous);
});
it("captures activation before hydration and resends the latest state after reconnect", () => {
	window.eval(OBS_ACTIVITY_BOOTSTRAP);
	obsWindow.obsstudio!.onActiveChange!(true);
	stop = start();
	acknowledge();
	expect(reports()[0].data.active).toBe(true);
	stop();
	stop = undefined;
	socket = new Socket();
	stop = start();
	acknowledge();
	expect(reports()).toEqual([{ type: "source_activity", data: { active: true } }]);
});
it("clears presence on pagehide and removes listeners on cleanup", () => {
	stop = start();
	acknowledge();
	activity(true);
	window.dispatchEvent(new Event("pagehide"));
	expect(reports().map((report) => report.data.active)).toEqual([true, false]);
	expect(obsWindow.__clipifyObsActive).toBeUndefined();
	stop();
	stop = undefined;
	const count = reports().length;
	activity(true);
	acknowledge();
	expect(reports()).toHaveLength(count);
});
it("does not send to closed sockets", () => {
	stop = start();
	acknowledge();
	socket.readyState = WebSocket.CLOSED;
	activity(true);
	expect(socket.send).not.toHaveBeenCalled();
});
it("keeps separate reports for multiple source connections", () => {
	stop = start();
	const other = new Socket();
	const stopOther = start(other);
	acknowledge();
	acknowledge(other);
	activity(true);
	expect(socket.send).toHaveBeenCalledTimes(1);
	expect(other.send).toHaveBeenCalledTimes(1);
	stopOther();
});
