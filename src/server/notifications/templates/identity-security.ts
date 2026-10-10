import { EMAIL_SUPPORT_ADDRESS, EMAIL_SUPPORT_URL } from "./formatting";
import { createElement } from "react";
import { Link } from "@react-email/components";
import { emailUrl, formatEmailDate } from "./formatting";
import { EmailNotice, renderBrandedEmail } from "./layout";

export type IdentitySecurityTemplateInput =
	| { type: "welcome"; name: string }
	| { type: "invitation"; organizationName: string; invitationUrl: string }
	| { type: "security"; message: string; change?: never }
	| { type: "security"; change: "passkey-added" | "passkey-removed" | "email-changed"; message?: never }
	| { type: "organization-membership"; organizationName: string; status: "joined" | "removed" }
	| { type: "account-data-export"; downloadUrl: string; expiresAt: Date }
	| { type: "agency-access"; agencyName: string; creatorName: string; status: "granted" | "removed" };

export interface RenderedTransactionalEmail {
	subject: string;
	text: string;
	html: string;
	templateVersion: "identity-security-v1";
}

export async function renderIdentitySecurityEmail(input: IdentitySecurityTemplateInput): Promise<RenderedTransactionalEmail> {
	let content: Parameters<typeof renderBrandedEmail>[0];
	if (input.type === "welcome") {
		content = {
			subject: "Welcome to the Clipify family",
			paragraphs: [
				`Hi ${input.name},`,
				"I'm Daniel, also known as TheDanniCraft, the founder of Clipify. I'm happy to have you on board and excited to be part of your creator journey.",
				"Clipify is here to help your clips keep talking, even when you can't. Start with your first overlay or playlist, and make it your own.",
				createElement("span", null, "If you get stuck, something goes wrong, or you have an idea to share, email us at ", createElement(Link, { href: EMAIL_SUPPORT_URL, className: "email-link", style: { color: "#5f06f5" } }, EMAIL_SUPPORT_ADDRESS), ". We're always happy to help."),
				"Happy to have you here,",
				"Daniel · Founder of Clipify",
			],
			children: createElement(EmailNotice, { type: "info", title: "Need a hand?" }, createElement(Link, { href: "https://help.clipify.us/", className: "email-link", style: { color: "#5f06f5" } }, "Visit our Help Center for setup guides and answers.")),
			action: { label: "Open your dashboard", url: emailUrl("/dashboard") },
		};
	} else if (input.type === "invitation") {
		content = { subject: `You were invited to ${input.organizationName} on Clipify`, receivingReason: "You are receiving this email because you were invited to a team on Clipify.", paragraphs: [`You were invited to join ${input.organizationName} on Clipify.`], action: { label: "Accept invitation", url: input.invitationUrl } };
	} else if (input.type === "security") {
		const changes = { "passkey-added": "A passkey was added to your Clipify account.", "passkey-removed": "A passkey was removed from your Clipify account.", "email-changed": "The email address on your Clipify account was changed." };
		content = { subject: "Clipify security notice", paragraphs: [input.change ? changes[input.change] : input.message], children: createElement(EmailNotice, { type: "warning", title: "Didn't make this change?" }, "Contact support right away so we can help you secure your account."), action: { label: "Contact support", url: EMAIL_SUPPORT_URL } };
	} else if (input.type === "account-data-export") {
		content = { subject: "Your Clipify data export is ready", title: "Your data export is ready", paragraphs: ["Your Clipify data package is ready to download."], children: createElement(EmailNotice, { type: "error", title: "Keep this link private" }, `This link expires on ${formatEmailDate(input.expiresAt)} and only works while signed in to the account that requested it. Do not share it.`), action: { label: "Download your data package", url: input.downloadUrl } };
	} else if (input.type === "organization-membership") {
		const joined = input.status === "joined";
		content = {
			subject: joined ? `You're now part of ${input.organizationName}` : `You were removed from ${input.organizationName}`,
			paragraphs: [joined ? `You successfully joined ${input.organizationName} on Clipify.` : `Your membership in ${input.organizationName} on Clipify has ended.`],
			children: createElement(EmailNotice, { type: joined ? "success" : "info", title: joined ? "You're on the team" : "Membership ended" }, joined ? "You can now access the organization according to your assigned role." : "Your personal creator account remains available. Organization membership and agency-funded Pro access are managed separately."),
			action: { label: "Contact support", url: EMAIL_SUPPORT_URL },
		};
	} else {
		content = {
			subject: input.status === "granted" ? `Your account is now managed by ${input.agencyName}` : `Your account is no longer managed by ${input.agencyName}`,
			paragraphs: [input.status === "granted" ? `${input.agencyName} can now manage your creator account, ${input.creatorName}, according to the permissions you approved.` : `${input.agencyName} can no longer manage your creator account, ${input.creatorName}.`],
			children: createElement(EmailNotice, { type: input.status === "granted" ? "success" : "info", title: input.status === "granted" ? "Agency connected" : "Agency disconnected" }, input.status === "granted" ? "The agency can now manage this creator account according to its permissions." : "The agency can no longer manage this creator account."),
			action: { label: "Contact support", url: EMAIL_SUPPORT_URL },
		};
	}
	return { ...(await renderBrandedEmail(content)), templateVersion: "identity-security-v1" };
}
