const prefix = "clipify:oauth-login-retry:";
const lifetime = 10 * 60 * 1000;

function isAuthorizationLogin(path: string): boolean {
	const url = new URL(path, "https://clipify.invalid");
	return url.origin === "https://clipify.invalid" && url.pathname === "/login" && !url.hash && url.searchParams.has("client_id") && url.searchParams.has("sig");
}

/** Keep retry navigation out of the proxy's doubly encrypted OAuth state. */
export function saveOAuthLoginRetry(storage: Storage, path: string): string {
	if (!isAuthorizationLogin(path)) throw new Error("INVALID_LOGIN_CONTINUATION");
	const id = crypto.randomUUID();
	storage.setItem(prefix + id, JSON.stringify({ path, expiresAt: Date.now() + lifetime }));
	return `/login?oauthRetry=${id}`;
}

export function restoreOAuthLoginRetry(storage: Storage, search: string): string | null {
	const parameters = new URLSearchParams(search);
	const id = parameters.get("oauthRetry");
	if (!id || !/^[\da-f-]{36}$/.test(id)) return null;
	const key = prefix + id;
	const raw = storage.getItem(key);
	storage.removeItem(key);
	if (!raw) return null;
	try {
		const saved = JSON.parse(raw);
		if (typeof saved.path !== "string" || typeof saved.expiresAt !== "number" || saved.expiresAt <= Date.now() || !isAuthorizationLogin(saved.path)) return null;
		const url = new URL(saved.path, "https://clipify.invalid");
		// The provider failure is presentation only; retain every signed parameter.
		for (const key of ["error", "errorCode"]) if (parameters.has(key)) url.searchParams.set(key, parameters.get(key)!);
		return url.pathname + url.search;
	} catch {
		return null;
	}
}
