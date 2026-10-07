import { createServer } from "node:http";
import { symmetricEncrypt, symmetricDecrypt } from "better-auth/crypto";
import type { QueryConfig } from "pg";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	const mode = process.argv[2];
	const secret = "isolated-provider-abort-secret-32characters";
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.MCP_ENABLED = "true";
	process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3107";
	process.env.BETTER_AUTH_SECRET = secret;
	process.env.RATE_LIMIT_HASH_SECRET = "isolated-provider-abort-rate-secret-32chars";
	process.env.TWITCH_CLIENT_ID = "isolated-provider-client";
	process.env.TWITCH_CLIENT_SECRET = "isolated-provider-secret";
	let refreshes = 0;
	let serviceComplete!: () => void;
	const serviceCompleted = new Promise<void>((resolve) => {
		serviceComplete = resolve;
	});
	const server = createServer(async (request, response) => {
		for await (const _ of request) {
			void _;
		}
		refreshes++;
		if (mode === "body") {
			response.writeHead(200, { "content-type": "application/json" });
			response.write('{"access_token":');
		}
		if (mode !== "success") await new Promise((resolve) => setTimeout(resolve, 12000));
		if (mode !== "body") response.writeHead(200, { "content-type": "application/json" });
		response.end(mode === "body" ? '"rotated-fixture-access","refresh_token":"rotated-fixture-refresh","expires_in":3600}' : JSON.stringify({ access_token: "rotated-fixture-access", refresh_token: "rotated-fixture-refresh", expires_in: 3600, token_type: "bearer", scope: ["clips:edit"] }));
		serviceComplete();
	});
	const originalFetch = globalThis.fetch;
	let providerResult: Promise<boolean> | undefined;
	try {
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		const address = server.address();
		if (!address || typeof address === "string") throw new Error("No isolated provider endpoint");
		globalThis.fetch = (input, options) => {
			const url = input instanceof Request ? input.url : String(input);
			return originalFetch(url === "https://id.twitch.tv/oauth2/token" ? `http://127.0.0.1:${address.port}/token` : input, options);
		};
		await fixture.pool.query(`INSERT INTO auth."user" (id,name,email,email_verified,created_at,updated_at) VALUES ('owner','Owner','provider-abort@example.invalid',true,now(),now())`);
		await fixture.pool.query(`INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('creator','creator@example.invalid','Creator','','user','free')`);
		await fixture.pool.query(`INSERT INTO creator_identity_links (creator_id,auth_user_id,source) VALUES ('creator','owner','twitch_onboarding')`);
		await fixture.pool.query(`INSERT INTO auth.account (id,account_id,provider_id,user_id,access_token,refresh_token,access_token_expires_at,updated_at) VALUES ('provider-account','twitch-owner','twitch','owner',$1,$2,now()-interval '1 minute',now())`, [await symmetricEncrypt({ key: secret, data: "old-fixture-access" }), await symmetricEncrypt({ key: secret, data: "old-fixture-refresh" })]);
		const { dbPool } = await import("@/db/client");
		const { getBetterAuthProviderAccessToken } = await import("@/server/provider-credentials");
		await import("@/auth/config");
		const query = dbPool.query.bind(dbPool);
		Object.defineProperty(dbPool, "query", {
			configurable: true,
			value: async (input: string | QueryConfig<unknown[]>, values?: unknown[]) => {
				const text = typeof input === "string" ? input : (input.text ?? "");
				if (!text.includes("information_schema.columns")) return query(input, values);
				const operation = getBetterAuthProviderAccessToken("creator");
				providerResult = operation.then(
					() => true,
					() => false,
				);
				await operation;
				throw new Error("Dependency fixture complete");
			},
		});
		const route = await import("@/app/mcp/route");
		const started = performance.now();
		const response = await route.POST(new Request("http://127.0.0.1:3107/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }));
		const elapsed = performance.now() - started;
		const observer = await fixture.pool.connect();
		const lock = await observer.query("SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired", ["clipify:twitch:provider-account"]);
		if (lock.rows[0].acquired) await observer.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", ["clipify:twitch:provider-account"]);
		observer.release();
		const completed = await providerResult;
		await serviceCompleted;
		const stored = (await fixture.pool.query("SELECT access_token,refresh_token FROM auth.account WHERE id='provider-account'")).rows[0];
		Object.defineProperty(dbPool, "query", { configurable: true, value: query });
		console.log(JSON.stringify({ status: response.status, body: await response.json(), elapsed, lockReleased: lock.rows[0].acquired, completed, refreshes, storedAccess: (await symmetricDecrypt({ key: secret, data: stored.access_token })) === (mode === "success" ? "rotated-fixture-access" : "old-fixture-access"), storedRefresh: (await symmetricDecrypt({ key: secret, data: stored.refresh_token })) === (mode === "success" ? "rotated-fixture-refresh" : "old-fixture-refresh") }));
	} finally {
		await providerResult;
		globalThis.fetch = originalFetch;
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
