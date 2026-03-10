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
							<Button color='primary' onPress={reset}>
								Try again
							</Button>
							<Button as={Link} href='/dashboard' variant='flat' color='default'>
								Go to dashboard
							</Button>
						</>
					}
				/>
			</body>
		</html>
	);
}
