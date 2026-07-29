/* istanbul ignore file */
"use server";

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
	if (!v) return null;
	if (!v.startsWith("/")) return null;
	if (v.startsWith("//")) return null;
	return v;
}
