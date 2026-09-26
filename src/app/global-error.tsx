"use client";

import { Button, Link } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";

import NextErrorPage from "@components/nextErrorPage";
import { formatErrorReference, useSentryEventId } from "@lib/useSentryEventId";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	const eventId = useSentryEventId(error);

	return (
		<html>
			<body className='min-h-screen bg-background text-foreground'>
				<NextErrorPage
					contextLabel='Oops, something went wrong'
					title='We could not load the app'
					description={`Something unexpected happened. We logged the issue automatically, and your data is safe.${formatErrorReference(eventId)}`}
					actions={
						<>
							<Button onPress={reset} variant='primary'>
								Try again
							</Button>
							<Link href='/dashboard' className={buttonVariants({ variant: "secondary", className: "no-underline" })}>
								Go to dashboard
							</Link>
						</>
					}
				/>
			</body>
		</html>
	);
}
