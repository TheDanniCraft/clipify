"use server";

export async function isPreview() {
	return String(process.env.IS_PREVIEW).toLowerCase() === "true";
}

export async function isCoolify() {
	return Object.keys(process.env).some((key) => /^COOLIFY_/.test(key));
}

export async function getBaseUrl(): Promise<URL> {
	let url: string;
	if (process.env.COOLIFY_URL) {
		url = process.env.COOLIFY_URL.split(",")[0] || process.env.COOLIFY_URL;
	} else if (process.env.NODE_ENV === "development") {
		url = "http://localhost:3000";
	} else {
		url = "https://clipify.us/";
	}

	if (!/^https?:\/\//.test(url)) {
		url = `http://${url}`;
	}

	// If we are running inside coolify we need to strip the port and append a schema
	if (await isCoolify()) {
		const hostname = new URL(url).hostname;
		url = `https://${hostname}`;
	}

	return new URL(url);
}

export async function safeReturnUrl(input?: string | string[] | null) {
	const v = Array.isArray(input) ? input[0] : input;
	if (!v) return null;
	if (!v.startsWith("/")) return null;
	if (v.startsWith("//")) return null;
	return v;
}
