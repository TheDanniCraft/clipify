import { Button as ReactEmailButton, Link as ReactEmailLink } from "@react-email/components";
import type { ComponentProps } from "react";

// SES removes this attribute on delivery and leaves the destination URL intact.
// Delivery, bounce and complaint reporting do not depend on click tracking.
const directLinkAttributes = { "ses:no-track": "" };

export function Link(props: ComponentProps<typeof ReactEmailLink>) {
	return <ReactEmailLink {...props} {...directLinkAttributes} />;
}

export function Button(props: ComponentProps<typeof ReactEmailButton>) {
	return <ReactEmailButton {...props} {...directLinkAttributes} />;
}
