import { UseSend } from "usesend-js";
import { randomUUID } from "node:crypto";
import { renderIdentitySecurityEmail, type RenderedTransactionalEmail } from "@/server/notifications/templates/identity-security";

function requiredInfisicalSetting(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} must be injected by Infisical`);
	return value;
}

export async function sendAuthOtp(input: { email: string; otp: string; type: string }): Promise<void> {
	const subject = input.type === "sign-in" ? "Your Clipify sign-in code" : "Verify your Clipify email";
	await new UseSendTransactionalMailAdapter().send(input.email, { subject, text: `Your Clipify verification code is ${input.otp}. It expires in 10 minutes.`, html: `<p>Your Clipify verification code is <strong>${input.otp}</strong>.</p><p>It expires in 10 minutes.</p>`, templateVersion: "identity-security-v1" }, `auth-otp:${randomUUID()}`);
}

export async function sendTeamInvitation(input: { email: string; invitationUrl: string; organizationName: string }): Promise<void> {
	await new UseSendTransactionalMailAdapter().send(input.email, renderIdentitySecurityEmail({ type: "invitation", organizationName: input.organizationName, invitationUrl: input.invitationUrl }), `team-invitation:${randomUUID()}`);
}

export class UseSendTransactionalMailAdapter {
	readonly #client = new UseSend(requiredInfisicalSetting("USESEND_API_KEY"), requiredInfisicalSetting("USESEND_BASE_URL").replace(/\/+$/, ""));

	async send(recipient: string, email: RenderedTransactionalEmail, idempotencyKey: string) {
		const result = await this.#client.emails.send(
			{
				to: recipient,
				from: requiredInfisicalSetting("USESEND_TRANSACTIONAL_FROM"),
				replyTo: process.env.USESEND_TRANSACTIONAL_REPLY_TO,
				subject: email.subject,
				text: email.text,
				html: email.html,
			},
			{ idempotencyKey },
		);
		if (result.error) {
			const providerError = result.error as { message?: string; code?: string };
			console.error("Transactional email delivery rejected", { code: providerError.code, message: providerError.message });
			throw new Error(`Transactional email delivery failed${providerError.message ? `: ${providerError.message}` : ""}`);
		}
		return result.data?.emailId ?? null;
	}
}
