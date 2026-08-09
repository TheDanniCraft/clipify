"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";

export default function AdOptScript() {
	const pathname = usePathname();

	if (isEmbeddedRoute(pathname)) {
		return null;
	}

	return (
		<>
			<Script id='adopt-cmp-injector' src='https://tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' strategy='afterInteractive' />
			<Script id='affiliate-program-tracker' src='https://affiliate.clipify.us/tracking/program-1.js' strategy='afterInteractive' />
		</>
	);
}
