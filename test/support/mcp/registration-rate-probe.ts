import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@/db/auth-schema";
import { createMcpPlugins } from "@/auth/mcp-options";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.RATE_LIMIT_HASH_SECRET = "isolated-registration-budget-hmac-32chars";
	process.env.MCP_REGISTRATIONS_PER_MINUTE = "2";
	process.env.MCP_REGISTRATIONS_PER_DAY = "3";
	const origin = "http://127.0.0.1:3107";
	try {
		const auth = betterAuth({ baseURL: origin, secret: "isolated-mcp-provider-secret-32chars", database: drizzleAdapter(fixture.db, { provider: "pg", schema }), plugins: createMcpPlugins({ origin }) });
		const results = [];
		for (let index = 0; index < 3; index++) {
			const response = await auth.handler(new Request(`${origin}/api/auth/oauth2/register`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": `192.0.2.${index + 1}` }, body: JSON.stringify({ client_name: `Budget client ${index}`, application_type: "native", redirect_uris: ["http://127.0.0.1:49999/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) }));
			const body = await response.json();
			results.push({ status: response.status, error: body.error, retryAfter: response.headers.get("retry-after"), registered: Boolean(body.client_id) });
		}
		const clients = Number((await fixture.pool.query("SELECT count(*) FROM auth.oauth_client")).rows[0].count);
		console.log(JSON.stringify({ results, clients }));
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
