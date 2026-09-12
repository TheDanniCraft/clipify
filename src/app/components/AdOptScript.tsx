"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";
import { AdoptConsent, applySentryReplayConsent } from "@lib/sentryReplayConsent";

declare global {
	interface Window {
		adoptCB?: (consent: AdoptConsent) => void;
	}
}

export default function AdOptScript() {
	const pathname = usePathname();
	const embeddedRoute = isEmbeddedRoute(pathname);

	useEffect(() => {
		if (embeddedRoute) return;

		const previousCallback = window.adoptCB;
		const consentCallback = (consent: AdoptConsent) => {
			previousCallback?.(consent);
			void applySentryReplayConsent(consent);
		};

		window.adoptCB = consentCallback;
		return () => {
			if (window.adoptCB === consentCallback) {
				window.adoptCB = previousCallback;
			}
		};
	}, [embeddedRoute]);

	if (embeddedRoute) {
		return null;
	}

	return (
		<>
			<Script id='adopt-cmp-injector' src='https://tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' strategy='afterInteractive' />
			<Script id='affiliate-program-tracker' src='https://affiliate.clipify.us/tracking/program-1.js' strategy='afterInteractive' />
		</>
	);
}
