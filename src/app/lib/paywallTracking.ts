"use client";

export type PaywallEvent = "paywall_impression" | "paywall_cta_click" | "checkout_start" | "checkout_success" | "trial_started" | "trial_expired_view";

type PlausibleFn = (eventName: string, options?: { props?: Record<string, string | number | boolean | null | undefined> }) => void;

export function trackPaywallEvent(plausible: PlausibleFn, eventName: PaywallEvent, props?: Record<string, string | number | boolean | null | undefined>) {
	plausible(eventName, { props });
}

