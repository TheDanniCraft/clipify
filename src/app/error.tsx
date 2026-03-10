"use client";

import * as Sentry from "@sentry/nextjs";
import { Button } from "@heroui/react";
import { useEffect } from "react";
import NextErrorPage from "@components/nextErrorPage";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<NextErrorPage
			contextLabel='Oops, something went wrong'
			title='We hit a small problem'
			description='This page could not load right now. Please try again.'
			actions={
				<Button color='primary' onPress={reset}>
					Try again
				</Button>
			}
		/>
	);
}
