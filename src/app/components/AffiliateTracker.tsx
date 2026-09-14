"use client";

import { useEffect } from "react";
import { useConsentManager } from "@c15t/nextjs";
import { usePathname } from "next/navigation";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";

export function AffiliateTracker() {
	const pathname = usePathname();
	const { has, hasConsented } = useConsentManager();
	const allowed = !isEmbeddedRoute(pathname) && hasConsented() && has("marketing");

	useEffect(() => {
		if (!allowed) return;
		const script = document.createElement("script");
		script.id = "affiliate-program-tracker";
		script.src = "https://affiliate.clipify.us/tracking/program-1.js";
		script.async = true;
		document.body.appendChild(script);
		return () => script.remove();
	}, [allowed]);

	return null;
}
