import { EMAIL_SUPPORT_URL } from "./formatting";
import { createElement } from "react";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { EmailNotice, renderBrandedEmail } from "./layout";

export async function renderAccountAccessEmail(input: { name: string; disabled: boolean; reason?: string; automatic?: boolean }) {
	const automatic = input.disabled && input.automatic;
	const subject = input.disabled ? (automatic ? "Your Twitch connection has expired" : "Your Clipify account has been disabled") : "Your Clipify account is enabled";
	const explanation = input.disabled ? (automatic ? "Clipify is no longer connected to your Twitch account. To keep using Clipify, please reconnect Twitch." : `Your Clipify account has been disabled by our team. Reason: ${input.reason || "Please contact support for details."}`) : "Your account is available again. You can sign in to Clipify. Previously paused overlays remain paused until you resume them.";
	const details = automatic ? "If this wasn't intentional, sign in again with Twitch to reconnect." : input.disabled ? "Contact us if you have questions about this decision." : "Sign in to review your account and resume your overlays when you are ready.";
	return {
		...(await renderBrandedEmail({
			subject,
			paragraphs: [`Hi ${input.name},`, explanation, ...(automatic ? ["This can happen if you haven't used Clipify for a while, or if you removed Clipify from the connections in your Twitch account settings."] : [])],
			children: createElement(EmailNotice, { type: input.disabled ? "error" : "success", title: automatic ? "Reconnect Twitch" : input.disabled ? "Account disabled" : "Access restored" }, details),
			action: { label: automatic ? "Reconnect Twitch" : input.disabled ? "Contact support" : "Open Clipify", url: input.disabled && !automatic ? EMAIL_SUPPORT_URL : new URL(automatic ? "/login" : "/dashboard", resolveBaseUrl()).href },
		})),
		templateVersion: "identity-security-v1" as const,
	};
}
