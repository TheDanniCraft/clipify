"use server";

import { headers } from "next/headers";
import { auth } from "@/auth/config";

const FRESH_SESSION_MS = 5 * 60 * 1000;
const FRESH_SESSION_SAFETY_MS = 5_000;

export type DisconnectLinkedAccountResult = { success: true; providerId: string } | { success: false; code: "ACCOUNT_NOT_FOUND" | "REAUTHENTICATION_REQUIRED" | "REVOCATION_FAILED" | "SERVICE_UNAVAILABLE"; error: string; reauthProvider?: "twitch" | "google" };

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

async function revokeProviderGrant(providerId: string, accessToken: string) {
	if (providerId === "google") {
		const response = await fetch("https://oauth2.googleapis.com/revoke", {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ token: accessToken }),
			cache: "no-store",
			redirect: "error",
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) throw new Error("PROVIDER_REVOCATION_FAILED");
		return;
	}
	if (providerId === "twitch") {
		const clientId = process.env.TWITCH_CLIENT_ID?.trim();
		if (!clientId) throw new Error("PROVIDER_UNAVAILABLE");
		const response = await fetch("https://id.twitch.tv/oauth2/revoke", {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ client_id: clientId, token: accessToken }),
			cache: "no-store",
			redirect: "error",
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) throw new Error("PROVIDER_REVOCATION_FAILED");
	}
}

function isSessionFreshnessError(error: unknown) {
	if (error instanceof Error && /session is not fresh|session_not_fresh/i.test(error.message)) return true;
	if (!error || typeof error !== "object") return false;
	const candidate = error as { code?: unknown; message?: unknown; body?: { code?: unknown; message?: unknown } };
	return [candidate.code, candidate.message, candidate.body?.code, candidate.body?.message].some((value) => typeof value === "string" && /session is not fresh|session_not_fresh/i.test(value));
}

export async function disconnectLinkedAccount(accountId: string): Promise<DisconnectLinkedAccountResult> {
	if (typeof accountId !== "string" || accountId.length < 1 || accountId.length > 255) return { success: false, code: "ACCOUNT_NOT_FOUND", error: "This account is no longer linked." };
	const requestHeaders = await headers();
	const session = await auth.api.getSession({ headers: requestHeaders });
	if (!session) return { success: false, code: "REAUTHENTICATION_REQUIRED", error: "Sign in again before disconnecting this account." };
	const accounts = await auth.api.listUserAccounts({ headers: requestHeaders });
	const account = accounts.find((candidate) => candidate.id === accountId);
	if (!account || (account.providerId !== "twitch" && account.providerId !== "google")) return { success: false, code: "ACCOUNT_NOT_FOUND", error: "This account is no longer linked." };
	const reauthProvider = ([account.providerId, ...accounts.map((candidate) => candidate.providerId)].find((provider) => provider === "twitch" || provider === "google") ?? undefined) as "twitch" | "google" | undefined;
	if (Date.now() - new Date(session.session.createdAt).getTime() >= FRESH_SESSION_MS - FRESH_SESSION_SAFETY_MS) {
		return { success: false, code: "REAUTHENTICATION_REQUIRED", error: "Sign in again before disconnecting this account.", reauthProvider };
	}
	try {
		const token = await auth.api.getAccessToken({ headers: requestHeaders, body: { accountId: account.id } });
		await revokeProviderGrant(account.providerId, token.accessToken);
		await auth.api.unlinkAccount({ headers: requestHeaders, body: { accountId: account.id } });
		return { success: true, providerId: account.providerId };
	} catch (error) {
		if (isSessionFreshnessError(error)) {
			return { success: false, code: "REAUTHENTICATION_REQUIRED", error: "Sign in again before disconnecting this account.", reauthProvider };
		}
		if (error instanceof Error && (error.message === "PROVIDER_REVOCATION_FAILED" || error.message === "PROVIDER_UNAVAILABLE")) {
			return { success: false, code: "REVOCATION_FAILED", error: "The provider could not disconnect this account. Please try again." };
		}
		return { success: false, code: "SERVICE_UNAVAILABLE", error: "This account could not be disconnected. Please try again." };
	}
}
