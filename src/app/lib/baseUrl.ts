export function isPreviewEnv(env: NodeJS.ProcessEnv = process.env) {
	return String(env.IS_PREVIEW).toLowerCase() === "true";
}

export function isCoolifyEnv(env: NodeJS.ProcessEnv = process.env) {
	return Object.keys(env).some((key) => /^COOLIFY_/.test(key));
}

export function resolveBaseUrl(env: NodeJS.ProcessEnv = process.env): URL {
	let url: string;

	if (env.COOLIFY_URL) {
		const rawCoolifyUrl = env.COOLIFY_URL;
		const parts = rawCoolifyUrl
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean);
		url = parts[0] || rawCoolifyUrl.trim();
	} else if (env.NODE_ENV === "development") {
		url = "http://localhost:3000";
	} else {
		url = "https://clipify.us/";
	}

	if (!/^https?:\/\//.test(url)) {
		url = `http://${url}`;
	}

	if (isCoolifyEnv(env)) {
		const hostname = new URL(url).hostname;
		url = `https://${hostname}`;
	}

	return new URL(url);
}
