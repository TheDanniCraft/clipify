/** Delivery and footer policy for server-authored emails, shared by rendering and sending. */
const accountReason = "You are receiving this email because you have a Clipify.us account.";

export const emailRegistry = {
	"account-notification": { category: "account", receivingReason: accountReason },
	welcome: { category: "personal", receivingReason: accountReason },
	"first-pro": { category: "personal", receivingReason: accountReason },
	renewal: { category: "personal", receivingReason: accountReason },
	"welcome-back": { category: "personal", receivingReason: accountReason },
	"payment-ended": { category: "account", receivingReason: accountReason },
	"sign-in-code": { category: "service", receivingReason: "You are receiving this email because you requested a Clipify.us sign-in code." },
	"email-verification": { category: "service", receivingReason: "You are receiving this email because you requested a Clipify.us email verification code." },
	invitation: { category: "service", receivingReason: "You are receiving this email because you were invited to a team on Clipify.us." },
	"account-data-export": { category: "service", receivingReason: "You are receiving this email because you requested a copy of your Clipify.us data." },
	"account-deleted": { category: "account", receivingReason: "You are receiving this email because you requested deletion of your Clipify.us account." },
} as const;

export type EmailType = keyof typeof emailRegistry;

export function emailDeliveryHeaders(type: EmailType, settings: { noReplySender: string; replyTo: string }) {
	const serviceAddress = settings.noReplySender.match(/<([^<>]+)>/)?.[1] ?? settings.noReplySender;
	const categories = {
		personal: { from: "Daniel from Clipify.us <hello@clipify.us>", replyTo: settings.replyTo },
		account: { from: "Clipify.us <notifications@clipify.us>", replyTo: settings.replyTo },
		service: { from: `Clipify.us <${serviceAddress}>` },
	};
	return categories[emailRegistry[type].category];
}

const verificationCode = { emailType: "email-verification" as const, subject: "Verify your Clipify.us email" };
const authCodeRegistry: Record<string, { emailType: EmailType; subject: string }> = {
	"sign-in": { emailType: "sign-in-code", subject: "Your Clipify.us sign-in code" },
	"email-verification": verificationCode,
	"change-email": verificationCode,
	"forget-password": verificationCode,
};

export function authCodeEmail(type: string) {
	return authCodeRegistry[type] ?? verificationCode;
}
