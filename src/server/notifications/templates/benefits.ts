import { ProFeatureList } from "./pro-features";
import { renderPartnerEmail } from "./partner";
import { EMAIL_SUPPORT_URL } from "./formatting";
import { createElement, Fragment } from "react";
import { EmailNotice, renderBrandedEmail } from "./layout";
import { emailUrl, formatEmailDate } from "./formatting";

export type BenefitEmail = {
	type: "benefit";
	benefit: "pro" | "runner";
	event: "granted" | "trial-30d" | "trial-7d" | "access-30d" | "access-7d" | "access-3d" | "access-1d" | "trial-3d" | "trial-1d" | "ended" | "revoked" | "updated" | "restored" | "cancellation" | "cancellation-30d" | "cancellation-7d" | "cancellation-3d" | "cancellation-1d" | "cancellation-0d" | "partner-scheduled" | "partner-ended" | "partner-30d" | "partner-7d" | "partner-3d" | "partner-1d" | "partner-ending-30d" | "partner-ending-7d" | "partner-ending-3d" | "partner-ending-1d";
	partner?: boolean;
	proContinues?: boolean;
	runnerContinues?: boolean;
	trial?: boolean;
	complimentary?: boolean;
	startsAt?: string;
	endsAt?: string | null;
	reason?: string | null;
};
export async function renderBenefitEmail(input: BenefitEmail) {
	if (input.partner) return renderPartnerEmail(input as Parameters<typeof renderPartnerEmail>[0]);
	const product = input.benefit === "runner" ? "runner" : "Clipify Pro";
	const accessContinues = input.benefit === "runner" ? input.runnerContinues : input.proContinues;
	const label = input.benefit === "runner" ? "runner access" : "Clipify Pro access";
	const end = input.endsAt ? formatEmailDate(new Date(input.endsAt)) : null;
	const duration = input.startsAt && input.endsAt ? Math.ceil((new Date(input.endsAt).getTime() - new Date(input.startsAt).getTime()) / 86400000) : null;
	if (input.event === "cancellation")
		return renderBrandedEmail({
			subject: `Your ${input.benefit === "runner" ? "runner" : "Clipify Pro"} subscription cancellation is confirmed`,
			paragraphs: ["We're sorry to see you go.", end ? `Your paid ${label} continues until ${end}. Your subscription will not renew.` : `Your ${label} subscription has ended.`, "Did something go wrong, or was there something you needed that Clipify didn't offer? We'd love to hear your feedback. You can contact us for help or tell us how we can improve.", "Your saved creator content remains yours. Any access you have through another plan or your agency is unchanged."],
			children: createElement(EmailNotice, { type: "info", title: "Cancellation confirmed" }, "You won't be charged again for this subscription."),
			action: { label: "Share feedback or get help", url: EMAIL_SUPPORT_URL },
		});
	if (input.event.startsWith("cancellation-")) {
		const days = Number(input.event.slice("cancellation-".length, -1));
		const ended = days === 0;
		return renderBrandedEmail({
			subject: ended ? `Your ${label} has ended` : `Your ${label} ends in ${days} ${days === 1 ? "day" : "days"}`,
			paragraphs: [
				ended ? `Your ${product} subscription has ended. Thank you for supporting Clipify—we're sorry to see you go.` : `Your ${product} subscription won't renew, and your ${label} ends on ${end}.`,
				ended ? `You can come back to ${product} whenever you're ready.` : "Want to stay with us? You can turn renewal back on in your billing settings.",
				input.benefit === "runner" ? "Your runner configuration is saved, so you can pick up where you left off if you return." : "You can keep using Clipify on the Free plan. Your saved setup and content will still be here.",
			],
			children: createElement(EmailNotice, { type: ended ? "info" : "warning", title: ended ? `${label} ended` : `Keep your ${product} features` }, ended ? "Your saved setup and content are still here." : `Turn renewal back on before your subscription ends to keep ${product}.`),
			action: { label: ended ? `Get ${product} again` : `Keep ${product}`, url: emailUrl(ended ? "/pricing" : "/dashboard/settings?tab=billing") },
		});
	}
	if (input.event === "updated" || input.event === "restored")
		return renderBrandedEmail({
			subject: input.event === "restored" ? `You have been given ${label} again` : end ? `Your ${label} is available until ${end}` : `Your ${label} no longer has an expiry date`,
			paragraphs: [end ? `Your ${label} is now available until ${end}.` : `Your ${label} is now available without an expiry date.`, ...(input.reason ? [`Reason: ${input.reason}`] : [])],
			children: createElement(EmailNotice, { type: "success", title: input.event === "restored" ? "Access restored" : "Access updated" }, `Enjoy ${input.benefit === "runner" ? "using your runner" : "your Pro features"}.`),
			action: { label: "Open your dashboard", url: emailUrl("/dashboard") },
		});
	const granted = input.event === "granted",
		reminder = input.event.startsWith("trial-") || input.event.startsWith("access-");
	const days = reminder ? Number(input.event.split("-").at(-1)?.replace("d", "")) : 0;
	const subject = granted
		? input.trial
			? `Your ${duration ?? 7} days of ${product} start now`
			: input.complimentary === false
				? `Your ${label} is now active`
				: duration
					? `You've been given ${duration} days of free ${label}`
					: `You've been given complimentary ${label}`
		: reminder
			? `Your ${product}${input.trial ? " trial" : " access"} ends in ${days} ${days === 1 ? "day" : "days"}`
			: `Your ${input.trial ? `${product} trial` : label} has ${input.event === "revoked" ? "been removed" : "ended"}`;
	const paragraphs = granted
		? [input.trial ? `We've given you ${duration ?? 7} days of ${product} to explore Clipify. Try the extra features, build your setup, and see what works for you. Your trial ends on ${end}.` : `You've been given ${input.complimentary === false ? "" : "complimentary "}${label}${end ? ` until ${end}` : ""}.`, ...(input.reason ? [`Reason: ${input.reason}`] : [])]
		: reminder
			? [`You have ${days} ${days === 1 ? "day" : "days"} of ${product} left. Enjoying Clipify? Choose a paid plan to keep your ${input.benefit === "runner" ? "runner access" : "Pro features"} after ${end}. ${input.trial ? "Your trial does not automatically start a paid subscription." : ""}`, ...(input.benefit === "pro" ? ["Your saved configuration and content are retained. Free plan limits apply when this access ends."] : [])]
			: [
					accessContinues
						? `Your ${input.trial ? "trial" : "complimentary access"} has ended, but you still have ${label}. You can keep using ${input.benefit === "runner" ? "your runner" : "your Pro features"}.`
						: `Your ${input.trial ? `${product} trial` : label} has ended. ${input.benefit === "pro" ? "You can keep using Clipify on the Free plan, or choose Pro to keep the extra features." : "Choose a plan with runner access to keep using your runner."} Your saved setup and content are still here.`,
				];
	const features = reminder && input.benefit === "pro" ? createElement(ProFeatureList) : null;
	return renderBrandedEmail({
		subject,
		paragraphs,
		children: createElement(Fragment, null, features, createElement(EmailNotice, { type: granted ? "success" : reminder ? "warning" : "info", title: granted ? "Access activated" : reminder ? (input.trial ? "Trial ending soon" : "Access ending soon") : input.event === "revoked" ? "Access removed" : "Access period ended" }, end && input.event !== "revoked" ? `${granted || reminder ? "Access period ends" : "Access period ended"} on ${end}.` : "Your saved setup and content are still here.")),
		action: { label: granted ? "Explore Clipify" : reminder ? (input.benefit === "pro" ? "Keep Pro" : "Keep runner access") : accessContinues ? "Open your dashboard" : "View plans", url: emailUrl(granted || accessContinues ? "/dashboard" : "/pricing") },
	});
}
