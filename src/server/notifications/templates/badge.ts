import { EMAIL_SUPPORT_ADDRESS, EMAIL_SUPPORT_URL } from "./formatting";
import { Link } from "./email-links";
import { createElement } from "react";
import { EmailNotice, renderBrandedEmail } from "./layout";
import { emailUrl } from "./formatting";
export async function renderBadgeEmail(input: { name: string; description: string; event: "awarded" | "removed" }) {
	const awarded = input.event === "awarded";
	return renderBrandedEmail({
		subject: awarded ? `You've earned the ${input.name} badge` : `Your ${input.name} badge was removed`,
		paragraphs: awarded ? [`Thank you for being part of the Clipify family. You've earned the ${input.name} badge.`, input.description] : [`The ${input.name} badge is no longer displayed on your Clipify member profile. This does not change your account access.`, createElement("span", null, "If you have questions, email our team at ", createElement(Link, { href: EMAIL_SUPPORT_URL, className: "email-link", style: { color: "#5f06f5" } }, EMAIL_SUPPORT_ADDRESS), ".")],
		children: createElement(EmailNotice, { type: awarded ? "success" : "info", title: awarded ? "Badge awarded" : "Badge removed" }, input.name),
		action: { label: awarded ? "View your account" : "Contact support", url: awarded ? emailUrl("/dashboard/settings") : EMAIL_SUPPORT_URL },
	});
}
