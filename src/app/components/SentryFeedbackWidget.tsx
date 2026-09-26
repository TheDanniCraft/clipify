"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";

export default function SentryFeedbackWidget() {
	const pathname = usePathname();
	const isEmbedded = isEmbeddedRoute(pathname);

	useEffect(() => {
		if (isEmbedded) return;
		const feedback = Sentry.getFeedback();
		if (!feedback) return;
		const widget = feedback.createWidget();
		widget.appendToDom();
		return () => widget.removeFromDom();
	}, [isEmbedded]);

	return null;
}
