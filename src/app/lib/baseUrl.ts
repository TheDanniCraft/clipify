export function isPreviewEnv(env: NodeJS.ProcessEnv = process.env) {
	return String(env.IS_PREVIEW).toLowerCase() === "true";
}

export function isCoolifyEnv(env: NodeJS.ProcessEnv = process.env) {
	return Object.keys(env).some((key) => /^COOLIFY_/.test(key));
}

function isCoolifyRuntimeEnv(env: NodeJS.ProcessEnv) {
	return Boolean(env.COOLIFY_RESOURCE_UUID || env.COOLIFY_CONTAINER_NAME);
}

export function resolveBaseUrl(env: NodeJS.ProcessEnv = process.env): URL {
	let url: string;
	const coolifyUrl = env.COOLIFY_URL;
	const usesCoolifyUrl = Boolean(coolifyUrl && (isCoolifyRuntimeEnv(env) || !env.NEXT_PUBLIC_BASE_URL));

	if (usesCoolifyUrl) {
		const rawCoolifyUrl = coolifyUrl!;
		const parts = rawCoolifyUrl
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean);
		url = parts[0] || rawCoolifyUrl.trim();
	} else if (env.NEXT_PUBLIC_BASE_URL) {
		url = env.NEXT_PUBLIC_BASE_URL;
	} else if (env.NODE_ENV === "development") {
		url = "http://localhost:3000";
	} else {
		url = "https://clipify.us/";
	}

	if (!/^https?:\/\//.test(url)) {
		url = `http://${url}`;
	}

	if (usesCoolifyUrl) {
		const hostname = new URL(url).hostname;
		url = `https://${hostname}`;
	}

	return new URL(url);
}
