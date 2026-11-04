"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

export default function DashboardUtilityPortal({ children, slot = "chat" }: { children: ReactNode; slot?: "chat" | "report" | "account" | "guide" }) {
	const pathname = usePathname();
	const [target, setTarget] = useState<HTMLElement | null>(null);
	useEffect(() => {
		const find = () => {
			const host = document.querySelector<HTMLElement>('[data-slot="sidebar-mobile"] #dashboard-mobile-utilities[data-dashboard-utilities-ready="true"]') ?? document.querySelector<HTMLElement>('#dashboard-utilities[data-dashboard-utilities-ready="true"]');
			setTarget(host?.querySelector<HTMLElement>(`[data-dashboard-utility="${slot}"]`) ?? host ?? null);
		};
		find();
		// Portaling into server HTML before its host hydrates forces React to discard the dashboard.
		const observer = new MutationObserver(find);
		observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-dashboard-utilities-ready"] });
		return () => observer.disconnect();
	}, [pathname, slot]);
	return target ? createPortal(children, target) : children;
}
