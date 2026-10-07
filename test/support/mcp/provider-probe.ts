import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@/db/auth-schema";
import { createMcpPostgresFixture } from "./postgres";
import { createMcpPlugins } from "@/auth/mcp-options";
async function main() {
	const origin = "http://127.0.0.1:3107";
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.RATE_LIMIT_HASH_SECRET = "isolated-provider-budget-hmac-secret-32chars";
	try {
		const mode = process.argv[2];
		process.env.APP_ENV = "test";
		process.env.MCP_ENABLED = mode?.startsWith("disabled-alias:") ? "false" : "true";
		process.env.BETTER_AUTH_SECRET = "isolated-mcp-provider-secret-32chars";
		process.env.NEXT_PUBLIC_BASE_URL = origin;
		const input = process.argv[3] ? JSON.parse(process.argv[3]) : undefined;
		if (mode?.startsWith("alias:") || mode?.startsWith("disabled-alias:")) {
			const alias = mode.split(":")[1];
			const routes = { authorization: async () => import("@/app/.well-known/oauth-authorization-server/api/auth/route"), resource: async () => import("@/app/.well-known/oauth-protected-resource/mcp/route"), root: async () => import("@/app/.well-known/oauth-protected-resource/route") };
			const paths = { authorization: "/.well-known/oauth-authorization-server/api/auth", resource: "/.well-known/oauth-protected-resource/mcp", root: "/.well-known/oauth-protected-resource" };
			const route = await routes[alias as keyof typeof routes]();
			const response = await route.GET(new Request(origin + paths[alias as keyof typeof paths]));
			console.log(JSON.stringify({ status: response.status, body: await response.json().catch(() => null) }));
			return;
		}
		const auth = betterAuth({ baseURL: origin, secret: "isolated-mcp-provider-secret-32chars", database: drizzleAdapter(fixture.db, { provider: "pg", schema }), plugins: createMcpPlugins({ origin, enabled: true }) });
		let authorizationQuery = "";
		if (mode === "unregistered-callback") {
			const registered = await auth.handler(new Request(`${origin}/api/auth/oauth2/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ application_type: "native", redirect_uris: ["http://127.0.0.1:49999/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"] }) }));
			const client = await registered.json();
			authorizationQuery = "?" + new URLSearchParams({ client_id: client.client_id, redirect_uri: "https://unregistered.example/callback", response_type: "code", scope: "creator:read", code_challenge: "a".repeat(43), code_challenge_method: "S256", resource: `${origin}/mcp` });
		}
		const path = mode === "register" ? "/api/auth/oauth2/register" : mode === "metadata" ? "/.well-known/oauth-authorization-server/api/auth" : mode === "resource" ? "/.well-known/oauth-protected-resource/mcp" : "/api/auth/oauth2/authorize";
		const response = await auth.handler(new Request(origin + path + authorizationQuery, mode === "register" ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) } : undefined));
		console.log(JSON.stringify({ status: response.status, body: await response.json().catch(() => null) }));
	} finally {
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
