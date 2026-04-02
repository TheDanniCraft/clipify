import "server-only";

const TOKEN_EXPIRY_BUFFER_MS = 15_000;
const TOKEN_FALLBACK_TTL_MS = 5 * 60 * 1000;

type AuthResponse = {
	token: string;
	record?: {
		id: string;
	};
};

let cachedAuthToken: string | null = null;
let cachedAuthTokenExpiresAt = 0;
let authPromise: Promise<string | null> | null = null;

export function getPocketBaseUrl(): string | null {
	return process.env.POCKETBASE_URL?.trim() || null;
}

export function invalidatePocketBaseAuthToken(): void {
	cachedAuthToken = null;
	cachedAuthTokenExpiresAt = 0;
	authPromise = null;
}

function parseJwtExp(token: string): number | null {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;
		const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { exp?: number };
		if (typeof payload.exp !== "number") return null;
		return payload.exp * 1000;
	} catch {
		return null;
	}
}

function setCachedToken(token: string): void {
	cachedAuthToken = token;
	cachedAuthTokenExpiresAt = parseJwtExp(token) ?? Date.now() + TOKEN_FALLBACK_TTL_MS;
}

function getCachedTokenIfValid(): string | null {
	if (!cachedAuthToken) return null;
	if (cachedAuthTokenExpiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) return cachedAuthToken;
	invalidatePocketBaseAuthToken();
	return null;
}

async function loginWithPassword(pocketBaseUrl: string): Promise<string | null> {
	const email = process.env.POCKETBASE_EMAIL?.trim();
	const password = process.env.POCKETBASE_PASSWORD?.trim();
	if (!email || !password) {
		console.warn("[pocketbase_auth] missing credentials: set POCKETBASE_EMAIL and POCKETBASE_PASSWORD");
		return null;
	}

	const authUrl = new URL("/api/collections/users/auth-with-password", pocketBaseUrl);
	const authResponse = await fetch(authUrl.toString(), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			identity: email,
			password,
		}),
		next: { revalidate: 0 },
	});

	if (!authResponse.ok) {
		console.warn("[pocketbase_auth] auth-with-password failed", { status: authResponse.status, authCollection: "users" });
		return null;
	}

	const payload = (await authResponse.json()) as AuthResponse;
	if (!payload.token) return null;
	setCachedToken(payload.token);
	return payload.token;
}

export async function getPocketBaseAuthToken(options?: { forceRefresh?: boolean }): Promise<string | null> {
	const pocketBaseUrl = getPocketBaseUrl();
	if (!pocketBaseUrl) return null;

	if (options?.forceRefresh) {
		invalidatePocketBaseAuthToken();
	}

	const existing = getCachedTokenIfValid();
	if (existing) return existing;

	if (!authPromise) {
		authPromise = loginWithPassword(pocketBaseUrl).finally(() => {
			authPromise = null;
		});
	}

	return authPromise;
}
