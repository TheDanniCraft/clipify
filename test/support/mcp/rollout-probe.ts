import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3107";

	process.env.BETTER_AUTH_SECRET = "isolated-rollout-provider-secret-32chars";
	process.env.RATE_LIMIT_HASH_SECRET = "isolated-rollout-ratelimit-secret-32chars";
	const [mode, surface = "mcp"] = process.argv[2].split(":");
	try {
		if (mode === "missing-auth") {
			delete process.env.BETTER_AUTH_SECRET;
			delete process.env.JWT_SECRET;
		}
		if (mode === "missing-rate") delete process.env.RATE_LIMIT_HASH_SECRET;
		if (mode === "bad-origins") process.env.MCP_ALLOWED_ORIGINS = "https://partner.example/unsafe-path";
		if (mode === "missing-revision") await fixture.pool.query("ALTER TABLE overlays DROP COLUMN configuration_revision");
		if (mode === "missing-default") await fixture.pool.query("ALTER TABLE playlists ALTER COLUMN configuration_revision DROP DEFAULT");
		if (mode === "nullable-revision") await fixture.pool.query("ALTER TABLE overlays ALTER COLUMN configuration_revision DROP NOT NULL");
		if (mode === "missing-provider") await fixture.pool.query("DROP TABLE auth.oauth_client CASCADE");
		if (mode === "missing-grants") await fixture.pool.query("DROP TABLE mcp_connection_grants CASCADE");
		if (mode === "unavailable") process.env.DATABASE_URL = fixture.url.replace(/\/mcp_[a-z0-9]+$/, "/mcp_rollout_missing_database");

		let response: Response;
		if (surface === "mcp") {
			const route = await import("@/app/mcp/route");
			response = await route.POST(new Request("http://127.0.0.1:3107/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }));
		} else if (surface === "register") {
			const route = await import("@/app/api/auth/[...all]/route");
			response = await route.POST(new Request("http://127.0.0.1:3107/api/auth/oauth2/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "Isolated rollout client", application_type: "native", redirect_uris: ["http://127.0.0.1:49999/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) }));
		} else if (surface === "authorization") {
			const route = await import("@/app/.well-known/oauth-authorization-server/api/auth/route");
			response = await route.GET(new Request("http://127.0.0.1:3107/.well-known/oauth-authorization-server/api/auth"));
		} else if (surface === "resource") {
			const route = await import("@/app/.well-known/oauth-protected-resource/mcp/route");
			response = await route.GET(new Request("http://127.0.0.1:3107/.well-known/oauth-protected-resource/mcp"));
		} else if (surface === "root") {
			const route = await import("@/app/.well-known/oauth-protected-resource/route");
			response = await route.GET(new Request("http://127.0.0.1:3107/.well-known/oauth-protected-resource"));
		} else {
			const route = await import("@/app/api/auth/[...all]/route");
			response = await route.GET(new Request("http://127.0.0.1:3107/api/auth/" + (surface === "session" ? "get-session" : surface === "directauthorization" ? ".well-known/oauth-authorization-server" : "jwks")));
		}
		const body = await response.json().catch(() => null);
		console.log(JSON.stringify({ status: response.status, body: response.status >= 400 ? body : null }));
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
