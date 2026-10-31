"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useConsent, useSnapshot, useIdentify } from "c15t/next";
import { installHeatmapRequestFilter } from "./lib/heatmapRequests";
import { canRecordHeatmap } from "./lib/heatmapRoutes";
import { getAnalyticsIdentity } from "./actions/analytics";
import { prepareUmamiPayload, setAnalyticsContext } from "./lib/analytics";
import { startEngagementTracking } from "./lib/analyticsEngagement";
import { browserMeasurementAllowed } from "./lib/consent/browserMeasurement";

export default function UmamiClient({ websiteId }: { websiteId: string }) {
	const measurement = useConsent("measurement");
	const identifyConsent = useIdentify();
	const { policyPending } = useSnapshot();
	const pathname = usePathname();
	const [ready, setReady] = useState(false);
	const [recorderStarted, setRecorderStarted] = useState(false);
	const previousMeasurement = useRef(measurement);
	const identified = useRef<string | null>(null);
	const identifiedContext = useRef<string | null>(null);
	const enabled = process.env.E2E_TEST_MODE !== "true" && !policyPending && Boolean(websiteId);
	const recorderEligible = measurement && ready && canRecordHeatmap(pathname, window.location.origin) && canRecordHeatmap(window.location.href, window.location.origin);

	if (recorderEligible && !recorderStarted) setRecorderStarted(true);

	useEffect(() => {
		const revoked = previousMeasurement.current && !measurement;
		previousMeasurement.current = measurement;
		// Clear an identified tracker session on withdrawal; heatmaps are blocked by the request filter.
		if (enabled && revoked && identified.current) window.location.reload();
	}, [enabled, measurement, pathname]);

	useEffect(() => {
		if (enabled) installHeatmapRequestFilter(websiteId);
	}, [enabled, websiteId]);

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

	if (!enabled) return null;
	return (
		<>
			<Script id='clipify-analytics' src={process.env.NEXT_PUBLIC_UMAMI_TRACKER_PATH || "/statistics/script.js"} data-website-id={websiteId} data-host-url='/statistics' data-before-send='clipifyBeforeUmamiSend' data-performance={measurement ? "true" : "false"} onReady={() => setReady(true)} />
			{recorderStarted ? <Script id='clipify-heatmaps' src={process.env.NEXT_PUBLIC_UMAMI_RECORDER_PATH || "/statistics/recorder.js"} data-website-id={websiteId} data-host-url='/statistics' /> : null}
		</>
	);
}
