"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

export default function DashboardUtilityPortal({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const [target, setTarget] = useState<HTMLElement | null>(null);
	useEffect(() => {
		const find = () => setTarget(document.getElementById("dashboard-utilities"));
		find();
		// The authenticated shell can arrive after the globally mounted support widgets.
		const observer = new MutationObserver(find);
		observer.observe(document.body, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, [pathname]);
	return target ? createPortal(children, target) : children;
}
