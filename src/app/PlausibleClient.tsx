"use client";

import PlausibleProvider from "next-plausible";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { minimatch } from "minimatch";

function getHost(ref: string) {
	try {
		return new URL(ref).host;
	} catch {
		return "";
	}
}

const EMBED_ROUTE_PATTERNS = ["/demoPlayer", "/embed/**"];

export default function PlausibleClient() {
	const pathname = usePathname();

	const enabled = useMemo(() => {
		// Prevent server-side access to browser globals
		if (typeof window === "undefined" || typeof document === "undefined") {
			return true;
		}

		const isEmbedRoute = EMBED_ROUTE_PATTERNS.some((pattern) => minimatch(pathname, pattern));
		const isEmbedded = window.self !== window.top;

		const refHost = getHost(document.referrer);

		const myHost = window.location.host;

		const embeddedByUs = isEmbedRoute && isEmbedded && refHost !== "" && refHost === myHost;

		return !embeddedByUs;
	}, [pathname]);

	if (!enabled) return null;

	return <PlausibleProvider domain='clipify.us' customDomain='https://analytics.thedannicraft.de' selfHosted trackOutboundLinks trackFileDownloads taggedEvents hash enabled />;
}
