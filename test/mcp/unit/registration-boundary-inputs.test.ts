/** @jest-environment node */
jest.mock("better-auth/plugins", () => ({ jwt: (options: unknown) => ({ id: "jwt", options }) }));
jest.mock("@better-auth/mcp", () => ({ mcp: (options: unknown) => ({ id: "mcp", options }) }));
jest.mock("@better-auth/cimd", () => ({ cimd: (options: unknown) => ({ id: "cimd", options }) }));
jest.mock("@better-auth/cimd/node", () => ({ fetchClientMetadataResource: jest.fn() }));
jest.mock("@/server/mcp/rate-limit", () => ({ consumeMcpRateLimit: jest.fn(), getMcpNetworkSignal: () => "fixture-network", getMcpRateLimits: () => ({ registrationsPerMinute: 2 }) }));
import { createMcpPlugins } from "@/auth/mcp-options";
import { consumeMcpRateLimit } from "@/server/mcp/rate-limit";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
const plugins = createMcpPlugins({ origin: "https://clipify.example" });
const boundary = plugins.find((item) => item.id === "clipify-mcp-registration")!.onRequest as any;
const metadata = (plugins.find((item) => item.id === "cimd") as any).options.fetchClientMetadataResource;
const valid = { redirect_uris: ["https://client.example/callback"] };
function registration(body: unknown, overrides: RequestInit = {}) {
	return new Request("https://clipify.example/api/auth/oauth2/register", { method: "POST", body: JSON.stringify(body), ...overrides });
}
beforeEach(() => {
	jest.clearAllMocks();
	(consumeMcpRateLimit as jest.Mock).mockReset().mockResolvedValue({ allowed: true });
	(fetchClientMetadataResource as jest.Mock).mockReset().mockResolvedValue(Response.json({ client_name: "Fixture client" }));
});
test.each(["GET", "DELETE"])("%s registration request does not consume a budget", async (method) => {
	expect(await boundary(new Request("https://clipify.example/api/auth/oauth2/register", { method }))).toBeUndefined();
	expect(consumeMcpRateLimit).not.toHaveBeenCalled();
});
test("other POST endpoints do not consume registration budget", async () => {
	expect(await boundary(new Request("https://clipify.example/api/auth/sign-in/social", { method: "POST" }))).toBeUndefined();
	expect(consumeMcpRateLimit).not.toHaveBeenCalled();
});
test.each([null, [], "metadata", 42].map((body) => ({ body })))("nonobject metadata %p is rejected", async ({ body }) => {
	const result = await boundary(registration(body));
	expect(result.response.status).toBe(400);
	expect(await result.response.json()).toEqual({ error: "invalid_client_metadata" });
});
test.each([undefined, [], [42], ["not-url"], ["https://*.example/callback"], ["http://remote.example/callback"], ["https://user:password@client.example/callback"], ["https://client.example/callback#fragment"], Array(11).fill("https://client.example/callback")].map((redirect_uris) => ({ redirect_uris })))("invalid callbacks %p are rejected", async ({ redirect_uris }) => {
	expect((await boundary(registration({ redirect_uris }))).response.status).toBe(400);
});
test.each(["http://localhost:49999/callback", "http://127.0.0.1:49999/callback", "http://[::1]:49999/callback", "https://client.example/callback?state=fixture"])("valid callback %s preserves the original request body", async (callback) => {
	const body = { redirect_uris: [callback], grant_types: ["authorization_code", "refresh_token"], scope: "creator:read offline_access" };
	const result = await boundary(registration(body));
	expect(await result.request.json()).toEqual(body);
});
test.each([{ grant_types: ["client_credentials"] }, { grant_types: "authorization_code" }, { scope: ["creator:read"] }, { scope: "unknown:scope" }])("unsupported grant/scope metadata %p is rejected", async (patch) => {
	expect((await boundary(registration({ ...valid, ...patch }))).response.status).toBe(400);
});
test("denied registration forwards retry guidance before reading body", async () => {
	(consumeMcpRateLimit as jest.Mock).mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
	const result = await boundary(registration(valid));
	expect(result.response.status).toBe(429);
	expect(result.response.headers.get("retry-after")).toBe("42");
});
test("limiter failure returns safe unavailability", async () => {
	(consumeMcpRateLimit as jest.Mock).mockRejectedValue(new Error("private storage failure"));
	const result = await boundary(registration(valid));
	expect(result.response.status).toBe(503);
	expect(await result.response.json()).toEqual({ error: "temporarily_unavailable" });
});
test("malformed JSON and missing request bodies are rejected", async () => {
	for (const body of [undefined, "not-json"]) {
		const request = new Request("https://clipify.example/api/auth/oauth2/register", { method: "POST", body });
		expect((await boundary(request)).response.status).toBe(400);
	}
});
test("declared oversized registration remains safely rejected when body cancellation fails", async () => {
	const body = new ReadableStream({
		cancel() {
			return Promise.reject(new Error("fixture cancellation failure"));
		},
	});
	const request = new Request("https://clipify.example/api/auth/oauth2/register", { method: "POST", body, duplex: "half", headers: { "content-length": String(256 * 1024 + 1) } } as RequestInit);
	expect((await boundary(request)).response.status).toBe(400);
	await Promise.resolve();
});
test("already aborted registration cannot proceed", async () => {
	const controller = new AbortController();
	controller.abort();
	expect((await boundary(registration(valid, { signal: controller.signal }))).response.status).toBe(400);
});
test("already aborted metadata request does not contact its provider", async () => {
	const controller = new AbortController();
	controller.abort();
	await expect(metadata(new Request("https://client.example/metadata", { signal: controller.signal }))).rejects.toThrow("METADATA_FETCH_UNAVAILABLE");
	expect(fetchClientMetadataResource).not.toHaveBeenCalled();
});
test.each([304, 200])("metadata response %s keeps provider body ownership", async (status) => {
	const response = status === 304 ? new Response(null, { status }) : Response.json({ client_name: "Fixture" });
	(fetchClientMetadataResource as jest.Mock).mockResolvedValue(response);
	expect(await metadata("https://client.example/metadata")).toBe(response);
	expect(response.bodyUsed).toBe(false);
});
test("invalid metadata response safely handles rejected body cancellation", async () => {
	const body = new ReadableStream({
		cancel() {
			return Promise.reject(new Error("fixture cancellation failure"));
		},
	});
	const response = new Response(body, { status: 503 });
	(fetchClientMetadataResource as jest.Mock).mockResolvedValue(response);
	expect(await metadata("https://client.example/metadata")).toBe(response);
	await Promise.resolve();
});

test("caller cancellation interrupts pending metadata fetch and aborts the provider signal", async () => {
	const controller = new AbortController();
	let providerSignal: AbortSignal | undefined;
	(fetchClientMetadataResource as jest.Mock).mockImplementation((_input, init) => {
		providerSignal = init.signal;
		return new Promise(() => {});
	});
	const pending = metadata("https://client.example/metadata", { signal: controller.signal });
	controller.abort();
	await expect(pending).rejects.toThrow("METADATA_FETCH_UNAVAILABLE");
	expect(providerSignal?.aborted).toBe(true);
});
test("provider rejection releases the metadata deadline without leaking private details into callbacks", async () => {
	(fetchClientMetadataResource as jest.Mock).mockRejectedValue(new Error("fixture provider rejection"));
	await expect(metadata("https://client.example/metadata")).rejects.toThrow("fixture provider rejection");
});

test("registration abort remains safely rejected when reader cancellation itself rejects", async () => {
	const controller = new AbortController();
	const body = new ReadableStream({
		cancel() {
			return Promise.reject(new Error("fixture reader cancellation"));
		},
	});
	const request = new Request("https://clipify.example/api/auth/oauth2/register", { method: "POST", body, duplex: "half", signal: controller.signal } as RequestInit);
	const pending = boundary(request);
	// Allow the budget check to finish and the body reader to acquire its lock.
	await new Promise((resolve) => setImmediate(resolve));
	controller.abort();
	expect((await pending).response.status).toBe(400);
	await Promise.resolve();
});

test("registers identity plugins without a feature toggle", () => {
	expect(createMcpPlugins({ origin: "https://clipify.example" }).map((item) => item.id)).toEqual(expect.arrayContaining(["mcp", "jwt", "cimd"]));
});
