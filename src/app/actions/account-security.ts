"use server";

import { headers } from "next/headers";
import { auth } from "@/auth/config";
import { sendAuthOtp } from "@/auth/transactional-mail";

async function sessionIdentity() {
	const requestHeaders = await headers();
	const session = await auth.api.getSession({ headers: requestHeaders });
	if (!session?.user.email) throw new Error("AUTHENTICATION_REQUIRED");
	return { requestHeaders, email: session.user.email.toLowerCase() };
}

export async function requestCurrentEmailChangeCode() {
	const { email } = await sessionIdentity();
	const otp = await auth.api.createVerificationOTP({ body: { email, type: "email-verification" } });
	await sendAuthOtp({ email, otp, type: "email-verification" });
}

export async function requestNewEmailChangeCode(newEmailInput: string, currentEmailOtp: string) {
	const { requestHeaders, email } = await sessionIdentity();
	const newEmail = newEmailInput.trim().toLowerCase();
	await auth.api.requestEmailChangeEmailOTP({ headers: requestHeaders, body: { newEmail, otp: currentEmailOtp.trim() } });
	const result = await auth.api.getVerificationOTP({ query: { email: `${email}-${newEmail}`, type: "change-email" } });
	if (!result.otp) throw new Error("EMAIL_CHANGE_OTP_NOT_CREATED");
	await sendAuthOtp({ email: newEmail, otp: result.otp, type: "change-email" });
}
