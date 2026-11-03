"use client";

import * as Sentry from "@sentry/nextjs";
import { Button } from "@heroui/react";
import DashboardUtilityPortal from "./dashboardUtilityPortal";
import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";

export default function SentryFeedbackWidget() {
	const pathname = usePathname();
	const isEmbedded = isEmbeddedRoute(pathname);
	const inDashboard = pathname.startsWith("/dashboard") && !isEmbedded;
	const [error, setError] = useState(false);
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
		<DashboardUtilityPortal>
			<div>
				<Button
					data-tour='support-report'
					variant='tertiary'
					isPending={pending}
					onPress={async () => {
						setPending(true);
						setError(false);
						try {
							const feedback = Sentry.getFeedback();
							if (!feedback) throw new Error("Unavailable");
							form.current ??= await feedback.createForm();
							if (!mounted.current) return;
							form.current.appendToDom();
							form.current.open();
						} catch {
							setError(true);
						} finally {
							setPending(false);
						}
					}}
				>
					Report a problem
				</Button>
				{error ? (
					<p role='alert' className='text-xs text-danger'>
						Feedback could not open. Try again or use support chat.
					</p>
				) : null}
			</div>
		</DashboardUtilityPortal>
	) : null;
}
