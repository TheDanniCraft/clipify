"use client";
import { emitProductEvent, type ProductEventProperties } from "@lib/telemetry";
export type PaywallEvent = "paywall_impression" | "paywall_cta_click" | "checkout_start" | "checkout_success" | "trial_started" | "trial_expired_view";
type PlausibleFn = (eventName: string, options?: { props?: ProductEventProperties }) => void;
export function trackPaywallEvent(plausible: PlausibleFn, eventName: PaywallEvent, props?: ProductEventProperties) {
	if (eventName === "trial_started" || eventName === "trial_expired_view") {
		plausible(eventName, { props });
		return;
	}
	emitProductEvent(eventName, props, plausible);
}
