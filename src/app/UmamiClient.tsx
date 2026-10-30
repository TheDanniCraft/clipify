"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useConsent, useSnapshot, useIdentify } from "c15t/next";
import { useNavigationGuard } from "nextjs-nav-guard";
import { getAnalyticsIdentity } from "./actions/analytics";
import { prepareUmamiPayload, setAnalyticsContext } from "./lib/analytics";
import { startEngagementTracking } from "./lib/analyticsEngagement";
import { browserMeasurementAllowed } from "./lib/consent/browserMeasurement";

const heatmapRoutes = new Set(["/", "/features", "/pricing"]);
function canRecordHeatmap(rawUrl: string) {
	const url = new URL(rawUrl, "https://clipify.us");
	return heatmapRoutes.has(url.pathname) && [...url.searchParams.keys()].every((key) => /^utm_(?:source|medium|campaign|content|term)$/.test(key));
}

const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || "cc971acc-716d-4056-a79c-3cfda9fb8e1d";

export default function UmamiClient() {
	const measurement = useConsent("measurement");
	const identifyConsent = useIdentify();
	const { policyPending } = useSnapshot();
	const pathname = usePathname();
	const [ready, setReady] = useState(false);
	const [recorderLoaded, setRecorderLoaded] = useState(false);
	const [hasIdentifiedSession, setHasIdentifiedSession] = useState(false);
	const previousMeasurement = useRef(measurement);
	const identified = useRef<string | null>(null);
	const identifiedContext = useRef<string | null>(null);
	const enabled = process.env.E2E_TEST_MODE !== "true" && !policyPending;
	const recorderEligible = measurement && ready && heatmapRoutes.has(pathname) && canRecordHeatmap(window.location.href);
	const resetIdentity = hasIdentifiedSession && !measurement;

	useEffect(() => {
		const revoked = previousMeasurement.current && !measurement;
		previousMeasurement.current = measurement;
		// Native heatmap listeners cannot be disposed; unload them on remote/cross-tab withdrawal too.
		if (enabled && revoked && heatmapRoutes.has(pathname)) window.location.reload();
	}, [enabled, measurement, pathname]);

	useEffect(() => {
		window.clipifyBeforeUmamiSend = prepareUmamiPayload;
		const stopEngagement = startEngagementTracking((payload) => {
			try {
				void Promise.resolve(window.umami?.track(payload)).catch(() => undefined);
			} catch {
				/* Analytics never blocks navigation. */
			}
		});
		return () => {
			stopEngagement();
			delete window.clipifyBeforeUmamiSend;
		};
	}, []);

	useEffect(() => {
		if (!enabled || !pathname || window.self !== window.top || pathname.startsWith("/creators/") || pathname.startsWith("/gallery/") || pathname.startsWith("/overlay/") || pathname.startsWith("/embed/") || pathname.startsWith("/runner/presentation/") || pathname.startsWith("/runner/preview/") || pathname === "/demoPlayer") return;
		let cancelled = false;
		void getAnalyticsIdentity()
			.then(async (identity) => {
				if (cancelled) return;
				const id = identity?.id ?? null;
				if (identity) await identifyConsent({ externalId: identity.id, identityToken: identity.identityToken });
				if (cancelled) return;
				if (identified.current && identified.current !== id) {
					window.location.reload();
					return;
				}
				if (identity && id && measurement && ready && browserMeasurementAllowed()) {
					setAnalyticsContext({ plan: identity.plan, access_source: identity.access_source, is_paying: identity.is_paying });
					const contextKey = JSON.stringify([identity.plan, identity.access_source, identity.is_paying]);
					if (identified.current !== id || identifiedContext.current !== contextKey) {
						identified.current = id;
						setHasIdentifiedSession(true);
						identifiedContext.current = contextKey;
						return window.umami?.identify(id, { plan: identity.plan, access_source: identity.access_source, is_paying: identity.is_paying });
					}
				}
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [measurement, ready, pathname, enabled, identifyConsent]);

	useNavigationGuard({
		enabled: recorderLoaded || recorderEligible || resetIdentity,
		confirm: ({ to, type }) => {
			if (type === "beforeunload" || (!resetIdentity && canRecordHeatmap(new URL(to, window.location.href).href))) return true;
			// The native recorder has no dispose API; unload its listeners before private navigation.
			window.location.assign(to);
			return false;
		},
	});

	if (!enabled) return null;
	return (
		<>
			<Script id='clipify-analytics' src={process.env.NEXT_PUBLIC_UMAMI_TRACKER_PATH || "/statistics/script.js"} data-website-id={websiteId} data-host-url='/statistics' data-domains='clipify.us' data-before-send='clipifyBeforeUmamiSend' data-performance={measurement ? "true" : "false"} onReady={() => setReady(true)} />
			{recorderEligible ? <Script id='clipify-heatmaps' src={process.env.NEXT_PUBLIC_UMAMI_RECORDER_PATH || "/statistics/recorder.js"} data-website-id={websiteId} data-host-url='/statistics' onReady={() => setRecorderLoaded(true)} /> : null}
		</>
	);
}
