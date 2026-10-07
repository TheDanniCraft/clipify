import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import dns from "node:dns/promises";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import * as schema from "@/db/auth-schema";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.MCP_ENABLED = "true";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	const mode = process.argv[2];
	const originalLookup = dns.lookup;
	const originalRequest = https.request;
	let lookups = 0;
	let transportCalls = 0;
	let transportAborted = true;
	let finishLookup!: () => void;
	const lookupFinished = new Promise<void>((resolve) => {
		finishLookup = resolve;
	});
	try {
		Object.defineProperty(dns, "lookup", {
			configurable: true,
			value: async (host: string, ...args: unknown[]) => {
				if (host !== "metadata.example.invalid") return Reflect.apply(originalLookup, dns, [host, ...args]);
				lookups++;
				if (mode === "stalled") await new Promise((resolve) => setTimeout(resolve, 12000));
				finishLookup();
				return [{ address: mode === "stalled" ? "8.8.8.8" : "127.0.0.1", family: 4 }];
			},
		});
		Object.defineProperty(https, "request", {
			configurable: true,
			value: (...args: unknown[]) => {
				const url = args[0] instanceof URL ? args[0] : new URL(String(args[0]));
				if (url.hostname !== "metadata.example.invalid") return Reflect.apply(originalRequest, https, args);
				transportCalls++;
				transportAborted &&= (args[1] as { signal?: AbortSignal }).signal?.aborted === true;
				throw new Error("Fixture forbids external metadata transport");
			},
		});
		syncBuiltinESMExports();
		const { createMcpPlugins } = await import("@/auth/mcp-options");
		const origin = "http://127.0.0.1:3107";
		const auth = betterAuth({ baseURL: origin, secret: "isolated-cimd-dns-deadline-secret-32chars", database: drizzleAdapter(fixture.db, { provider: "pg", schema }), plugins: createMcpPlugins({ origin, enabled: true }) });
		const params = new URLSearchParams({ client_id: "https://metadata.example.invalid/client.json", redirect_uri: "https://custom.example.invalid/callback", response_type: "code", scope: "creator:read", code_challenge: "a".repeat(43), code_challenge_method: "S256", resource: origin + "/mcp" });
		const started = performance.now();
		const response = await auth.handler(new Request(origin + "/api/auth/oauth2/authorize?" + params));
		const elapsed = performance.now() - started;
		const body = await response.json().catch(() => null);
		const location = response.headers.get("location");
		const error = location ? new URL(location, origin).searchParams.get("error") : body?.error;
		await lookupFinished;
		const clients = Number((await fixture.pool.query("SELECT count(*) FROM auth.oauth_client")).rows[0].count);
		console.log(JSON.stringify({ elapsed, status: response.status, error, lookups, transportCalls, transportAborted, clients }));
	} finally {
		Object.defineProperty(dns, "lookup", { configurable: true, value: originalLookup });
		Object.defineProperty(https, "request", { configurable: true, value: originalRequest });
		syncBuiltinESMExports();
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
