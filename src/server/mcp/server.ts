import "server-only";
import { withDatabaseRequest } from "@/db/request-scope";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { requireMcpAuth } from "@better-auth/mcp";
import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { APIError } from "better-auth/api";
import { createInsufficientScopeError } from "better-auth/oauth2";
import { resolveMcpGrant } from "@/auth/mcp-principal";
import { registerMcpTools } from "./tools";
import { toolPermissions } from "./permissions";
import type { ToolName } from "./schemas";
import { getMcpConfiguration } from "./config";

const MAX_REQUEST_BYTES = 256 * 1024;

export async function handleMcpRequest(request: Request): Promise<Response> {
	const configuration = getMcpConfiguration();
	const response = await withDatabaseRequest(request.signal, () => handleRequest(request, configuration));
	const origin = request.headers.get("origin");
	if (origin && configuration.allowedOrigins.includes(origin)) {
		response.headers.set("Access-Control-Allow-Origin", origin);
		response.headers.set("Access-Control-Expose-Headers", "WWW-Authenticate, Retry-After, MCP-Protocol-Version");
		const vary = response.headers.get("Vary");
		if (!vary?.split(",").some((value) => value.trim().toLowerCase() === "origin")) response.headers.set("Vary", vary ? `${vary}, Origin` : "Origin");
	}
	return response;
}

async function handleRequest(request: Request, configuration: ReturnType<typeof getMcpConfiguration>): Promise<Response> {
	if (!configuration.enabled) return Response.json({ error: "service_unavailable" }, { status: 503 });
	const origin = request.headers.get("origin");
	if (origin && !configuration.allowedOrigins.includes(origin)) return Response.json({ error: "access_denied" }, { status: 403 });
	const expectedHost = new URL(configuration.origin).host.toLowerCase();
	if ((request.headers.get("host") ?? new URL(request.url).host).toLowerCase() !== expectedHost) return Response.json({ error: "access_denied" }, { status: 403 });
	if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": origin ?? configuration.origin, "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version, MCP-Method, MCP-Name", Vary: "Origin" } });
	if (request.method === "POST" && request.body) {
		const declaredLength = request.headers.get("content-length");
		if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_REQUEST_BYTES) {
			void request.body.cancel().catch(() => {});
			return Response.json({ error: "request_too_large" }, { status: 413 });
		}
		const reader = request.body.getReader();
		const chunks: Uint8Array[] = [];
		let size = 0;
		let failureStatus = 400;
		let interrupt!: (reason: Error) => void;
		const interrupted = new Promise<never>((_, reject) => {
			interrupt = reject;
		});
		const stopReading = (status: number) => {
			failureStatus = status;
			interrupt(new Error("Incomplete MCP request body"));
			void reader.cancel().catch(() => {});
		};
		const onAbort = () => stopReading(400);
		request.signal.addEventListener("abort", onAbort, { once: true });
		const deadline = setTimeout(() => stopReading(408), 10000);
		try {
			if (request.signal.aborted) onAbort();
			while (true) {
				const next = await Promise.race([reader.read(), interrupted]);
				if (next.done) break;
				size += next.value.byteLength;
				if (size > MAX_REQUEST_BYTES) {
					void reader.cancel().catch(() => {});
					return Response.json({ error: "request_too_large" }, { status: 413 });
				}
				chunks.push(next.value);
			}
		} catch {
			return Response.json({ error: failureStatus === 408 ? "request_timeout" : "invalid_request" }, { status: failureStatus });
		} finally {
			clearTimeout(deadline);
			request.signal.removeEventListener("abort", onAbort);
			reader.releaseLock();
		}
		request = new Request(request, { body: Buffer.concat(chunks, size) });
	}

	const { isMcpSchemaReady } = await import("./schema-readiness");
	if (!(await isMcpSchemaReady())) return Response.json({ error: "service_unavailable" }, { status: 503 });

	try {
		const { auth } = await import("@/auth/config");
		const protectedHandler = requireMcpAuth(
			auth,
			async (authenticatedRequest, claims) => {
				let principal;
				try {
					principal = await resolveMcpGrant(claims);
				} catch (error) {
					if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") throw new APIError("UNAUTHORIZED", { message: "invalid access token" });
					throw error;
				}
				if (authenticatedRequest.method === "POST") {
					const body = await authenticatedRequest
						.clone()
						.json()
						.catch(() => null);
					if (body?.method === "tools/call") {
						const { consumeMcpRateLimit, getMcpNetworkSignal, getMcpRateLimits } = await import("./rate-limit");
						const decision = await consumeMcpRateLimit({ kind: "call", authUserId: principal.authUserId, clientId: principal.clientId, network: getMcpNetworkSignal(authenticatedRequest), limits: getMcpRateLimits() });
						if (!decision.allowed) {
							const { recordMcpCallActivity } = await import("./activity");
							const requestedTool = body?.params?.name;
							await recordMcpCallActivity(principal, { ...(typeof requestedTool === "string" && Object.hasOwn(toolPermissions, requestedTool) ? { tool: requestedTool as ToolName } : {}), outcome: "denied", reason: "RATE_LIMITED" });
							return Response.json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32000, message: "Rate limit exceeded; retry after the specified delay" } }, { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } });
						}
					}
					const name = body?.params?.name;
					const permission = body?.method === "tools/call" && typeof name === "string" && Object.hasOwn(toolPermissions, name) ? toolPermissions[name as ToolName] : undefined;
					if (permission && !principal.scopes?.includes(permission)) {
						const { recordMcpCallActivity } = await import("./activity");
						await recordMcpCallActivity(principal, { tool: name as ToolName, outcome: "denied", reason: "MISSING_SCOPE" });
						throw createInsufficientScopeError([permission]);
					}
				}
				const handler = createMcpHandler(
					() => {
						const server = new McpServer({ name: "Clipify", version: "1.0.0" });
						registerMcpTools(server, principal);
						return server;
					},
					{ legacy: "stateless" },
				);
				const response = await handler.fetch(authenticatedRequest);
				if (origin) {
					response.headers.set("Access-Control-Allow-Origin", origin);
					response.headers.set("Vary", "Origin");
				}
				return response;
			},
			{ resource: configuration.resource, issuer: configuration.issuer, challengeScopes: ["creator:read"] },
		);
		return await protectedHandler(request);
	} catch (error) {
		const challenge = createResourceServerChallenge(error, configuration.resource, { challengeScopes: ["creator:read"] });
		if (challenge) return Response.json({ error: "invalid_token" }, { status: challenge.statusCode, headers: challenge.headers });
		return Response.json({ error: "service_unavailable" }, { status: 503 });
	}
}
