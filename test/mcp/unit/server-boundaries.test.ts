/** @jest-environment node */
import { handleMcpRequest } from "@/server/mcp/server";

const resolveGrant = jest.fn();
const fetchHandler = jest.fn();
const registerTools = jest.fn();
const activity = jest.fn();
const rateLimit = jest.fn();
const challenge = jest.fn();
const ready = jest.fn();
const configuration = { enabled: true, origin: "http://127.0.0.1:3107", issuer: "http://127.0.0.1:3107/api/auth", resource: "http://127.0.0.1:3107/mcp", allowedOrigins: ["http://127.0.0.1:3107"] };
jest.mock("@/db/request-scope", () => ({ withDatabaseRequest: (_signal: unknown, run: () => unknown) => run() }));
jest.mock("@/auth/config", () => ({ auth: {} }));
jest.mock("@/auth/mcp-principal", () => ({ resolveMcpGrant: (...args: unknown[]) => resolveGrant(...args) }));
jest.mock("@/server/mcp/config", () => ({ getMcpConfiguration: () => configuration }));
jest.mock("@/server/mcp/schema-readiness", () => ({ isMcpSchemaReady: () => ready() }));
jest.mock("@/server/mcp/tools", () => ({ registerMcpTools: (...args: unknown[]) => registerTools(...args) }));
jest.mock("@/server/mcp/activity", () => ({ recordMcpCallActivity: (...args: unknown[]) => activity(...args) }));
jest.mock("@/server/mcp/rate-limit", () => ({ consumeMcpRateLimit: (...args: unknown[]) => rateLimit(...args), getMcpNetworkSignal: () => "isolated", getMcpRateLimits: () => ({}) }));
jest.mock("@better-auth/mcp", () => ({ requireMcpAuth: (_auth: unknown, callback: (request: Request, claims: unknown) => unknown) => (request: Request) => callback(request, { sub: "actor" }) }));
jest.mock("@better-auth/oauth-provider", () => ({ createResourceServerChallenge: (...args: unknown[]) => challenge(...args) }));
jest.mock("better-auth/api", () => ({
	APIError: class extends Error {
		constructor(
			public status: string,
			body: { message: string },
		) {
			super(body.message);
		}
	},
}));
jest.mock("better-auth/oauth2", () => ({ createInsufficientScopeError: (scopes: string[]) => new Error(`Missing scopes: ${scopes.join(",")}`) }));
jest.mock("@modelcontextprotocol/server", () => ({
	McpServer: class {},
	createMcpHandler: (factory: () => unknown) => {
		factory();
		return { fetch: (request: Request) => fetchHandler(request) };
	},
}));

function request(body: BodyInit = "{}", headers: HeadersInit = {}) {
	const merged = new Headers({ "Content-Type": "application/json", Origin: configuration.origin });
	new Headers(headers).forEach((value, name) => merged.set(name, value));
	return new Request(configuration.resource, { method: "POST", headers: merged, body, duplex: "half" } as RequestInit);
}

describe("MCP request adapter boundaries (native OAuth and SDK covered by owning contracts)", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		configuration.enabled = true;
		resolveGrant.mockReset().mockResolvedValue({ authUserId: "actor", clientId: "client", scopes: ["creator:read"] });
		fetchHandler.mockReset().mockImplementation(() => new Response(null, { status: 200 }));
		rateLimit.mockReset().mockResolvedValue({ allowed: true });
		ready.mockReset().mockResolvedValue(true);
		challenge.mockReset().mockReturnValue(null);
	});
	test("rejects a declared oversized body even when cancellation rejects", async () => {
		const stream = new ReadableStream({ cancel: () => Promise.reject(new Error("closed stream")) });
		const result = await handleMcpRequest(request(stream, { "Content-Length": "262145" }));
		expect(result.status).toBe(413);
		await Promise.resolve();
		expect(resolveGrant).not.toHaveBeenCalled();
	});
	test("rejects streamed overflow even when reader cancellation rejects", async () => {
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(new Uint8Array(262145));
			},
			cancel: () => Promise.reject(new Error("closed stream")),
		});
		expect((await handleMcpRequest(request(stream))).status).toBe(413);
		await Promise.resolve();
		expect(resolveGrant).not.toHaveBeenCalled();
	});
	test("returns a safe invalid request when the incoming stream fails", async () => {
		const stream = new ReadableStream({
			start(controller) {
				controller.error(new Error("private transport diagnostic"));
			},
		});
		const result = await handleMcpRequest(request(stream));
		expect(result.status).toBe(400);
		expect(await result.json()).toEqual({ error: "invalid_request" });
		expect(resolveGrant).not.toHaveBeenCalled();
	});
	test("aborting body consumption remains safe if cancel rejects", async () => {
		const abort = new AbortController();
		const stream = new ReadableStream({ cancel: () => Promise.reject(new Error("closed stream")) });
		const input = new Request(request(stream), { signal: abort.signal });
		const pending = handleMcpRequest(input);
		abort.abort();
		expect((await pending).status).toBe(400);
	});
	test.each(["AUTHENTICATION_REQUIRED", "database unavailable"])("does not initialize tools when grant resolution fails: %s", async (reason) => {
		resolveGrant.mockRejectedValueOnce(new Error(reason));
		const result = await handleMcpRequest(request());
		expect(result.status).toBe(503);
		expect(registerTools).not.toHaveBeenCalled();
		expect(challenge).toHaveBeenCalled();
	});
	test("leaves malformed JSON handling to the SDK after authenticating", async () => {
		fetchHandler.mockResolvedValueOnce(Response.json({ error: "parse_error" }, { status: 400 }));
		const result = await handleMcpRequest(request("{broken"));
		expect(result.status).toBe(400);
		expect(registerTools).toHaveBeenCalled();
		expect(rateLimit).not.toHaveBeenCalled();
	});
	test("initializes SDK tools with the verified principal and retains allowed-origin headers", async () => {
		const result = await handleMcpRequest(request());
		expect(registerTools.mock.calls[0][1]).toEqual(expect.objectContaining({ authUserId: "actor", clientId: "client" }));
		expect(result.headers.get("Access-Control-Allow-Origin")).toBe(configuration.origin);
		expect(result.headers.get("Vary")).toBe("Origin");
	});
	test("returns a discovery challenge for adapter authentication errors", async () => {
		resolveGrant.mockRejectedValueOnce(new Error("AUTHENTICATION_REQUIRED"));
		challenge.mockReturnValueOnce({ statusCode: 401, headers: { "WWW-Authenticate": "Bearer resource_metadata=isolated" } });
		const result = await handleMcpRequest(request());
		expect(result.status).toBe(401);
		expect(result.headers.get("WWW-Authenticate")).toContain("resource_metadata");
	});
	test("returns retry timing for unknown tool calls without recording arbitrary tool names", async () => {
		rateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 8 });
		const result = await handleMcpRequest(request(JSON.stringify({ method: "tools/call", params: { name: "private-untrusted-name" } })));
		expect(result.status).toBe(429);
		expect(result.headers.get("Retry-After")).toBe("8");
		expect(await result.json()).toEqual(expect.objectContaining({ id: null }));
		expect(activity.mock.calls[0][1]).toEqual({ outcome: "denied", reason: "RATE_LIMITED" });
	});
	test("records the known tool when its required scope is absent before SDK execution", async () => {
		resolveGrant.mockResolvedValueOnce({ authUserId: "actor", clientId: "client", scopes: [] });
		const result = await handleMcpRequest(request(JSON.stringify({ method: "tools/call", params: { name: "list_creators" } })));
		expect(result.status).toBe(503);
		expect(activity.mock.calls[0][1]).toEqual({ tool: "list_creators", outcome: "denied", reason: "MISSING_SCOPE" });
		expect(registerTools).not.toHaveBeenCalled();
	});
	test("records the known tool and preserves its request id when rate limited", async () => {
		rateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 2 });
		const result = await handleMcpRequest(request(JSON.stringify({ id: 17, method: "tools/call", params: { name: "list_creators" } })));
		expect((await result.json()).id).toBe(17);
		expect(activity.mock.calls[0][1]).toEqual({ tool: "list_creators", outcome: "denied", reason: "RATE_LIMITED" });
	});
	test("handles a body that was already aborted before reading begins", async () => {
		const abort = new AbortController();
		abort.abort();
		const input = new Request(request(new ReadableStream()), { signal: abort.signal });
		expect((await handleMcpRequest(input)).status).toBe(400);
	});
	test("preserves an existing Origin vary entry on an origin-free SDK response", async () => {
		fetchHandler.mockResolvedValueOnce(new Response(null, { headers: { Vary: "Accept, Origin" } }));
		const input = new Request(configuration.resource, { method: "GET" });
		const result = await handleMcpRequest(input);
		expect(result.headers.get("Vary")).toBe("Accept, Origin");
		expect(result.headers.has("Access-Control-Allow-Origin")).toBe(false);
	});
	test("bounds stalled body consumption even when cancellation rejects", async () => {
		jest.useFakeTimers();
		try {
			const cancel = jest.fn().mockRejectedValue(new Error("private cancel diagnostic"));
			const pending = handleMcpRequest(request(new ReadableStream({ cancel })));
			await jest.advanceTimersByTimeAsync(10000);
			const result = await pending;
			expect(result.status).toBe(408);
			expect(await result.json()).toEqual({ error: "request_timeout" });
			expect(cancel).toHaveBeenCalled();
			expect(resolveGrant).not.toHaveBeenCalled();
		} finally {
			jest.useRealTimers();
		}
	});
	test("fails closed when MCP is disabled or its schema is unavailable", async () => {
		configuration.enabled = false;
		expect((await handleMcpRequest(request())).status).toBe(503);
		configuration.enabled = true;
		ready.mockResolvedValue(false);
		expect((await handleMcpRequest(request())).status).toBe(503);
		expect(resolveGrant).not.toHaveBeenCalled();
	});
	test.each([new Headers({ Origin: "https://foreign.example" }), new Headers({ Host: "foreign.example" })])("rejects an unapproved origin or host before authentication: %p", async (headers) => {
		expect((await handleMcpRequest(request("{}", headers))).status).toBe(403);
		expect(resolveGrant).not.toHaveBeenCalled();
	});
	test.each([false, true])("serves preflight with explicit browser origin=%s", async (withOrigin) => {
		const result = await handleMcpRequest(new Request(configuration.resource, { method: "OPTIONS", headers: withOrigin ? { Origin: configuration.origin } : {} }));
		expect(result.status).toBe(204);
		expect(result.headers.get("Access-Control-Allow-Origin")).toBe(configuration.origin);
		expect(resolveGrant).not.toHaveBeenCalled();
	});
});
