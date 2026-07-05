"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

const EXCLUDED_PREFIXES = ["/embed", "/overlay", "/demoPlayer"];

export default function AdOptScript() {
	const pathname = usePathname();

	if (EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
		return null;
	}

	return <Script id='adopt-cmp-injector' src='https://tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' strategy='beforeInteractive' />;
}
