import { Button, Link } from "@heroui/react";
import NextErrorPage from "@components/nextErrorPage";

export default function NotFound() {
	return (
		<NextErrorPage
			contextLabel='Oops, page not found'
			title='Oops, page not found'
			description='We could not find that page. It may have been moved, renamed, or deleted.'
			actions={
				<Button as={Link} href='/dashboard' color='primary'>
					Go to dashboard
				</Button>
			}
		/>
	);
}
