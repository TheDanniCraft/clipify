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
			emailType: input.event,
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
		emailType: input.event,
		subject: returning ? "Welcome back to Clipify Pro 💜" : renewal ? "Thanks for your continued support 💜" : "Thank you for supporting Clipify 💜",
		paragraphs: [
			hi,
			returning ? "Welcome back! Your Clipify Pro subscription is active again, and your Pro features are ready to use." : renewal ? "Your Clipify Pro subscription has renewed. I wanted to take a moment to say thank you for sticking with Clipify." : input.existing ? "You've been supporting Clipify with Pro, and I wanted to say a personal thank you." : "Your Clipify Pro subscription is active. A huge thank you for choosing Pro.",
			returning
				? "I'm happy you've decided to come back. Thank you for giving Clipify another place in your content creation and for supporting my work as an independent developer."
				: renewal
					? "As an independent developer, having people continue to support my work means a lot. I'm grateful that you've chosen to keep Clipify as part of your content creation, and I'll keep working to make it useful for you."
					: "I'm building Clipify as an independent developer, so your support means a lot to me. Thank you for trusting something I've built to be part of your content creation. It helps me keep working on Clipify and making it better.",
			returning
				? "If something made you leave last time, or there's anything you'd like to see improved, I'd appreciate hearing about it. Just reply to this email, whether it's feedback, a feature idea, or something you need help with."
				: renewal
					? "How has it been working for you? If there's something you're missing, something that's frustrating, or anything you need help with, just reply to this email. I'm happy to listen."
					: "If you need help, something doesn't work as expected, or you have an idea for a feature, just reply to this email. I'd love to hear from you.",
			returning ? "It's good to have you back in the Clipify family." : renewal ? "Thank you for your continued trust and support." : "Thanks for being part of the Clipify family.",
			"Daniel / TheDanniCraft, founder of Clipify.us",
		],
		action: { label: "Open Clipify", url: emailUrl("/dashboard") },
	});
}
