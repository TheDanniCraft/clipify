"use client";

import * as Sentry from "@sentry/nextjs";
import { reportFrontendError } from "@lib/telemetry";
import { Button } from "@heroui/react";

import { useEffect } from "react";
import NextErrorPage from "@components/nextErrorPage";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => {
		Sentry.captureException(error);
		reportFrontendError(error, "app_error_boundary");
	}, [error]);

	return (
		<NextErrorPage
			contextLabel='Oops, something went wrong'
			title='We hit a small problem'
			description='This page could not load right now. Please try again.'
			actions={
				<Button onPress={reset} variant='primary'>
					Try again
				</Button>
			}
		/>
	);
}
