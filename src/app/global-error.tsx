"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button, Link } from "@heroui/react";

import NextErrorPage from "@components/nextErrorPage";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<html>
			<body className='min-h-screen bg-background text-foreground'>
				<NextErrorPage
					contextLabel='Oops, something went wrong'
					title='We could not load the app'
					description='Something unexpected happened. We logged the issue automatically, and your data is safe.'
					actions={
						<>
							<Button onPress={reset} variant='primary'>
								Try again
							</Button>
							<Link href='/dashboard' className='inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-medium bg-transparent text-foreground hover:bg-default/40'>
								Go to dashboard
							</Link>
						</>
					}
				/>
			</body>
		</html>
	);
}
