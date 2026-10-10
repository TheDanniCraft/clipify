"use server";

import { headers } from "next/headers";
import { auth } from "@/auth/config";

async function sessionIdentity() {
	const requestHeaders = await headers();
	const session = await auth.api.getSession({ headers: requestHeaders });
	if (!session?.user.email) throw new Error("AUTHENTICATION_REQUIRED");
	return { requestHeaders, email: session.user.email.toLowerCase() };
}

export async function requestCurrentEmailChangeCode() {
	const { requestHeaders, email } = await sessionIdentity();
	await auth.api.sendVerificationOTP({ headers: requestHeaders, body: { email, type: "email-verification" } });
}

export async function requestNewEmailChangeCode(newEmailInput: string, currentEmailOtp: string) {
	const { requestHeaders } = await sessionIdentity();
	const newEmail = newEmailInput.trim().toLowerCase();
	await auth.api.requestEmailChangeEmailOTP({ headers: requestHeaders, body: { newEmail, otp: currentEmailOtp.trim() } });
}
