"use client";
import { getWebInstrumentations, initializeFaro, UserActionInstrumentation } from "@grafana/faro-web-sdk";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
const CLARITY_EXCLUDED_PREFIXES = ["/admin", "/auth", "/callback", "/payment", "/embed", "/overlay", "/controller", "/demoPlayer", "/runner/enroll"];
declare global {
	interface Window {
		adoptCB?: (consent: { optInTags?: string[]; optOutTags?: string[] }) => void;
	}
}
let faroInitialized = false;
let clarityLoaded = false;
const SENSITIVE_FIELD = /token|secret|password|authorization|cookie|email|code|state|dsn/i;
function sanitizeTelemetryItem<T>(item: T): T {
	return JSON.parse(JSON.stringify(item), (key, value) => {
		if (SENSITIVE_FIELD.test(key)) return "[REDACTED]";
		if (typeof value === "string" && value.startsWith("http")) {
			try {
				const url = new URL(value);
				url.search = "";
				url.hash = "";
				return url.toString();
			} catch {
				return value;
			}
		}
		return value;
	}) as T;
}
function startFaro() {
	const url = process.env.NEXT_PUBLIC_FARO_COLLECTOR_URL;
	if (faroInitialized || !url) return;
	initializeFaro({ url, app: { name: "clipify-web", version: process.env.NEXT_PUBLIC_APP_RELEASE || "unknown", environment: process.env.NODE_ENV }, instrumentations: getWebInstrumentations({ captureConsole: false }).filter((item) => !(item instanceof UserActionInstrumentation)), sessionTracking: { enabled: false }, trackGeolocation: false, beforeSend: sanitizeTelemetryItem, ignoreUrls: [/analytics\.thedannicraft\.de/i, /clarity\.ms/i, /goadopt\.io/i, /affiliate\.clipify\.us/i] });
	faroInitialized = true;
}
function stopClarityCookies() {
	for (const name of ["_clck", "_clsk"]) document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
}
function applyClarityConsent(granted: boolean, eligibleRoute: boolean) {
	const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
	if (!projectId || !eligibleRoute) return;
	window.clarity =
		window.clarity ||
		function (...args: unknown[]) {
			(window.clarity!.q = window.clarity!.q || []).push(args);
		};
	window.clarity("consentv2", { analytics_Storage: granted ? "granted" : "denied", ad_Storage: "denied" });
	if (!granted) {
		stopClarityCookies();
		if (clarityLoaded) window.location.reload();
		return;
	}
	if (clarityLoaded) return;
	const script = document.createElement("script");
	script.async = true;
	script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`;
	document.head.appendChild(script);
	clarityLoaded = true;
}
export default function TelemetryProvider() {
	const pathname = usePathname();
	useEffect(() => startFaro(), []);
	useEffect(() => {
		const analyticsTagId = process.env.NEXT_PUBLIC_ADOPT_ANALYTICS_TAG_ID;
		const eligibleRoute = !CLARITY_EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
		if (!eligibleRoute && clarityLoaded) {
			window.location.reload();
			return;
		}
		window.adoptCB = (consent) => applyClarityConsent(Boolean(analyticsTagId && consent.optInTags?.includes(analyticsTagId)), eligibleRoute);
		return () => {
			delete window.adoptCB;
		};
	}, [pathname]);
	return null;
}
