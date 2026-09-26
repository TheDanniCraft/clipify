"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function SentryFeedbackWidget() {
	useEffect(() => {
		const feedback = Sentry.getFeedback();
		if (!feedback) return;
		const widget = feedback.createWidget();
		widget.appendToDom();
		return () => widget.removeFromDom();
	}, []);

	return null;
}
