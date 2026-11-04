"use client";

import * as Sentry from "@sentry/nextjs";
import { Button } from "@heroui/react";
import { IconBug } from "@tabler/icons-react";
import { notify } from "@lib/toast";
import DashboardUtilityPortal from "./dashboardUtilityPortal";
import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";

export default function SentryFeedbackWidget() {
	const pathname = usePathname();
	const isEmbedded = isEmbeddedRoute(pathname);
	const inDashboard = pathname.startsWith("/dashboard") && !isEmbedded;
	const [pending, setPending] = useState(false);
	const form = useRef<Awaited<ReturnType<NonNullable<ReturnType<typeof Sentry.getFeedback>>["createForm"]>> | null>(null);
	const mounted = useRef(false);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			form.current?.removeFromDom();
		};
	}, []);

	useEffect(() => {
		if (isEmbedded || inDashboard) return;
		const feedback = Sentry.getFeedback();
		if (!feedback) return;
		const widget = feedback.createWidget();
		widget.appendToDom();
		return () => widget.removeFromDom();
	}, [isEmbedded, inDashboard]);

	return inDashboard ? (
		<DashboardUtilityPortal slot='report'>
			<div>
				<Button
					data-tour='support-report'
					variant='ghost'
					fullWidth
					className='justify-start text-muted'
					isPending={pending}
					onPress={async () => {
						setPending(true);
						try {
							const feedback = Sentry.getFeedback();
							if (!feedback) throw new Error("Unavailable");
							feedback.setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
							form.current ??= await feedback.createForm();
							if (!mounted.current) return;
							form.current.appendToDom();
							form.current.open();
							if (form.current.el instanceof HTMLElement) form.current.el.querySelector('[role="dialog"],dialog')?.setAttribute("aria-label", "Report a problem");
						} catch {
							notify({ title: "Feedback could not open", description: "Try again or use support chat.", color: "danger" });
						} finally {
							setPending(false);
						}
					}}
				>
					<IconBug className='size-4 shrink-0 text-danger' aria-hidden='true' />
					Report a problem
				</Button>
			</div>
		</DashboardUtilityPortal>
	) : null;
}
