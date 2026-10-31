import { browserMeasurementAllowed, browserMeasurementStartedAt } from "./consent/browserMeasurement";
import { canRecordHeatmap } from "./heatmapRoutes";

export function filterHeatmapRequest(body: string, websiteId: string, currentUrl: string): string | null {
	try {
		const origin = new URL(currentUrl).origin;
		const since = browserMeasurementStartedAt();
		if (!browserMeasurementAllowed() || since === null || !canRecordHeatmap(currentUrl, origin)) return null;
		const request = JSON.parse(body);
		if (request?.type !== "heatmap" || request.payload?.website !== websiteId || !Array.isArray(request.payload.events)) return null;
		const events = request.payload.events.filter((event: { type?: string; url?: string; timestamp?: number } | null) => event && (event.type === "click" || event.type === "scroll") && typeof event.url === "string" && canRecordHeatmap(event.url, origin) && typeof event.timestamp === "number" && Number.isFinite(event.timestamp) && event.timestamp >= since && event.timestamp <= Date.now());
		return events.length ? JSON.stringify({ ...request, payload: { ...request.payload, events } }) : null;
	} catch {
		return null;
	}
}

declare global {
	interface Window {
		clipifyRecorderFetch?: typeof fetch;
	}
}

export function installRecorderFetch(websiteId: string) {
	const originalFetch = window.fetch;
	// Only the proxied recorder receives this function; never replace window.fetch.
	window.clipifyRecorderFetch = (input, init) => {
		const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		let url: URL;
		try {
			url = new URL(rawUrl, window.location.href);
		} catch {
			return originalFetch.call(window, input, init);
		}
		if (url.origin !== window.location.origin || url.pathname !== "/statistics/api/record") return originalFetch.call(window, input, init);
		const body = typeof init?.body === "string" ? filterHeatmapRequest(init.body, websiteId, window.location.href) : null;
		return body ? originalFetch.call(window, input, { ...init, body }) : Promise.resolve(new Response(null, { status: 204 }));
	};
}
