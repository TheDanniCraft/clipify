import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@/db/auth-schema";
import { createMcpPostgresFixture } from "./postgres";
import { createMcpPlugins } from "@/auth/mcp-options";
import { connectMcpClient } from "./client";

async function main() {
	const fixture = await createMcpPostgresFixture();
	let dispatch: (request: Request) => Promise<Response>;
	let origin = "";
	const sockets = new Set<import("node:net").Socket>();
	const protocols = new Set<string>();
	const server = createServer(async (incoming, outgoing) => {
		try {
			const parts: Buffer[] = [];
			let size = 0;
			for await (const part of incoming) {
				size += part.length;
				if (size > 65536) throw new Error("SDK fixture input too large");
				parts.push(part);
			}
			const headers = new Headers();
			for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
			if (headers.get("mcp-protocol-version")) protocols.add(headers.get("mcp-protocol-version")!);
			const controller = new AbortController();
			incoming.once("aborted", () => controller.abort());
			const request = new Request(origin + incoming.url, { method: incoming.method, headers, signal: controller.signal, ...(size ? { body: Buffer.concat(parts) } : {}) });
			const response = await dispatch(request);
			outgoing.statusCode = response.status;
			for (const [key, value] of response.headers) if (key !== "set-cookie") outgoing.setHeader(key, value);
			const cookies = response.headers.getSetCookie();
			if (cookies.length) outgoing.setHeader("set-cookie", cookies);
			outgoing.end(Buffer.from(await response.arrayBuffer()));
		} catch {
			outgoing.statusCode = 500;
			outgoing.end("Controlled SDK fixture failure");
		}
	});
	server.on("connection", (socket) => {
		sockets.add(socket);
		socket.on("close", () => sockets.delete(socket));
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("SDK fixture listen failed");
	origin = `http://127.0.0.1:${address.port}`;
	Object.assign(process.env, { DATABASE_URL: fixture.url, APP_ENV: "test", DISABLE_BACKGROUND_JOBS: "true", NEXT_PUBLIC_BASE_URL: origin, BETTER_AUTH_SECRET: "isolated-sdk-provider-secret-32chars", RATE_LIMIT_HASH_SECRET: "isolated-sdk-budget-secret-32chars" });
	const originalFetch = globalThis.fetch;
	let connected: Awaited<ReturnType<typeof connectMcpClient>> | undefined;
	try {
		const { approveMcpConsent, providerGrantOptions } = await import("@/server/mcp/grants");
		const auth = betterAuth({ baseURL: origin, secret: process.env.BETTER_AUTH_SECRET, database: drizzleAdapter(fixture.db, { provider: "pg", schema }), emailAndPassword: { enabled: true }, plugins: createMcpPlugins({ origin, options: providerGrantOptions }) });
		const route = await import("@/app/mcp/route");
		const { revokeMcpConnection } = await import("@/server/mcp/connections");
		dispatch = async (request) => {
			const path = new URL(request.url).pathname;
			if (path === "/mcp") return request.method === "POST" ? route.POST(request) : route.GET(request);
			if (path === "/test/consent") {
				const input = await request.json();
				return approveMcpConsent({ auth, origin, headers: request.headers, ...input });
			}
			if (path === "/test/revoke") return revokeMcpConnection({ auth, origin, headers: request.headers, grantId: (await request.json()).grantId, client: fixture.db });
			return auth.handler(request);
		};
		globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(input instanceof Request ? input.url : input.toString());
			if (url.origin !== origin) throw new Error("SDK_EXTERNAL_IO_FORBIDDEN");
			return originalFetch(input, init);
		}) as typeof fetch;
		const signup = await fetch(origin + "/api/auth/sign-up/email", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ name: "Independent SDK owner", email: "sdk@example.invalid", password: "isolated-sdk-password-12345" }) });
		const actor = await signup.json();
		if (!signup.ok || !actor.user?.id) throw new Error(`SDK native signup failed: status=${signup.status}; code=${typeof actor.code === "string" ? actor.code : "none"}`);
		const cookie = signup.headers
			.getSetCookie()
			.map((part) => part.split(";")[0])
			.join("; ");
		await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('sdk-org','SDK creator','sdk-creator',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('sdk-creator','sdk-creator@example.invalid','SDK creator','','user','free'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('sdk-creator','sdk-org','active')");
		await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'sdk-org',$2,'owner',now())", [randomUUID(), actor.user.id]);
		const metadata = await (await fetch(origin + "/.well-known/oauth-protected-resource/mcp")).json();
		const authorizationMetadata = await (await fetch(origin + "/.well-known/oauth-authorization-server/api/auth")).json();
		const registered = await fetch(origin + "/api/auth/oauth2/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "Independent official SDK client", application_type: "native", redirect_uris: ["http://127.0.0.1:49999/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) });
		const client = await registered.json();
		if (registered.status !== 201) throw new Error("SDK native DCR failed");
		const verifier = "independent-sdk-pkce-proof-at-least-43-characters-12345";
		const scopes = ["creator:read", "overlay:read", "overlay:create", "overlay:update", "offline_access"];
		const authorize = async () => {
			const query = new URLSearchParams({ client_id: client.client_id, redirect_uri: client.redirect_uris[0], response_type: "code", scope: scopes.join(" "), code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", state: "independent-sdk-state", resource: origin + "/mcp", prompt: "consent" });
			const response = await fetch(origin + "/api/auth/oauth2/authorize?" + query, { headers: { Cookie: cookie, Origin: origin }, redirect: "manual" });
			const body = response.headers.get("location") ? null : await response.json().catch(() => null);
			const location = response.headers.get("location") ?? body?.url;
			if (!response.ok && response.status !== 302 && response.status !== 303) throw new Error(`SDK authorization rejected: status=${response.status}; code=${body?.code ?? body?.error ?? "none"}`);
			if (typeof location !== "string" || new URL(location, origin).origin !== origin || new URL(location, origin).pathname !== "/auth/mcp/consent") throw new Error("SDK native signed authorization missing");
			return new URL(location, origin).search.slice(1);
		};
		const consent = await fetch(origin + "/test/consent", { method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ oauthQuery: await authorize(), accept: true, scopes, creators: [{ creatorId: "sdk-creator", agencyOrganizationId: null }] }) });
		const approved = await consent.json();
		if (!consent.ok || !approved.url) throw new Error("SDK native approval failed");
		const tokensResponse = await fetch(origin + "/api/auth/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: client.client_id, redirect_uri: client.redirect_uris[0], code: new URL(approved.url).searchParams.get("code")!, code_verifier: verifier, resource: origin + "/mcp" }) });
		const tokens = await tokensResponse.json();
		if (!tokensResponse.ok || !tokens.access_token) throw new Error("SDK token exchange failed");
		const mode = process.argv[2] === "auto" ? "auto" : "legacy";
		connected = await connectMcpClient(new URL(origin + "/mcp"), tokens.access_token, mode);
		const tools = await connected.client.listTools();
		const prompts = await connected.client.listPrompts();
		const themePrompt = await connected.client.getPrompt({ name: "style-overlay" });
		const focusedDiscoveryValid = ["get_overlay_theme", "update_overlay_theme", "update_overlay_filters", "update_gallery_layout", "get_overlay_link"].every((name) => tools.tools.some((tool) => tool.name === name && (tool.description?.length ?? 0) > 50)) && !tools.tools.some((tool) => ["update_overlay", "update_gallery", "get_overlay_embed"].includes(tool.name));
		let obsoleteToolDenied = false;
		try {
			await connected.client.callTool({ name: "update_overlay", arguments: {} });
		} catch {
			obsoleteToolDenied = true;
		}

		const read = await connected.client.callTool({ name: "list_creators", arguments: {} });
		const created = await connected.client.callTool({ name: "create_overlay", arguments: { creatorId: "sdk-creator", retryKey: "independent-sdk-create", name: "Created by official SDK" } });
		const dto: any = created.structuredContent;
		if (!dto?.id) throw new Error("SDK create did not return safe DTO");
		const edited = await connected.client.callTool({ name: "update_overlay_settings", arguments: { creatorId: "sdk-creator", overlayId: dto.id, expectedRevision: 1, patch: { name: "Edited by official SDK" } } });
		const limited = await connected.client.callTool({ name: "create_overlay", arguments: { creatorId: "sdk-creator", retryKey: "independent-sdk-over-limit", name: "Must be denied" } });
		const grantsBeforeDenial = Number((await fixture.pool.query("SELECT count(*) FROM mcp_connection_grants")).rows[0].count);
		const deny = await fetch(origin + "/test/consent", { method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ oauthQuery: await authorize(), accept: false, scopes: [], creators: [] }) });
		const denied = await deny.json();
		const grantsAfterDenial = Number((await fixture.pool.query("SELECT count(*) FROM mcp_connection_grants")).rows[0].count);
		const claims = JSON.parse(Buffer.from(tokens.access_token.split(".")[1], "base64url").toString());
		const revoked = await fetch(origin + "/test/revoke", { method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ grantId: claims.clipify_grant_id }) });
		let revokedSdkDenied = false;
		try {
			await connected.client.callTool({ name: "list_creators", arguments: {} });
		} catch {
			revokedSdkDenied = true;
		}
		const old = await fetch(origin + "/mcp", { method: "POST", headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/call", params: { name: "list_creators", arguments: {} } }) });
		const refresh = await fetch(origin + "/api/auth/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: client.client_id, refresh_token: tokens.refresh_token, resource: origin + "/mcp" }) });
		const stored = (await fixture.pool.query("SELECT name,configuration_revision FROM overlays WHERE id=$1", [dto.id])).rows[0];
		const count = Number((await fixture.pool.query("SELECT count(*) FROM overlays")).rows[0].count);
		const wire = JSON.stringify([tools, read, created, edited, limited]);
		const privateValues = [tokens.access_token, tokens.refresh_token, (await fixture.pool.query("SELECT secret FROM overlays WHERE id=$1", [dto.id])).rows[0].secret];
		mkdirSync("test-results/mcp/client-matrix", { recursive: true });
		writeFileSync(
			`test-results/mcp/client-matrix/custom-sdk-${mode}.json`,
			JSON.stringify(
				{
					product: "Official SDK independent client",
					clientVersion: "2.3.0",
					transportMode: mode,
					observedProtocols: [...protocols].sort(),
					registrationPath: "native-dynamic-registration",
					environment: "Disposable native PostgreSQL and real loopback HTTP; test-only consent/revoke adapters; no named-vendor UI acceptance",
					checkedAt: new Date().toISOString(),
					riskHints: tools.tools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema, annotations: tool.annotations })),
				},
				null,
				2,
			) + "\n",
		);
		console.log(
			JSON.stringify({
				metadataValid: metadata.resource === origin + "/mcp" && metadata.authorization_servers?.includes(origin + "/api/auth") && authorizationMetadata.registration_endpoint === origin + "/api/auth/oauth2/register",
				registrationStatus: registered.status,
				issuerBound: claims.iss === origin + "/api/auth",
				audienceBound: claims.aud === origin + "/mcp" || (Array.isArray(claims.aud) && claims.aud.includes(origin + "/mcp")),
				toolCount: tools.tools.length,
				promptCount: prompts.prompts.length,
				promptWorkflowValid: JSON.stringify(themePrompt.messages).includes("update_overlay_theme"),
				focusedDiscoveryValid,
				obsoleteToolDenied,
				readAllowed: !read.isError,
				createAllowed: !created.isError,
				editAllowed: !edited.isError,
				stored,
				count,
				limitError: (limited.structuredContent as any)?.error?.code,
				deniedConsent: deny.ok && new URL(denied.url).searchParams.get("error") === "access_denied" && !new URL(denied.url).searchParams.has("code") && grantsBeforeDenial === grantsAfterDenial,
				revocationStatus: revoked.status,
				revokedSdkDenied,
				oldBearerStatus: old.status,
				oldBearerChallenge: old.headers.get("www-authenticate")?.includes("resource_metadata=") ?? false,
				refreshStatus: refresh.status,
				secretFree: !privateValues.some((value) => wire.includes(value)),
				protocols: [...protocols].sort(),
				clientVersion: "2.3.0",
				registrationPath: "native-dynamic-registration",
			}),
		);
	} finally {
		await connected?.close();
		globalThis.fetch = originalFetch;
		for (const socket of sockets) socket.destroy();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await (await import("@/db/client")).dbPool.end();
		await fixture.close();
	}
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
