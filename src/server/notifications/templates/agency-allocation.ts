import { EXPIRY_REMINDER_DAYS } from "../reminder-schedule";
import { createElement } from "react";
import { emailUrl, formatEmailDate } from "./formatting";
import { EmailNotice, renderBrandedEmail } from "./layout";

export type AgencyAllocationNotice = "granted" | "removal-scheduled" | "removal-30d" | "removal-7d" | "removal-3d" | "removal-1d" | "ended";

export interface AgencyAllocationNotificationIntent {
	boundary: AgencyAllocationNotice;
	recipient: string;
	templateVersion: "agency-allocation-v1";
	scheduledAt: Date;
	dedupeKey: string;
	payload: { agencyName: string; effectiveAt: string; product?: "creator_pro" | "runner" };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildAgencyAllocationRemovalIntents(input: { allocationId: string; recipient: string; agencyName: string; product?: "creator_pro" | "runner"; requestedAt: Date; endsAt: Date }): AgencyAllocationNotificationIntent[] {
	return [{ boundary: "removal-scheduled", scheduledAt: input.requestedAt }, ...EXPIRY_REMINDER_DAYS.map((days) => ({ boundary: `removal-${days}d`, scheduledAt: new Date(input.endsAt.getTime() - days * DAY_MS) })).filter((notice) => notice.scheduledAt > input.requestedAt), { boundary: "ended", scheduledAt: input.endsAt }].map(({ boundary, scheduledAt }) => ({
		boundary: boundary as AgencyAllocationNotice,
		recipient: input.recipient,
		templateVersion: "agency-allocation-v1",
		scheduledAt,
		dedupeKey: `agency-allocation:${input.allocationId}:${boundary}:${input.endsAt.getTime()}`,
		payload: { agencyName: input.agencyName, product: input.product ?? "creator_pro", effectiveAt: input.endsAt.toISOString() },
	}));
}

export function buildAgencyAllocationGrantIntent(input: { allocationId: string; recipient: string; agencyName: string; product?: "creator_pro" | "runner"; effectiveAt: Date }): AgencyAllocationNotificationIntent {
	return {
		boundary: "granted",
		recipient: input.recipient,
		templateVersion: "agency-allocation-v1",
		scheduledAt: input.effectiveAt,
		dedupeKey: `agency-allocation:${input.allocationId}:granted`,
		payload: { agencyName: input.agencyName, product: input.product ?? "creator_pro", effectiveAt: input.effectiveAt.toISOString() },
	};
}

export function renderAgencyAllocationNotification(boundary: AgencyAllocationNotice, input: { agencyName: string; product?: "creator_pro" | "runner"; effectiveAt: Date }) {
	const benefit = input.product === "runner" ? "runner" : "Pro";
	if (boundary === "granted") return { subject: `Your Clipify ${benefit} access via ${input.agencyName} is active`, body: `${input.agencyName} is now providing ${benefit} access for your creator account. You're ready to use these features.`, action: { label: "Open your dashboard", url: emailUrl("/dashboard") }, notice: { type: "success" as const, title: `${benefit} access is active`, text: `Your agency is providing your Clipify ${benefit} access.` } };
	if (boundary === "ended")
		return {
			subject: `Your Clipify ${benefit} access via ${input.agencyName} has ended`,
			body: `Agency-funded access from ${input.agencyName} ended on ${formatEmailDate(input.effectiveAt)}. Your creator-owned benefits and data remain unchanged. If you need continued ${benefit} access, you can choose your own plan.`,
			action: { label: input.product === "runner" ? "View runner plans" : "View Pro plans", url: emailUrl("/pricing") },
			notice: { type: "info" as const, title: `Agency-funded ${benefit} ended`, text: "Your creator account and saved content are still yours." },
		};
	const days = Number(boundary.slice("removal-".length, -1));
	const remaining = `${days} ${days === 1 ? "day" : "days"}`;
	return {
		subject: boundary === "removal-scheduled" ? `Your Clipify ${benefit} access via ${input.agencyName} will end` : `Your Clipify ${benefit} access via ${input.agencyName} ends in ${remaining}`,
		body: `${input.agencyName} scheduled your agency-funded ${benefit} access to end on ${formatEmailDate(input.effectiveAt)}. Your data and creator-owned benefits will remain. You can choose your own ${benefit} plan if you want to continue using these features.`,
		action: { label: input.product === "runner" ? "View runner plans" : "View Pro plans", url: emailUrl("/pricing") },
		notice: { type: "warning" as const, title: boundary === "removal-scheduled" ? `${benefit} access is ending` : `${benefit} access ends in ${remaining}`, text: `Choose your own plan if you need continued ${benefit} access.` },
	};
}

export async function renderAgencyAllocationEmail(boundary: AgencyAllocationNotice, input: { agencyName: string; product?: "creator_pro" | "runner"; effectiveAt: Date }) {
	const message = renderAgencyAllocationNotification(boundary, input);
	return renderBrandedEmail({ subject: message.subject, paragraphs: [message.body], action: message.action, children: createElement(EmailNotice, { type: message.notice.type, title: message.notice.title }, message.notice.text) });
}
