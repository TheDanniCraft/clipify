"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useRef, useState } from "react";

export function useSentryEventId(error: Error) {
	const capturedError = useRef<Error | null>(null);
	const [eventId, setEventId] = useState<string>();

	useEffect(() => {
		if (capturedError.current === error) return;
		capturedError.current = error;
		setEventId(Sentry.captureException(error));
	}, [error]);

	return eventId;
}

export function formatErrorReference(eventId: string | undefined) {
	return eventId ? " Reference: " + eventId : "";
}
