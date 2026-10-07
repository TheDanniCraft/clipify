import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import dns from "node:dns/promises";
import type { lookup as callbackLookup } from "node:dns";
import https from "node:https";
import tls from "node:tls";
import { syncBuiltinESMExports } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Socket } from "node:net";
import * as schema from "@/db/auth-schema";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	const directory = mkdtempSync(join(tmpdir(), "clipify-cimd-tls-"));
	const mode = process.argv[2];
	const host = "metadata.example.invalid";
	const clientId = "https://" + host + "/client.json";
	const certificate = join(directory, "certificate.pem");
	const key = join(directory, "key.pem");
	const certificateHost = mode === "tls-mismatch" ? "other.example.invalid" : host;
	execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-keyout", key, "-out", certificate, "-days", "1", "-subj", "/CN=" + certificateHost, "-addext", "subjectAltName=DNS:" + certificateHost], { stdio: "ignore" });
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";

	const originalLookup = dns.lookup;
	const originalRequest = https.request;
	const sockets = new Set<Socket>();
	const timers = new Set<ReturnType<typeof setTimeout>>();
	let requests = 0;
	let dnsCalls = 0;
	let pinned = true;
	let lookupForms = 0;
	let serverName = "";
	let headerHost = "";
	let authorizationHeader = false;
	const metadata: Record<string, unknown> = { client_id: clientId, client_name: "Isolated metadata client", redirect_uris: ["https://custom.example.invalid/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] };
	if (mode === "wrong-identity") metadata.client_id = "https://foreign.example.invalid/client.json";
	if (mode === "oversized" || mode === "oversized-chunked") metadata.padding = "x".repeat(6144);
	const server = https.createServer({ key: readFileSync(key), cert: readFileSync(certificate) }, (request, response) => {
		requests++;
		headerHost = request.headers.host ?? "";
		authorizationHeader = !!request.headers.authorization;
		response.on("error", () => {});
		const json = JSON.stringify(metadata);
		if (mode === "redirect-chain") {
			response.writeHead(302, { location: "https://metadata.example.invalid/next" });
			response.end();
			return;
		}
		if (mode === "redirect-open" || mode === "non-json-open") {
			response.writeHead(mode === "redirect-open" ? 302 : 200, { "content-type": "text/plain", ...(mode === "redirect-open" ? { location: "https://127.0.0.1/forbidden" } : {}) });
			response.write("fixture incomplete body");
			timers.add(setTimeout(() => response.end(), 12000));
			return;
		}
		if (mode === "oversized-chunked") {
			response.writeHead(200, { "content-type": "application/json" });
			response.write(json.slice(0, 3000));
			response.end(json.slice(3000));
			return;
		}
		response.writeHead(200, { "content-type": "application/json", "content-length": Buffer.byteLength(json) });
		response.end(json);
	});
	server.on("connection", (socket) => {
		sockets.add(socket);
		socket.once("close", () => sockets.delete(socket));
	});
	server.on("secureConnection", (socket) => {
		serverName = socket.servername || "";
	});
	server.on("tlsClientError", () => {});
	const agent = new https.Agent({ keepAlive: false });
	try {
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		const address = server.address();
		if (!address || typeof address === "string") throw new Error("No isolated TLS endpoint");
		Object.defineProperty(dns, "lookup", {
			configurable: true,
			value: async (hostname: string, ...args: unknown[]) => {
				if (hostname !== host) return Reflect.apply(originalLookup, dns, [hostname, ...args]);
				dnsCalls++;
				if (mode === "mixed-dns")
					return [
						{ address: "8.8.8.8", family: 4 },
						{ address: "127.0.0.1", family: 4 },
					];
				if (mode === "rebind" && dnsCalls > 1) return [{ address: "127.0.0.1", family: 4 }];
				return [{ address: "8.8.8.8", family: 4 }];
			},
		});
		agent.createConnection = (options) => {
			const lookup = options.lookup as typeof callbackLookup | undefined;
			if (!lookup) throw new Error("Pinned Node lookup missing");
			lookup(host, { all: false }, (error, addressValue, family) => {
				lookupForms++;
				pinned &&= !error && addressValue === "8.8.8.8" && family === 4;
			});
			lookup(host, { all: true }, (error, addresses) => {
				lookupForms++;
				pinned &&= !error && addresses.length === 1 && addresses[0].address === "8.8.8.8";
			});
			// The only fixture substitution is routing the already-validated public address
			// to this isolated TLS listener; hostname verification/SNI/HTTP Host stay native.
			return tls.connect({ host: "127.0.0.1", port: address.port, servername: options.servername, ca: readFileSync(certificate), rejectUnauthorized: true });
		};
		Object.defineProperty(https, "request", {
			configurable: true,
			value: (...args: unknown[]) => {
				const url = args[0] instanceof URL ? args[0] : new URL(String(args[0]));
				if (url.hostname !== host) throw new Error("External HTTPS fixture request forbidden");
				const options = args[1] as https.RequestOptions;
				return Reflect.apply(originalRequest, https, [args[0], { ...options, agent }, args[2]]);
			},
		});
		syncBuiltinESMExports();
		const { createMcpPlugins } = await import("@/auth/mcp-options");
		const origin = "http://127.0.0.1:3107";
		process.env.NEXT_PUBLIC_BASE_URL = origin;
		process.env.BETTER_AUTH_SECRET = "isolated-cimd-https-provider-secret-32chars";
		if (mode === "complete") process.env.RATE_LIMIT_HASH_SECRET = "isolated-cimd-complete-rate-secret-32chars";
		const grants = mode === "complete" ? await import("@/server/mcp/grants") : null;
		const auth = betterAuth({ baseURL: origin, secret: process.env.BETTER_AUTH_SECRET, database: drizzleAdapter(fixture.db, { provider: "pg", schema }), emailAndPassword: { enabled: true }, plugins: createMcpPlugins({ origin, options: grants?.providerGrantOptions }) });
		const params = new URLSearchParams({ client_id: clientId, redirect_uri: mode === "wrong-callback" ? "https://foreign.example.invalid/callback" : "https://custom.example.invalid/callback", response_type: "code", scope: "creator:read", code_challenge: "a".repeat(43), code_challenge_method: "S256", resource: origin + "/mcp" });
		const response = await auth.handler(new Request(origin + "/api/auth/oauth2/authorize?" + params));
		const body = await response.json().catch(() => null);
		const location = response.headers.get("location");
		const target = location ? new URL(location, origin) : null;
		if (mode === "complete") {
			console.log(JSON.stringify(await (await import("./cimd-consent-journey")).runCimdConsentJourney({ fixture, auth, origin, clientId })));
			return;
		}
		const closeDeadline = performance.now() + 500;
		while (sockets.size && performance.now() < closeDeadline) await new Promise((resolve) => setTimeout(resolve, 5));
		const clients = Number((await fixture.pool.query("SELECT count(*) FROM auth.oauth_client")).rows[0].count);
		console.log(JSON.stringify({ status: response.status, error: target?.searchParams.get("error") ?? body?.error ?? null, loginPath: target?.pathname ?? null, requests, dnsCalls, pinned, lookupForms, serverName, headerHost, authorizationHeader, clients, closed: sockets.size === 0 }));
	} finally {
		Object.defineProperty(dns, "lookup", { configurable: true, value: originalLookup });
		Object.defineProperty(https, "request", { configurable: true, value: originalRequest });
		syncBuiltinESMExports();
		for (const timer of timers) clearTimeout(timer);
		for (const socket of sockets) socket.destroy();
		agent.destroy();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
		rmSync(directory, { recursive: true, force: true });
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
