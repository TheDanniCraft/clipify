"use client";
import { faro } from "@grafana/faro-web-sdk";
export type ProductEventName = "auth_start" | "auth_success" | "overlay_created" | "paywall_impression" | "paywall_cta_click" | "paywall_dismissed" | "checkout_start" | "checkout_success" | "form_validation_blocked" | "action_failed" | "newsletter_subscription" | "clip_played";
type EventProperty = string | number | boolean | null | undefined;
export type ProductEventProperties = Record<string, EventProperty>;
type Route = { plausible?: boolean; clarity?: boolean; prioritizeClarity?: boolean };
const ROUTES: Record<ProductEventName, Route> = {
	auth_start: { plausible: true, clarity: true, prioritizeClarity: true },
	auth_success: { plausible: true, clarity: true },
	overlay_created: { plausible: true, clarity: true },
	paywall_impression: { plausible: true, clarity: true },
	paywall_cta_click: { plausible: true, clarity: true, prioritizeClarity: true },
	paywall_dismissed: { clarity: true, prioritizeClarity: true },
	checkout_start: { plausible: true, clarity: true, prioritizeClarity: true },
	checkout_success: { plausible: true, clarity: true, prioritizeClarity: true },
	form_validation_blocked: { clarity: true, prioritizeClarity: true },
	action_failed: { clarity: true, prioritizeClarity: true },
	newsletter_subscription: { plausible: true },
	clip_played: { plausible: true },
};
const ALLOWED_PROPERTIES = new Set(["source", "product", "feature", "billing_cycle", "cycle", "plan", "placement", "page_area", "funnel_stage", "reason", "value"]);
declare global {
	interface Window {
		plausible?: (name: string, options?: { props?: ProductEventProperties }) => void;
		clarity?: ((command: string, ...args: unknown[]) => void) & { q?: unknown[] };
	}
}
export function sanitizeEventProperties(properties: ProductEventProperties = {}) {
	return Object.fromEntries(
		Object.entries(properties)
			.filter(([key, value]) => ALLOWED_PROPERTIES.has(key) && ["string", "number", "boolean"].includes(typeof value))
			.map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 100) : value]),
	);
}
export function emitProductEvent(name: ProductEventName, properties: ProductEventProperties | undefined, plausibleOverride?: (name: string, options?: { props?: ProductEventProperties }) => void) {
	if (typeof window === "undefined") {
		plausibleOverride?.(name, { props: properties });
		return;
	}
	const route = ROUTES[name];
	const props = properties === undefined ? undefined : sanitizeEventProperties(properties);
	if (route.plausible)
		try {
			(plausibleOverride || window.plausible)?.(name, { props });
		} catch {
			/* best-effort */
		}
	if (route.clarity && window.clarity)
		try {
			window.clarity("event", name);
			for (const [key, value] of Object.entries(props || {})) window.clarity("set", key, String(value));
			if (route.prioritizeClarity) window.clarity("upgrade", name);
		} catch {
			/* best-effort */
		}
}
export function reportFrontendError(error: unknown, context = "frontend") {
	const normalized = error instanceof Error ? error : new Error("Unknown frontend error");
	try {
		faro.api.pushError(normalized, { context: { source: context.slice(0, 80) } });
	} catch {
		/* reporting must not throw */
	}
	if (typeof window !== "undefined" && window.clarity)
		try {
			window.clarity("event", "frontend_error");
			window.clarity("upgrade", "frontend_error");
		} catch {
			/* generic label only */
		}
}
