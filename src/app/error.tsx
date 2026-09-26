"use client";

import { Button } from "@heroui/react";

import NextErrorPage from "@components/nextErrorPage";
import { formatErrorReference, useSentryEventId } from "@lib/useSentryEventId";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	const eventId = useSentryEventId(error);

	return (
		<NextErrorPage
			contextLabel='Oops, something went wrong'
			title='We hit a small problem'
			description={`This page could not load right now. Please try again.${formatErrorReference(eventId)}`}
			actions={
				<Button onPress={reset} variant='primary'>
					Try again
				</Button>
			}
		/>
	);
}
