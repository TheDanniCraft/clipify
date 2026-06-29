import { Link } from "@heroui/react";

import NextErrorPage from "@components/nextErrorPage";

export default function NotFound() {
	return (
		<NextErrorPage
			contextLabel='Oops, page not found'
			title='Oops, page not found'
			description='We could not find that page. It may have been moved, renamed, or deleted.'
			actions={
				<Link href='/dashboard' className='inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-medium bg-accent text-accent-foreground hover:bg-accent-hover'>
					Go to dashboard
				</Link>
			}
		/>
	);
}
