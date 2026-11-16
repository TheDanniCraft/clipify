import { restoreOAuthLoginRetry, saveOAuthLoginRetry } from "@/auth/oauth-login-retry";

const query = "client_id=client&state=relay&sig=signed&ba_param=client_id&ba_param=state&ba_param=ba_param";

beforeEach(() => sessionStorage.clear());

test("a short tab-local reference restores all signed parameters and the provider error once", () => {
	const retry = saveOAuthLoginRetry(sessionStorage, `/login?${query}`);
	expect(retry.length).toBeLessThan(80);
	const search = new URL(retry, "https://clipify.invalid").search + "&error=access_denied";
	const restored = new URL(restoreOAuthLoginRetry(sessionStorage, search)!, "https://clipify.invalid");
	expect(restored.searchParams.getAll("ba_param")).toEqual(["client_id", "state", "ba_param"]);
	for (const [key, value] of new URLSearchParams(query)) expect(restored.searchParams.getAll(key)).toContain(value);
	expect(restored.searchParams.get("error")).toBe("access_denied");
	expect(restoreOAuthLoginRetry(sessionStorage, search)).toBeNull();
});

test("a different browser tab cannot restore the reference", () => {
	const retry = saveOAuthLoginRetry(sessionStorage, `/login?${query}`);
	sessionStorage.clear();
	expect(restoreOAuthLoginRetry(sessionStorage, new URL(retry, location.origin).search)).toBeNull();
});

test("an expired request cannot be restored", () => {
	const now = jest.spyOn(Date, "now").mockReturnValue(1000);
	try {
		const retry = saveOAuthLoginRetry(sessionStorage, `/login?${query}`);
		now.mockReturnValue(1000 + 10 * 60 * 1000);
		expect(restoreOAuthLoginRetry(sessionStorage, new URL(retry, location.origin).search)).toBeNull();
	} finally {
		now.mockRestore();
	}
});

test.each(["https://evil.invalid/login?" + query, "//evil.invalid/login?" + query, "/dashboard?" + query, "/login?client_id=client", "/login?" + query + "#fragment"])("does not save unsafe or unrelated destination %s", (path) => {
	expect(() => saveOAuthLoginRetry(sessionStorage, path)).toThrow("INVALID_LOGIN_CONTINUATION");
	expect(sessionStorage.length).toBe(0);
});

test.each(["not-json", JSON.stringify({ path: "https://evil.invalid/login?" + query, expiresAt: Date.now() + 60000 }), JSON.stringify({ path: "/login?" + query, expiresAt: "later" })])("rejects damaged or tampered tab storage", (raw) => {
	const id = "12345678-1234-1234-1234-123456789012";
	sessionStorage.setItem("clipify:oauth-login-retry:" + id, raw);
	expect(restoreOAuthLoginRetry(sessionStorage, "?oauthRetry=" + id)).toBeNull();
});
