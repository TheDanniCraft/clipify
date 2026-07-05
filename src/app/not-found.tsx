import { Link } from "@components/heroui-client";
import { buttonVariants } from "@heroui/styles";

import NextErrorPage from "@components/nextErrorPage";

export default function NotFound() {
	return (
		<NextErrorPage
			contextLabel='Oops, page not found'
			title='Oops, page not found'
			description='We could not find that page. It may have been moved, renamed, or deleted.'
			actions={
				<Link href='/dashboard' className={buttonVariants({ variant: "primary", className: "no-underline" })}>
					Go to dashboard
				</Link>
			}
		/>
	);
}
