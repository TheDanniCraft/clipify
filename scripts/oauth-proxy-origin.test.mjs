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
