import { EMAIL_SUPPORT_ADDRESS, EMAIL_SUPPORT_URL } from "./formatting";
import { createElement } from "react";
import { Link } from "./email-links";
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

function welcomeContent(input: Extract<IdentitySecurityTemplateInput, { type: "welcome" }>): Parameters<typeof renderBrandedEmail>[0] {
	return {
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
}

function invitationContent(input: Extract<IdentitySecurityTemplateInput, { type: "invitation" }>): Parameters<typeof renderBrandedEmail>[0] {
	return { subject: `You were invited to ${input.organizationName} on Clipify`, receivingReason: "You are receiving this email because you were invited to a team on Clipify.", paragraphs: [`You were invited to join ${input.organizationName} on Clipify.`], action: { label: "Accept invitation", url: input.invitationUrl } };
}

function securityContent(input: Extract<IdentitySecurityTemplateInput, { type: "security" }>): Parameters<typeof renderBrandedEmail>[0] {
	const changes = { "passkey-added": "A passkey was added to your Clipify account.", "passkey-removed": "A passkey was removed from your Clipify account.", "email-changed": "The email address on your Clipify account was changed." };
	return { subject: "Clipify security notice", paragraphs: [input.change ? changes[input.change] : input.message], children: createElement(EmailNotice, { type: "warning", title: "Didn't make this change?" }, "Contact support right away so we can help you secure your account."), action: { label: "Contact support", url: EMAIL_SUPPORT_URL } };
}

function exportContent(input: Extract<IdentitySecurityTemplateInput, { type: "account-data-export" }>): Parameters<typeof renderBrandedEmail>[0] {
	return { subject: "Your Clipify data export is ready", title: "Your data export is ready", paragraphs: ["Your Clipify data package is ready to download."], children: createElement(EmailNotice, { type: "error", title: "Keep this link private" }, `This link expires on ${formatEmailDate(input.expiresAt)} and only works while signed in to the account that requested it. Do not share it.`), action: { label: "Download your data package", url: input.downloadUrl } };
}

function organizationContent(input: Extract<IdentitySecurityTemplateInput, { type: "organization-membership" }>): Parameters<typeof renderBrandedEmail>[0] {
	const joined = input.status === "joined";
	return {
		subject: joined ? `You're now part of ${input.organizationName}` : `You were removed from ${input.organizationName}`,
		paragraphs: [joined ? `You successfully joined ${input.organizationName} on Clipify.` : `Your membership in ${input.organizationName} on Clipify has ended.`],
		children: createElement(EmailNotice, { type: joined ? "success" : "info", title: joined ? "You're on the team" : "Membership ended" }, joined ? "You can now access the organization according to your assigned role." : "Your personal creator account remains available. Organization membership and agency-funded Pro access are managed separately."),
		action: { label: "Contact support", url: EMAIL_SUPPORT_URL },
	};
}

function agencyContent(input: Extract<IdentitySecurityTemplateInput, { type: "agency-access" }>): Parameters<typeof renderBrandedEmail>[0] {
	return {
		subject: input.status === "granted" ? `Your account is now managed by ${input.agencyName}` : `Your account is no longer managed by ${input.agencyName}`,
		paragraphs: [input.status === "granted" ? `${input.agencyName} can now manage your creator account, ${input.creatorName}, according to the permissions you approved.` : `${input.agencyName} can no longer manage your creator account, ${input.creatorName}.`],
		children: createElement(EmailNotice, { type: input.status === "granted" ? "success" : "info", title: input.status === "granted" ? "Agency connected" : "Agency disconnected" }, input.status === "granted" ? "The agency can now manage this creator account according to its permissions." : "The agency can no longer manage this creator account."),
		action: { label: "Contact support", url: EMAIL_SUPPORT_URL },
	};
}
function identityContent(input: IdentitySecurityTemplateInput) {
	switch (input.type) {
		case "welcome":
			return welcomeContent(input);
		case "invitation":
			return invitationContent(input);
		case "security":
			return securityContent(input);
		case "account-data-export":
			return exportContent(input);
		case "organization-membership":
			return organizationContent(input);
		case "agency-access":
			return agencyContent(input);
	}
}
export async function renderIdentitySecurityEmail(input: IdentitySecurityTemplateInput): Promise<RenderedTransactionalEmail> {
	return { ...(await renderBrandedEmail(identityContent(input))), templateVersion: "identity-security-v1" };
}
