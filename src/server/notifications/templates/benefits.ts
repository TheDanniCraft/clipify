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
function benefitContext(input: BenefitEmail) {
	const product = input.benefit === "runner" ? "runner" : "Clipify Pro";
	const accessContinues = input.benefit === "runner" ? input.runnerContinues : input.proContinues;
	const label = input.benefit === "runner" ? "runner access" : "Clipify Pro access";
	const end = input.endsAt ? formatEmailDate(new Date(input.endsAt)) : null;
	const duration = input.startsAt && input.endsAt ? Math.ceil((new Date(input.endsAt).getTime() - new Date(input.startsAt).getTime()) / 86400000) : null;
	return { product, accessContinues, label, end, duration };
}
function renderBenefitCancellation(input: BenefitEmail) {
	const { label, end } = benefitContext(input);
	return renderBrandedEmail({
		subject: `Your ${input.benefit === "runner" ? "runner" : "Clipify Pro"} subscription cancellation is confirmed`,
		paragraphs: ["We're sorry to see you go.", end ? `Your paid ${label} continues until ${end}. Your subscription will not renew.` : `Your ${label} subscription has ended.`, "Did something go wrong, or was there something you needed that Clipify didn't offer? We'd love to hear your feedback. You can contact us for help or tell us how we can improve.", "Your saved creator content remains yours. Any access you have through another plan or your agency is unchanged."],
		children: createElement(EmailNotice, { type: "info", title: "Cancellation confirmed" }, "You won't be charged again for this subscription."),
		action: { label: "Share feedback or get help", url: EMAIL_SUPPORT_URL },
	});
}

function cancellationSubject(label: string, days: number) {
	return days === 0 ? `Your ${label} has ended` : `Your ${label} ends in ${days} ${days === 1 ? "day" : "days"}`;
}
function renderBenefitCountdown(input: BenefitEmail) {
	const { product, label, end } = benefitContext(input);
	const days = Number(input.event.slice("cancellation-".length, -1));
	const ended = days === 0;
	return renderBrandedEmail({
		subject: cancellationSubject(label, days),
		paragraphs: [
			ended ? `Your ${product} subscription has ended. Thank you for supporting Clipify—we're sorry to see you go.` : `Your ${product} subscription won't renew, and your ${label} ends on ${end}.`,
			ended ? `You can come back to ${product} whenever you're ready.` : "Want to stay with us? You can turn renewal back on in your billing settings.",
			input.benefit === "runner" ? "Your runner configuration is saved, so you can pick up where you left off if you return." : "You can keep using Clipify on the Free plan. Your saved setup and content will still be here.",
		],
		children: createElement(EmailNotice, { type: ended ? "info" : "warning", title: ended ? `${label} ended` : `Keep your ${product} features` }, ended ? "Your saved setup and content are still here." : `Turn renewal back on before your subscription ends to keep ${product}.`),
		action: { label: ended ? `Get ${product} again` : `Keep ${product}`, url: emailUrl(ended ? "/pricing" : "/dashboard/settings?tab=billing") },
	});
}

function renderBenefitChange(input: BenefitEmail) {
	const { label, end } = benefitContext(input);
	return renderBrandedEmail({
		subject: input.event === "restored" ? `You have been given ${label} again` : end ? `Your ${label} is available until ${end}` : `Your ${label} no longer has an expiry date`,
		paragraphs: [end ? `Your ${label} is now available until ${end}.` : `Your ${label} is now available without an expiry date.`, ...(input.reason ? [`Reason: ${input.reason}`] : [])],
		children: createElement(EmailNotice, { type: "success", title: input.event === "restored" ? "Access restored" : "Access updated" }, `Enjoy ${input.benefit === "runner" ? "using your runner" : "your Pro features"}.`),
		action: { label: "Open your dashboard", url: emailUrl("/dashboard") },
	});
}

type BenefitContext = ReturnType<typeof benefitContext>;
function grantedSubject(input: BenefitEmail, { duration, product, label }: BenefitContext) {
	if (input.trial) return `Your ${duration ?? 7} days of ${product} start now`;
	if (input.complimentary === false) return `Your ${label} is now active`;
	return duration ? `You've been given ${duration} days of free ${label}` : `You've been given complimentary ${label}`;
}
function benefitSubject(input: BenefitEmail, context: BenefitContext, granted: boolean, reminder: boolean, days: number) {
	if (granted) return grantedSubject(input, context);
	if (reminder) return `Your ${context.product}${input.trial ? " trial" : " access"} ends in ${days} ${days === 1 ? "day" : "days"}`;
	return `Your ${input.trial ? `${context.product} trial` : context.label} has ${input.event === "revoked" ? "been removed" : "ended"}`;
}
function grantedParagraphs(input: BenefitEmail, { duration, product, label, end }: BenefitContext) {
	return [input.trial ? `We've given you ${duration ?? 7} days of ${product} to explore Clipify. Try the extra features, build your setup, and see what works for you. Your trial ends on ${end}.` : `You've been given ${input.complimentary === false ? "" : "complimentary "}${label}${end ? ` until ${end}` : ""}.`, ...(input.reason ? [`Reason: ${input.reason}`] : [])];
}
function reminderParagraphs(input: BenefitEmail, { product, end }: BenefitContext, days: number) {
	return [`You have ${days} ${days === 1 ? "day" : "days"} of ${product} left. Enjoying Clipify? Choose a paid plan to keep your ${input.benefit === "runner" ? "runner access" : "Pro features"} after ${end}. ${input.trial ? "Your trial does not automatically start a paid subscription." : ""}`, ...(input.benefit === "pro" ? ["Your saved configuration and content are retained. Free plan limits apply when this access ends."] : [])];
}
function endedParagraphs(input: BenefitEmail, { product, label, accessContinues }: BenefitContext) {
	return [
		accessContinues ? `Your ${input.trial ? "trial" : "complimentary access"} has ended, but you still have ${label}. You can keep using ${input.benefit === "runner" ? "your runner" : "your Pro features"}.` : `Your ${input.trial ? `${product} trial` : label} has ended. ${input.benefit === "pro" ? "You can keep using Clipify on the Free plan, or choose Pro to keep the extra features." : "Choose a plan with runner access to keep using your runner."} Your saved setup and content are still here.`,
	];
}
function benefitParagraphs(input: BenefitEmail, context: BenefitContext, granted: boolean, reminder: boolean, days: number) {
	if (granted) return grantedParagraphs(input, context);
	if (reminder) return reminderParagraphs(input, context, days);
	return endedParagraphs(input, context);
}
function benefitNoticeTitle(input: BenefitEmail, granted: boolean, reminder: boolean) {
	if (granted) return "Access activated";
	if (reminder) return input.trial ? "Trial ending soon" : "Access ending soon";
	return input.event === "revoked" ? "Access removed" : "Access period ended";
}
function benefitNotice(input: BenefitEmail, { end }: BenefitContext, granted: boolean, reminder: boolean) {
	const text = end && input.event !== "revoked" ? `${granted || reminder ? "Access period ends" : "Access period ended"} on ${end}.` : "Your saved setup and content are still here.";
	return createElement(EmailNotice, { type: granted ? "success" : reminder ? "warning" : "info", title: benefitNoticeTitle(input, granted, reminder) }, text);
}
function benefitAction(input: BenefitEmail, { accessContinues }: BenefitContext, granted: boolean, reminder: boolean) {
	return { label: granted ? "Explore Clipify" : reminder ? (input.benefit === "pro" ? "Keep Pro" : "Keep runner access") : accessContinues ? "Open your dashboard" : "View plans", url: emailUrl(granted || accessContinues ? "/dashboard" : "/pricing") };
}
function renderGeneralBenefit(input: BenefitEmail) {
	const context = benefitContext(input);
	const granted = input.event === "granted",
		reminder = input.event.startsWith("trial-") || input.event.startsWith("access-");
	const days = reminder ? Number(input.event.split("-").at(-1)?.replace("d", "")) : 0;
	const features = reminder && input.benefit === "pro" ? createElement(ProFeatureList) : null;
	return renderBrandedEmail({
		subject: benefitSubject(input, context, granted, reminder, days),
		paragraphs: benefitParagraphs(input, context, granted, reminder, days),
		children: createElement(Fragment, null, features, benefitNotice(input, context, granted, reminder)),
		action: benefitAction(input, context, granted, reminder),
	});
}
export async function renderBenefitEmail(input: BenefitEmail) {
	if (input.partner) return renderPartnerEmail(input as Parameters<typeof renderPartnerEmail>[0]);
	if (input.event === "cancellation") return renderBenefitCancellation(input);
	if (input.event.startsWith("cancellation-")) return renderBenefitCountdown(input);
	if (input.event === "updated" || input.event === "restored") return renderBenefitChange(input);
	return renderGeneralBenefit(input);
}
