"use client";

import { trackEvent, type AnalyticsData } from "./analytics";

export type PaywallEvent = "paywall_impression" | "paywall_cta_click" | "checkout_start" | "checkout_success" | "trial_started" | "trial_expired_view";

export function trackPaywallEvent(eventName: PaywallEvent, props?: AnalyticsData) {
	trackEvent(eventName, props);
}
