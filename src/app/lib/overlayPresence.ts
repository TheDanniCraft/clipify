export const OVERLAY_PRESENCE_INTERVAL_MS = 25_000;
export const OVERLAY_PRESENCE_TTL_MS = 75_000;
export const OVERLAY_PRESENCE_CACHE_PREFIX = "overlay-presence:";

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

export function startOverlayPresence(overlayId: string, secret: string): () => void {
	const obsWindow = window as ObsWindow;
	const obs = obsWindow.obsstudio;
	if (!obs) return () => {};

	const instanceId = crypto.randomUUID();
	let active = obsWindow.__clipifyObsActive;
	let sequence = 0;
	let stopped = false;
	const report = (isActive: boolean) => {
		// Sequence numbers keep delayed heartbeats from undoing a later deactivation.
		void fetch("/api/overlay/presence", {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
			body: JSON.stringify({ overlayId, instanceId, sequence: ++sequence, active: isActive }),
			keepalive: true,
			signal: AbortSignal.timeout(8_000),
		}).catch(() => {}); // Expiry handles failed requests and disconnected sources.
	};
	const update = (value: unknown) => {
		if (stopped || typeof value !== "boolean" || value === active) return;
		active = value;
		obsWindow.__clipifyObsActive = value;
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
	// OBS has no initial-active getter. Unknown remains unconfirmed until an event.
	if (typeof active === "boolean") report(active);
	const interval = window.setInterval(() => {
		if (active === true) report(true);
	}, OVERLAY_PRESENCE_INTERVAL_MS);
	const onPageHide = () => {
		active = undefined;
		obsWindow.__clipifyObsActive = undefined;
		report(false);
	};
	window.addEventListener("pagehide", onPageHide);
	return () => {
		stopped = true;
		window.clearInterval(interval);
		window.removeEventListener("obsSourceActiveChanged", onActive);
		window.removeEventListener("pagehide", onPageHide);
		if (obs.onActiveChange === legacyCallback) obs.onActiveChange = previous;
		report(false);
	};
}
