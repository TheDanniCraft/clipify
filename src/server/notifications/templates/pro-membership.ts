import { ProFeatureList } from "./pro-features";
import { Text } from "@react-email/components";
import { createElement, Fragment } from "react";
import { EmailNotice, renderBrandedEmail } from "./layout";
import { emailUrl } from "./formatting";

export type ProMembershipEmail = { type: "pro-membership"; event: "first-pro" | "renewal" | "welcome-back" | "payment-ended"; name: string; existing?: boolean; proContinues?: boolean };
export async function renderProMembershipEmail(input: ProMembershipEmail) {
	const hi = `Hi ${input.name},`;
	if (input.event === "payment-ended")
		return renderBrandedEmail({
			subject: "Your Clipify Pro subscription has ended",
			paragraphs: [hi, "Your Clipify Pro subscription has ended.", "You can keep using Clipify on the Free plan, but Pro features are no longer available. Your saved setup and content are still here."],
			children: createElement(
				Fragment,
				null,
				createElement(ProFeatureList, { ended: true }),
				createElement(Text, { className: "email-copy", style: { fontSize: "15px", lineHeight: "24px" } }, "If you need help getting things sorted out, reply to this email. I'm happy to help."),
				createElement(Text, { className: "email-copy", style: { fontSize: "15px", lineHeight: "24px" } }, "Daniel / TheDanniCraft, founder of Clipify"),
				createElement(EmailNotice, { type: "warning", title: "Pro access ended" }, "Your saved setup is retained if you choose to return to Pro."),
			),
			action: { label: "Manage billing", url: emailUrl("/dashboard/settings?tab=billing") },
		});
	const renewal = input.event === "renewal";
	const returning = input.event === "welcome-back";
	return renderBrandedEmail({
		subject: returning ? "Welcome back to Clipify Pro 💜" : renewal ? "Thanks for your continued support 💜" : "Thank you for supporting Clipify 💜",
		paragraphs: [
			hi,
			returning
				? "Welcome back to Pro! Your subscription is active again, and your Pro features are ready to use. Thank you for choosing to support Clipify again and for trusting me with a part of your content creation journey."
				: renewal
					? "Your Clipify Pro subscription has renewed. Thank you for your continued support and for continuing to trust Clipify with a part of your content creation workflow."
					: `${input.existing ? "You've been supporting Clipify with Pro, and I wanted to say a personal thank you." : "A huge thank you for choosing Pro and supporting Clipify."} Thank you for trusting me and the tool I'm building. It means a lot that you've chosen Clipify to be part of your content creation journey.`,
			"If you ever need help, something doesn't work as expected, or you have an idea for a new feature, just reply to this email. I'm always happy to hear from you.",
			"Thanks for being part of the Clipify family.",
			"Daniel / TheDanniCraft, founder of Clipify.us",
		],
		action: { label: "Open Clipify", url: emailUrl("/dashboard") },
	});
}
