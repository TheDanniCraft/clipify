import assert from "node:assert/strict";
import test from "node:test";
import { oAuthProxy } from "better-auth/plugins";

const productionURL = "https://clipify.us";
const secret = "oauth-proxy-test-secret-with-at-least-32-characters";

function context(callbackURL) {
	const state = "a".repeat(32);
	return {
		request: new Request("http://container:3000/api/auth/sign-in/social"),
		body: { provider: "twitch", callbackURL, errorCallbackURL: `/login?returnUrl=${encodeURIComponent(callbackURL)}` },
		context: {
			baseURL: `${productionURL}/api/auth`,
			options: { basePath: "/api/auth" },
			isTrustedOrigin: () => false,
			oauthConfig: { storeStateStrategy: "database" },
			internalAdapter: { findVerificationValue: async () => ({ value: JSON.stringify({ callbackURL, oauthState: state }) }) },
			logger: {
				warn: () => {},
				error: (error) => {
					throw new Error(error);
				},
			},
			returned: { url: `https://id.twitch.tv/oauth2/authorize?state=${state}` },
		},
	};
}

test("production behind a reverse proxy keeps a short state for long MCP return URLs", async () => {
	const callbackURL = `/api/auth/oauth2/authorize?state=${"x".repeat(2000)}`;
	const ctx = context(callbackURL);
	const originalURL = ctx.context.returned.url;
	const plugin = oAuthProxy({ productionURL, currentURL: productionURL, secret });
	await plugin.hooks.before[0].handler(ctx);
	await plugin.hooks.after[0].handler(ctx);
	assert.equal(ctx.body.callbackURL, callbackURL);
	assert.equal(ctx.context.returned.url, originalURL);
	assert.equal(new URL(ctx.context.returned.url).searchParams.get("state").length, 32);
});

test("request-origin inference reproduces unnecessarily expanded production state", async () => {
	const ctx = context(`/api/auth/oauth2/authorize?state=${"x".repeat(2000)}`);
	const plugin = oAuthProxy({ productionURL, secret });
	await plugin.hooks.before[0].handler(ctx);
	await plugin.hooks.after[0].handler(ctx);
	assert.match(ctx.body.callbackURL, /oauth-proxy/);
	assert.ok(new URL(ctx.context.returned.url).searchParams.get("state").length > 8000);
});

test("explicit preview origin still proxies Twitch through production", async () => {
	const ctx = context("/dashboard");
	const plugin = oAuthProxy({ productionURL, currentURL: "https://preview.example.invalid", secret });
	await plugin.hooks.before[0].handler(ctx);
	await plugin.hooks.after[0].handler(ctx);
	assert.equal(new URL(ctx.body.callbackURL).origin, "https://preview.example.invalid");
	assert.equal(ctx.context.baseURL, `${productionURL}/api/auth`);
	assert.ok(new URL(ctx.context.returned.url).searchParams.get("state").length > 32);
});

test("database state preserves long MCP callbacks without exceeding browser cookie limits", async () => {
	const { generateGenericState, parseGenericState } = await import("better-auth");
	const callbackURL = `/auth/mcp/consent?state=${"x".repeat(1200)}&scope=${"overlay:read ".repeat(30)}`;
	const payload = { callbackURL, errorURL: `/login?returnUrl=${encodeURIComponent(callbackURL)}`, codeVerifier: "v".repeat(64), expiresAt: Date.now() + 600000 };
	let record;
	let signedState;
	let removed = false;
	const ctx = {
		context: {
			secret,
			oauthConfig: { storeStateStrategy: "database", skipStateCookieCheck: false },
			createAuthCookie: (name, attributes) => ({ name, attributes }),
			internalAdapter: {
				createVerificationValue: async (value) => {
					record = value;
					return value;
				},
				findVerificationValue: async (identifier) => (record?.identifier === identifier ? record : null),
				deleteVerificationByIdentifier: async () => {
					removed = true;
					record = undefined;
				},
			},
		},
		setSignedCookie: async (_name, value) => {
			signedState = value;
		},
		getSignedCookie: async () => signedState,
		setCookie: () => {},
	};
	const generated = await generateGenericState(ctx, payload);
	assert.equal(generated.state.length, 32);
	assert.ok(signedState.length + 128 < 4096);
	assert.equal(JSON.parse(record.value).callbackURL, callbackURL);
	const validSignedState = signedState;
	signedState = "wrong-browser-state";
	await assert.rejects(parseGenericState(ctx, generated.state), /State not persisted correctly/);
	signedState = validSignedState;
	const parsed = await parseGenericState(ctx, generated.state);
	assert.equal(parsed.callbackURL, callbackURL);
	assert.equal(parsed.errorURL, payload.errorURL);
	assert.equal(removed, true);
	await assert.rejects(parseGenericState(ctx, generated.state), /verification not found/);
});

test("real social sign-in stores OpenAI-sized state on the server and sets a small signed cookie", async () => {
	const { betterAuth } = await import("better-auth");
	const { memoryAdapter } = await import("better-auth/adapters/memory");
	const database = { verification: [], user: [], session: [], account: [] };
	const auth = betterAuth({
		baseURL: productionURL,
		secret,
		database: memoryAdapter(database),
		account: { storeStateStrategy: "database" },
		socialProviders: { twitch: { clientId: "fixture", clientSecret: "fixture" } },
	});
	const callbackURL = `/auth/mcp/consent?state=${"x".repeat(1200)}&scope=${"overlay:read ".repeat(30)}`;
	const response = await auth.handler(
		new Request(`${productionURL}/api/auth/sign-in/social`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Origin: productionURL },
			body: JSON.stringify({ provider: "twitch", callbackURL, errorCallbackURL: `/login?returnUrl=${encodeURIComponent(callbackURL)}`, disableRedirect: true }),
		}),
	);
	assert.equal(response.status, 200);
	const state = new URL((await response.json()).url).searchParams.get("state");
	assert.equal(state.length, 32);
	const cookies = response.headers.getSetCookie();
	assert.ok(cookies.some((cookie) => cookie.startsWith("__Secure-better-auth.state=")));
	assert.ok(cookies.every((cookie) => Buffer.byteLength(cookie) < 4096));
	assert.equal(database.verification.length, 1);
	assert.equal(database.verification[0].identifier, `auth-state:${state}`);
	assert.equal(JSON.parse(database.verification[0].value).callbackURL, callbackURL);
});
