"use server";

export async function isPreview() {
	return String(process.env.IS_PREVIEW).toLowerCase() === "true";
}

export async function isCoolify() {
	return Object.keys(process.env).some((key) => /^COOLIFY_/.test(key));
}

export async function getBaseUrl(): Promise<URL> {
	let url = process.env.COOLIFY_URL || "http://localhost:3000";

	if (!/^https?:\/\//.test(url)) {
		url = `http://${url}`;
	}

	// If we are running inside coolify we need to strip the port and append a schemema
	if (await isCoolify()) {
		const hostname = new URL(url).hostname;
		url = `https://${hostname}`;
	}

	return new URL(url);
}
