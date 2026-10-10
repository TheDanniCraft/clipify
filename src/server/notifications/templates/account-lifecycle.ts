import { EMAIL_SUPPORT_ADDRESS, EMAIL_SUPPORT_URL } from "./formatting";
import { Link } from "@react-email/components";
import { createElement } from "react";
import { emailUrl, formatEmailDate } from "./formatting";
import { EmailNotice, renderBrandedEmail } from "./layout";

export type DeletionNotificationBoundary = "request" | "suspension" | "30d" | "7d" | "3d" | "1d" | "0d" | "recovery";

export interface AccountLifecycleNotificationIntent {
	boundary: DeletionNotificationBoundary;
	recipient: string;
	templateVersion: "account-deletion-v1" | "account-recovery-v1";
	scheduledAt: Date;
	dedupeKey: string;
	payload: { effectiveAt: string; recoveryPath: string };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RECOVERY_PATH = "/dashboard/settings/account/recovery";

export function buildDeletionNotificationIntents(input: { requestId: string; recipient: string; requestedAt: Date; suspensionAt: Date; purgeEligibleAt: Date }): AccountLifecycleNotificationIntent[] {
	const boundaries: Array<{ boundary: Exclude<DeletionNotificationBoundary, "recovery">; scheduledAt: Date }> = [
		{ boundary: "request", scheduledAt: input.requestedAt },
		{ boundary: "suspension", scheduledAt: input.suspensionAt },
		{ boundary: "30d", scheduledAt: new Date(input.purgeEligibleAt.getTime() - 30 * DAY_MS) },
		{ boundary: "7d", scheduledAt: new Date(input.purgeEligibleAt.getTime() - 7 * DAY_MS) },
		{ boundary: "3d", scheduledAt: new Date(input.purgeEligibleAt.getTime() - 3 * DAY_MS) },
		{ boundary: "1d", scheduledAt: new Date(input.purgeEligibleAt.getTime() - DAY_MS) },
		{ boundary: "0d", scheduledAt: new Date(Date.UTC(input.purgeEligibleAt.getUTCFullYear(), input.purgeEligibleAt.getUTCMonth(), input.purgeEligibleAt.getUTCDate())) },
	];
	return boundaries
		.filter(({ boundary, scheduledAt }) => !/^(30|7|3|1)d$/.test(boundary) || (scheduledAt > input.requestedAt && scheduledAt.getTime() !== input.suspensionAt.getTime()))
		.map(({ boundary, scheduledAt }) => ({
			boundary,
			recipient: input.recipient,
			templateVersion: "account-deletion-v1",
			scheduledAt,
			dedupeKey: `account-deletion:${input.requestId}:${boundary}`,
			payload: { effectiveAt: input.purgeEligibleAt.toISOString(), recoveryPath: RECOVERY_PATH },
		}));
}

export function buildRecoveryNotificationIntent(input: { requestId: string; recipient: string; recoveredAt: Date }): AccountLifecycleNotificationIntent {
	return {
		boundary: "recovery",
		recipient: input.recipient,
		templateVersion: "account-recovery-v1",
		scheduledAt: input.recoveredAt,
		dedupeKey: `account-deletion:${input.requestId}:recovery`,
		payload: { effectiveAt: input.recoveredAt.toISOString(), recoveryPath: RECOVERY_PATH },
	};
}

export function renderAccountLifecycleNotification(boundary: DeletionNotificationBoundary, input: { effectiveAt: Date; recoveryPath: string }) {
	const recoveryUrl = emailUrl(input.recoveryPath);
	if (boundary === "recovery") return { subject: "Your account deletion has been canceled", body: "You successfully canceled the deletion of your Clipify account. Your account access has been restored. Billing and agency allocations were not restarted.", action: { label: "Open your account", url: emailUrl("/dashboard") }, notice: { type: "success" as const, title: "Deletion canceled", text: "Your account is no longer scheduled for deletion." } };
	const remaining = boundary === "suspension" ? "30 days" : boundary === "1d" ? "1 day" : boundary.replace("d", " days");
	const subject = boundary === "request" ? "Your account deletion has been scheduled" : boundary === "0d" ? "Your Clipify account will be deleted today" : `Your Clipify account will be deleted in ${remaining}`;
	return {
		subject,
		body: `Your account is scheduled for permanent data deletion on ${formatEmailDate(input.effectiveAt)}. Paid-feature access and data deletion are separate. Changed your mind? To cancel deletion, sign in and restore your account before that date.`,
		action: { label: "Restore account", url: recoveryUrl },
		notice: { type: boundary === "0d" ? ("error" as const) : ("warning" as const), title: boundary === "0d" ? "Last chance to restore" : "You can still restore your account", text: "Restore your account before deletion to keep your data." },
	};
}

export async function renderAccountLifecycleEmail(boundary: DeletionNotificationBoundary, input: { effectiveAt: Date; recoveryPath: string }) {
	const message = renderAccountLifecycleNotification(boundary, input);
	return renderBrandedEmail({
		subject: message.subject,
		paragraphs:
			boundary === "recovery"
				? ["We're glad you're staying with the Clipify family.", message.body]
				: [
						boundary === "request" ? "I'm sorry to see you leave the Clipify family. Thank you for making Clipify part of your creator journey." : "We're sorry to see you go. Here's a quick reminder about your account deletion so you know what happens next.",
						message.body,
						createElement("span", null, "If something didn't work as you hoped, our team is always happy to listen and help. Email us at ", createElement(Link, { href: EMAIL_SUPPORT_URL, className: "email-link", style: { color: "#5f06f5" } }, EMAIL_SUPPORT_ADDRESS), "."),
						"Daniel · Founder of Clipify",
					],
		action: message.action,
		children: createElement(EmailNotice, { type: message.notice.type, title: message.notice.title }, message.notice.text),
	});
}

/** Render only after permanent deletion has actually completed, never at the eligibility deadline. */
export async function renderAccountDeletedEmail() {
	return renderBrandedEmail({
		subject: "Your Clipify account has been deleted",
		paragraphs: [
			"I'm sorry to see you leave the Clipify family. Thank you for trusting us with part of your creator journey.",
			"Your Clipify creator account and its content have been permanently deleted.",
			"You won't receive any more emails about this account's deletion.",
			createElement("span", null, "If something went wrong or you'd like to share feedback, you can still email our team at ", createElement(Link, { href: EMAIL_SUPPORT_URL, className: "email-link", style: { color: "#5f06f5" } }, EMAIL_SUPPORT_ADDRESS), "."),
			"Wishing you all the best with whatever comes next,",
			"Daniel · Founder of Clipify",
		],
		children: createElement(EmailNotice, { type: "info", title: "Account deleted" }, "You can no longer restore this creator account."),
	});
}
