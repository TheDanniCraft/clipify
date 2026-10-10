import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { createAuthClient } from "better-auth/client";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

const origin = "https://clipify.example";
const secret = "mcp-continuation-fixture-secret-32characters";
const verifier = "v".repeat(64);
const relayState = "openai_platform_oauth_relay__" + "x".repeat(1200);
const cookieHeader = (response) =>
	response.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");

function makeAuth() {
	const plugins = [jwt(), mcp({ loginPage: "/login", consentPage: "/auth/mcp/consent", resource: `${origin}/mcp`, scopes: ["creator:read"], allowDynamicClientRegistration: true, allowUnauthenticatedClientRegistration: true })];
	const database = Object.fromEntries(["user", "session", "account", "verification", ...plugins.flatMap((plugin) => Object.keys(plugin.schema ?? {}))].map((model) => [model, []]));
	return betterAuth({
		baseURL: origin,
		secret,
		database: memoryAdapter(database),
		account: { storeStateStrategy: "database" },
		socialProviders: { twitch: { clientId: "fixture", clientSecret: "fixture", getUserInfo: async () => ({ user: { id: "twitch-fixture", name: "Fixture", email: "fixture@example.invalid", emailVerified: true }, data: { sub: "twitch-fixture" } }) } },
		plugins,
	});
}

async function startAuthorization(auth) {
	const client = await auth.api.registerOAuthClient({ body: { client_name: "Fixture", redirect_uris: ["https://client.example/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code"], scope: "creator:read" } });
	const query = new URLSearchParams({ client_id: client.client_id, redirect_uri: "https://client.example/callback", response_type: "code", scope: "creator:read", state: relayState, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", resource: `${origin}/mcp` });
	const response = await auth.handler(new Request(`${origin}/api/auth/oauth2/authorize?${query}`, { headers: { accept: "text/html" } }));
	assert.equal(response.status, 302);
	const login = new URL(response.headers.get("location"), origin);
	assert.equal(login.pathname, "/login");
	assert.equal(login.searchParams.has("returnUrl"), false);
	return { login, client };
}

async function signIn(auth, login) {
	let response;
	const originalWindow = globalThis.window;
	globalThis.window = { location: { search: login.search } };
	try {
		const authClient = createAuthClient({
			baseURL: origin,
			plugins: [oauthProviderClient()],
			fetchOptions: {
				customFetchImpl: async (url, init) => {
					response = await auth.handler(new Request(url, init));
					return response;
				},
			},
		});
		const result = await authClient.signIn.social({ provider: "twitch", callbackURL: "/dashboard", errorCallbackURL: `/login${login.search}`, disableRedirect: true });
		return { response, result };
	} finally {
		if (originalWindow === undefined) delete globalThis.window;
		else globalThis.window = originalWindow;
	}
}

async function completeTwitch(auth, signedIn) {
	assert.equal(signedIn.result.error, null);
	const state = new URL(signedIn.result.data.url).searchParams.get("state");
	assert.equal(state.length, 32);
	assert.ok(signedIn.response.headers.getSetCookie().every((cookie) => Buffer.byteLength(cookie) < 4096));
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (input) => {
		assert.equal(String(input), "https://id.twitch.tv/oauth2/token");
		return Response.json({ access_token: "fixture-access", refresh_token: "fixture-refresh", expires_in: 3600, token_type: "bearer" });
	};
	try {
		return await auth.handler(new Request(`${origin}/api/auth/callback/twitch?code=fixture-code&state=${state}`, { headers: { cookie: cookieHeader(signedIn.response), accept: "text/html" } }));
	} finally {
		globalThis.fetch = originalFetch;
	}
}

test("native provider completes long MCP login, consent and PKCE token exchange", async () => {
	const auth = makeAuth();
	const { login, client } = await startAuthorization(auth);
	const signedIn = await signIn(auth, login);
	const callback = await completeTwitch(auth, signedIn);
	const consent = new URL(callback.headers.get("location"), origin);
	assert.equal(consent.pathname, "/auth/mcp/consent");
	assert.equal(consent.searchParams.get("state"), relayState);
	const response = await auth.handler(new Request(`${origin}/api/auth/oauth2/consent`, { method: "POST", headers: { cookie: cookieHeader(callback), origin, "content-type": "application/json" }, body: JSON.stringify({ accept: true, oauth_query: consent.search.slice(1) }) }));
	assert.equal(response.status, 200);
	const destination = new URL((await response.json()).url);
	assert.equal(destination.origin, "https://client.example");
	assert.equal(destination.searchParams.get("state"), relayState);
	assert.ok(destination.searchParams.get("code"));
	const token = await auth.handler(new Request(`${origin}/api/auth/oauth2/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: client.client_id, code: destination.searchParams.get("code"), redirect_uri: "https://client.example/callback", code_verifier: verifier, resource: `${origin}/mcp` }) }));
	assert.equal(token.status, 200);
	assert.ok((await token.json()).access_token);
});

test("Twitch cancellation returns to the native signed login query for retry", async () => {
	const auth = makeAuth();
	const { login } = await startAuthorization(auth);
	const signedIn = await signIn(auth, login);
	const state = new URL(signedIn.result.data.url).searchParams.get("state");
	const response = await auth.handler(new Request(`${origin}/api/auth/callback/twitch?error=access_denied&state=${state}`, { headers: { cookie: cookieHeader(signedIn.response), accept: "text/html" } }));
	const retry = new URL(response.headers.get("location"), origin);
	assert.equal(retry.pathname, "/login");
	assert.equal(retry.searchParams.get("state"), relayState);
	assert.equal(retry.searchParams.get("sig"), login.searchParams.get("sig"));
	assert.equal(retry.searchParams.get("error"), "access_denied");
	assert.equal((await signIn(auth, retry)).result.error, null);
});

test("the provider rejects tampered authorization before starting Twitch sign-in", async () => {
	const auth = makeAuth();
	const { login } = await startAuthorization(auth);
	login.searchParams.set("state", "tampered");
	const { response, result } = await signIn(auth, login);
	assert.equal(response.status, 400);
	assert.ok(result.error);
	assert.equal(response.headers.getSetCookie().length, 0);
});

test("the provider rejects expired authorization instead of falling back to ordinary login", async () => {
	const auth = makeAuth();
	const originalNow = Date.now;
	Date.now = () => originalNow() - 11 * 60 * 1000;
	let login;
	try {
		({ login } = await startAuthorization(auth));
	} finally {
		Date.now = originalNow;
	}
	const { response, result } = await signIn(auth, login);
	assert.equal(response.status, 400);
	assert.ok(result.error);
});

test("native email change delivers both codes with hashed storage and updates the verified address", async () => {
	const { emailOTP } = await import("better-auth/plugins");
	const delivered = [];
	const database = { user: [], account: [], session: [], verification: [] };
	const auth = betterAuth({
		baseURL: origin,
		secret,
		database: memoryAdapter(database),
		plugins: [
			emailOTP({
				storeOTP: "hashed",
				changeEmail: { enabled: true, verifyCurrentEmail: true },
				sendVerificationOTP: async (mail) => {
					delivered.push(mail);
				},
			}),
		],
	});
	const email = "before@example.invalid";
	await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
	const session = await auth.api.signInEmailOTP({ body: { email, otp: delivered.at(-1).otp }, asResponse: true });
	const headers = new Headers({ cookie: cookieHeader(session), origin });
	await auth.api.sendVerificationOTP({ headers, body: { email, type: "email-verification" } });
	const currentCode = delivered.at(-1).otp;
	await auth.api.requestEmailChangeEmailOTP({ headers, body: { newEmail: "after@example.invalid", otp: currentCode } });
	const newMail = delivered.at(-1);
	assert.equal(newMail.type, "change-email");
	assert.equal(newMail.email, "after@example.invalid");
	await assert.rejects(auth.api.getVerificationOTP({ query: { email: `${email}-after@example.invalid`, type: "change-email" } }), /hashed/);
	await auth.api.changeEmailEmailOTP({ headers, body: { newEmail: newMail.email, otp: newMail.otp } });
	assert.equal(database.user[0].email, newMail.email);
	assert.equal(database.user[0].emailVerified, true);
});

test("ordinary Twitch sign-in retains its app callback and creates a revocable native session", async () => {
	const auth = makeAuth();
	const signedIn = await signIn(auth, new URL(`${origin}/login`));
	const callback = await completeTwitch(auth, signedIn);
	assert.equal(callback.headers.get("location"), "/dashboard");
	const headers = new Headers({ cookie: cookieHeader(callback), origin });
	assert.ok((await auth.api.getSession({ headers })).session);
	const signedOut = await auth.api.signOut({ headers, body: {}, asResponse: true });
	assert.equal(signedOut.status, 200);
	assert.ok(signedOut.headers.getSetCookie().some((cookie) => cookie.includes("Max-Age=0")));
	assert.equal(await auth.api.getSession({ headers }), null);
});
