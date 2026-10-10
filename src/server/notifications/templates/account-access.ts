import { EMAIL_SUPPORT_URL } from "./formatting";
import { createElement } from "react";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { EmailNotice, renderBrandedEmail } from "./layout";

type AccountAccessInput = { name: string; disabled: boolean; reason?: string; automatic?: boolean };
function accountAccessMessage(input: AccountAccessInput) {
	if (!input.disabled)
		return {
			subject: "Your Clipify account is enabled",
			explanation: "Your account is available again. You can sign in to Clipify. Previously paused overlays remain paused until you resume them.",
			details: "Sign in to review your account and resume your overlays when you are ready.",
			title: "Access restored",
			type: "success" as const,
			action: { label: "Open Clipify", url: new URL("/dashboard", resolveBaseUrl()).href },
			paragraphs: [] as string[],
		};
	if (input.automatic)
		return {
			subject: "Your Twitch connection has expired",
			explanation: "Clipify is no longer connected to your Twitch account. To keep using Clipify, please reconnect Twitch.",
			details: "If this wasn't intentional, sign in again with Twitch to reconnect.",
			title: "Reconnect Twitch",
			type: "error" as const,
			action: { label: "Reconnect Twitch", url: new URL("/login", resolveBaseUrl()).href },
			paragraphs: ["This can happen if you haven't used Clipify for a while, or if you removed Clipify from the connections in your Twitch account settings."],
		};
	return {
		subject: "Your Clipify account has been disabled",
		explanation: `Your Clipify account has been disabled by our team. Reason: ${input.reason || "Please contact support for details."}`,
		details: "Contact us if you have questions about this decision.",
		title: "Account disabled",
		type: "error" as const,
		action: { label: "Contact support", url: EMAIL_SUPPORT_URL },
		paragraphs: [] as string[],
	};
}
export async function renderAccountAccessEmail(input: AccountAccessInput) {
	const message = accountAccessMessage(input);
	return {
		...(await renderBrandedEmail({
			subject: message.subject,
			paragraphs: [`Hi ${input.name},`, message.explanation, ...message.paragraphs],
			children: createElement(EmailNotice, { type: message.type, title: message.title }, message.details),
			action: message.action,
		})),
		templateVersion: "identity-security-v1" as const,
	};
}
