"use client";
import type { ReactNode } from "react";
import { Link } from "@heroui/react";
import { trackProductEvent } from "@lib/analytics";

export default function MarketingLink({ href, placement, className, children }: { href: string; placement: string; className?: string; children: ReactNode }) {
	return (
		<Link href={href} className={className} onPress={() => trackProductEvent("marketing_cta_click", { placement, action: "start_free" })}>
			{children}
		</Link>
	);
}
