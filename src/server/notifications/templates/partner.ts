import { createElement } from "react";
import { EmailNotice, renderBrandedEmail } from "./layout";
import { EMAIL_SUPPORT_URL, emailUrl, formatEmailDate } from "./formatting";
export type PartnerEmail = { event: "granted" | "updated" | "restored" | "revoked" | "partner-scheduled" | "partner-ended" | "partner-30d" | "partner-7d" | "partner-3d" | "partner-1d" | "partner-ending-30d" | "partner-ending-7d" | "partner-ending-3d" | "partner-ending-1d" | "ended"; endsAt?: string | null; proContinues?: boolean };
export async function renderPartnerEmail(input: PartnerEmail) {
	const end = input.endsAt ? new Date(input.endsAt) : null;
	const graceEnd = end ? formatEmailDate(new Date(end.getTime() + 7 * 86400000)) : null;
	const reminder = /^partner-(30|7|3|1)d$/.test(input.event);
	const days = Number(input.event.split("-").at(-1)?.replace("d", ""));
	if (input.event === "granted" || input.event === "restored")
		return renderBrandedEmail({
			subject: "Welcome to the Clipify Partner family 💜",
			paragraphs: ["Thank you for putting your trust in me and Clipify. I'm delighted to have you as a Partner.", "During your partnership, you have access to all Clipify Pro features. Runner access is managed separately.", "Your feedback means a lot to me. If you have an idea, need help, or something doesn't work as expected, reply to this email. I'd love to hear from you.", "Daniel / TheDanniCraft, founder of Clipify.us"],
			children: createElement(EmailNotice, { type: "success", title: "You are now a Clipify Partner" }, end ? `Your partnership runs until ${formatEmailDate(end)}. Pro continues until ${graceEnd}, including your seven-day transition period.` : "Enjoy your Partner benefits and all Clipify Pro features."),
			action: { label: "Explore Clipify", url: emailUrl("/dashboard") },
		});
	if (input.event.startsWith("partner-ending-")) {
		const days = Number(input.event.slice("partner-ending-".length, -1));
		return renderBrandedEmail({
			subject: `Your Clipify partnership ends in ${days} ${days === 1 ? "day" : "days"}`,
			paragraphs: [`Your partnership with Clipify ends on ${end ? formatEmailDate(end) : "the agreed date"}. Thank you for being part of the Clipify Partner family.`, `Your Partner badge ends then, but you can keep using Pro for seven more days, until ${graceEnd}.`, "If you have questions or would like to talk about continuing your partnership, contact us. We'd love to hear from you."],
			children: createElement(EmailNotice, { type: "info", title: "Your partnership is ending" }, "Thank you for your trust and feedback."),
			action: { label: "Contact us", url: EMAIL_SUPPORT_URL },
		});
	}
	if (input.event === "partner-scheduled" || input.event === "updated")
		return renderBrandedEmail({
			subject: end ? "Your Clipify partnership is scheduled to end" : "Your Clipify partnership will continue",
			paragraphs: [
				end ? `Your partnership is scheduled to end on ${formatEmailDate(end)}. Thank you for being part of Clipify and for the trust you've put in me and the tool.` : "Your partnership with Clipify will continue. You can keep enjoying your Partner benefits and all Clipify Pro features.",
				...(end ? [`Your Partner badge ends on that date. Your partnership-provided Pro access continues for seven additional days, until ${graceEnd}.`] : []),
				...(end ? ["Your other Pro access stays the same."] : []),
			],
			children: createElement(EmailNotice, { type: end ? "info" : "success", title: end ? "Seven-day Pro transition" : "Partnership continues" }, end ? "There is no automatic charge during this transition." : "Thank you for continuing to be part of the Clipify family."),
			action: { label: "Contact us", url: EMAIL_SUPPORT_URL },
		});
	const subject = input.event === "partner-ended" ? "Your Clipify partnership has ended" : reminder ? `Your Partner Pro transition ends in ${days} ${days === 1 ? "day" : "days"}` : "Your partnership-provided Pro access has ended";
	return renderBrandedEmail({
		subject,
		paragraphs: [
			input.event === "partner-ended"
				? `Thank you for being a Clipify Partner. Your partnership and Partner badge have ended. Your included Pro access continues until ${graceEnd} during your seven-day transition.`
				: reminder
					? `Your seven-day transition ends on ${graceEnd}. Choose a paid plan if you'd like to keep your Pro features.`
					: input.proContinues
						? "Your partnership-provided access has ended, but you still have Pro through another active source. Your Pro features remain available."
						: "Your partnership-provided access has ended. Your account is now on Free. Your saved configuration and content are retained; Free plan limits apply.",
			"I'm grateful for the time you spent with us. If you need help or would like to share feedback, reply to this email.",
			"Daniel / TheDanniCraft, founder of Clipify.us",
		],
		children: createElement(EmailNotice, { type: reminder ? "warning" : "info", title: input.event === "partner-ended" ? "Pro transition started" : input.proContinues ? "Pro access continues" : reminder ? "Keep your Pro features" : "Access period ended" }, "Paid plans and other active benefits are managed independently."),
		action: { label: input.proContinues ? "Open Clipify" : input.event === "partner-ended" ? "Contact support" : "View plans", url: input.proContinues ? emailUrl("/dashboard") : input.event === "partner-ended" ? EMAIL_SUPPORT_URL : emailUrl("/pricing") },
	});
}
