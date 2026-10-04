import { requestDeploymentCheck } from "./deployment";

// Install before hydration so OBS changes during page startup are not lost.
// Visibility includes Studio Mode's preview; only active confirms program output.
export const OBS_ACTIVITY_BOOTSTRAP = `(() => {
  const obs = window.obsstudio;
  if (!obs) return;
  const update = (active) => {
    if (typeof active === 'boolean') window.__clipifyObsActive = active;
  };
  window.addEventListener('obsSourceActiveChanged', (event) => update(event.detail && event.detail.active));
  const previous = obs.onActiveChange;
  obs.onActiveChange = (active) => {
    update(active);
    if (typeof previous === 'function') previous.call(obs, active);
  };
})();`;

type ObsWindow = Window & {
	obsstudio?: { onActiveChange?: (active: boolean) => void };
	__clipifyObsActive?: boolean;
};

export function startOverlayPresence(socket: WebSocket, overlayId: string): () => void {
	const obsWindow = window as ObsWindow;
	const obs = obsWindow.obsstudio;
	if (!obs) return () => {};

	let active = obsWindow.__clipifyObsActive;
	let subscribed = false;
	let stopped = false;
	const report = (isActive: boolean) => {
		if (subscribed && socket.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify({ type: "source_activity", data: { active: isActive } }));
		}
	};
	const update = (value: unknown) => {
		if (stopped || typeof value !== "boolean" || value === active) return;
		active = value;
		obsWindow.__clipifyObsActive = value;
		if (value) requestDeploymentCheck();
		report(value);
	};
	const onActive = (event: Event) => update((event as CustomEvent<{ active?: unknown }>).detail?.active);
	const previous = obs.onActiveChange;
	const legacyCallback = (value: boolean) => {
		update(value);
		previous?.call(obs, value);
	};
	obs.onActiveChange = legacyCallback;
	window.addEventListener("obsSourceActiveChanged", onActive);
	// Report only after the existing secret-authenticated subscription succeeds.
	// A new connection re-sends the latest state without waiting for another event.
	const onMessage = (event: MessageEvent) => {
		if (event.data !== `subscribed ${overlayId}` || subscribed) return;
		subscribed = true;
		if (typeof active === "boolean") report(active);
	};
	socket.addEventListener("message", onMessage);
	const onPageHide = () => {
		active = undefined;
		obsWindow.__clipifyObsActive = undefined;
		report(false);
	};
	window.addEventListener("pagehide", onPageHide);
	return () => {
		report(false);
		stopped = true;
		window.removeEventListener("obsSourceActiveChanged", onActive);
		window.removeEventListener("pagehide", onPageHide);
		socket.removeEventListener("message", onMessage);
		if (obs.onActiveChange === legacyCallback) obs.onActiveChange = previous;
	};
}
