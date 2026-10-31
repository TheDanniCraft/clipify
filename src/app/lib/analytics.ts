"use client";

import { browserMeasurementAllowed } from "./consent/browserMeasurement";

export type AnalyticsData = Record<string, string | number | boolean | null | undefined>;

declare global {
	interface Window {
		umami?: {
			track: (name?: string | Record<string, unknown>, data?: AnalyticsData) => void | Promise<void>;
			identify: (id: string, data?: AnalyticsData) => void | Promise<void>;
			getSession?: () => { cache?: string; website?: string };
		};
		clipifyBeforeUmamiSend?: typeof prepareUmamiPayload;
	}
}

let identifiedSession = false;
let productContext: AnalyticsData = {};

export function setAnalyticsContext(context: AnalyticsData) {
	identifiedSession = true;
	productContext = context;
}

const campaignKeys = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]);
const privateFields = /^(?:email|name|password|token|secret|access_token|refresh_token|code|stream_key|authorization)$/i;
const marketingRoutes = new Set(["/", "/pricing", "/community", "/changelog", "/roadmap", "/features", "/gallery"]);

function safeUrl(raw: unknown, relative: boolean) {
	if (typeof raw !== "string") return undefined;
	try {
		const url = new URL(raw, "https://clipify.us");
		if (!/^https?:$/.test(url.protocol)) return undefined;
		url.username = "";
		url.password = "";
		url.hash = "";
		for (const key of [...url.searchParams.keys()]) if (!campaignKeys.has(key)) url.searchParams.delete(key);
		return relative ? `${url.pathname}${url.search}` : url.toString();
	} catch {
		return undefined;
	}
}

/** Native tracker hook; preserve traffic coverage without exporting source credentials. */
export function prepareUmamiPayload(type: string, payload: Record<string, unknown>) {
	const consented = browserMeasurementAllowed();
	if (identifiedSession && !consented) return null;
	if ((type === "identify" || type === "performance") && !consented) return null;
	const result = { ...payload };
	const url = safeUrl(result.url, true);
	const pathname = url?.split("?")[0] ?? "/";
	result.url = url;
	if (result.referrer) result.referrer = safeUrl(result.referrer, false);
	if (!consented) delete result.id;
	if (result.data && typeof result.data === "object") result.data = Object.fromEntries(Object.entries(result.data).filter(([key]) => !privateFields.test(key)));
	if (consented && result.name) result.data = { ...(result.data as AnalyticsData | undefined), ...productContext };
	const embedded = typeof window !== "undefined" && window.self !== window.top;
	result.tag = result.hostname !== "clipify.us" ? "nonproduction" : embedded ? "runtime" : pathname.startsWith("/dashboard") ? "application" : pathname.startsWith("/creators/") || pathname.startsWith("/gallery/") ? "audience" : marketingRoutes.has(pathname.replace(/\/$/, "") || "/") ? "marketing" : "runtime";
	if (pathname.startsWith("/dashboard")) result.title = "Clipify dashboard";
	if (type === "event" && !result.name && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("clipify:analytics-pageview", { detail: result }));
	return result;
}

export function trackEvent(name: string, data?: AnalyticsData) {
	try {
		const pending = typeof window !== "undefined" ? window.umami?.track(name, data) : undefined;
		if (pending) void pending.catch(() => undefined);
	} catch {
		// Blocked analytics must never prevent a product action.
	}
}

export function trackProductEvent(name: string, data?: AnalyticsData) {
	if (browserMeasurementAllowed()) trackEvent(name, data);
}
