/* istanbul ignore file */
"use server";

import { safeReturnPath } from "@/auth/return-url";

import { isCoolifyEnv, isPreviewEnv, resolveBaseUrl } from "@/app/lib/baseUrl";

export async function isPreview() {
	return isPreviewEnv();
}

export async function isCoolify() {
	return isCoolifyEnv();
}

export async function getBaseUrl(): Promise<URL> {
	return resolveBaseUrl();
}

export async function safeReturnUrl(input?: string | string[] | null) {
	const v = Array.isArray(input) ? input[0] : input;
	return safeReturnPath(v);
}
