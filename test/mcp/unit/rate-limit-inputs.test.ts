/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/db/client", () => ({ db: {} }));
import { consumeMcpRateLimit, getMcpNetworkSignal, getMcpRateLimits } from "@/server/mcp/rate-limit";

const savedEnvironment = { ...process.env };
const transaction = jest.fn();
const client = { transaction } as any;
const input = { kind: "call" as const, network: "127.0.0.1", authUserId: "fixture-actor", clientId: "fixture-client" };

beforeEach(() => {
	process.env = { ...savedEnvironment, RATE_LIMIT_HASH_SECRET: "isolated-rate-limit-input-secret-32chars" };
	for (const name of ["MCP_TRUSTED_IP_HEADER", "MCP_REGISTRATIONS_PER_MINUTE", "MCP_REGISTRATIONS_PER_DAY", "MCP_CALLS_PER_MINUTE", "MCP_CALLS_PER_NETWORK_MINUTE"]) delete process.env[name];
	transaction.mockReset();
});
afterEach(() => {
	process.env = { ...savedEnvironment };
});

test("unconfigured ingress ignores spoofed client forwarding headers", () => {
	expect(getMcpNetworkSignal(new Request("https://clipify.example/mcp", { headers: { "x-forwarded-for": "127.0.0.1" } }))).toBe("unknown-network");
});
test.each(["127.0.0.1", "2001:db8::1"])("configured ingress accepts one IP address %s", (address) => {
	process.env.MCP_TRUSTED_IP_HEADER = "x-real-ip";
	expect(getMcpNetworkSignal(new Request("https://clipify.example/mcp", { headers: { "x-real-ip": ` ${address} ` } }))).toBe(address);
});
test.each([undefined, "client.example", "127.0.0.1, 127.0.0.2"])("configured ingress rejects missing or ambiguous signal %s", (address) => {
	process.env.MCP_TRUSTED_IP_HEADER = "x-real-ip";
	expect(() => getMcpNetworkSignal(new Request("https://clipify.example/mcp", { headers: address ? { "x-real-ip": address } : {} }))).toThrow("SERVICE_UNAVAILABLE");
});
test.each(["bad header", "x".repeat(81)])("invalid configured header %s fails closed", (header) => {
	process.env.MCP_TRUSTED_IP_HEADER = header;
	expect(() => getMcpNetworkSignal(new Request("https://clipify.example/mcp"))).toThrow("SERVICE_UNAVAILABLE");
});
test("absent rate configuration leaves established defaults intact", () => {
	expect(getMcpRateLimits()).toEqual({});
});
test("explicit rate configuration maps all four budgets", () => {
	Object.assign(process.env, { MCP_REGISTRATIONS_PER_MINUTE: "2", MCP_REGISTRATIONS_PER_DAY: "3", MCP_CALLS_PER_MINUTE: "4", MCP_CALLS_PER_NETWORK_MINUTE: "5" });
	expect(getMcpRateLimits()).toEqual({ registrationsPerMinute: 2, registrationsPerDay: 3, callsPerMinute: 4, callsPerNetworkMinute: 5 });
});
test.each(["0", "-1", "1.5", "01", " 2 ", "NaN"])("invalid configured budget %s fails closed", (value) => {
	process.env.MCP_CALLS_PER_MINUTE = value;
	expect(() => getMcpRateLimits()).toThrow("SERVICE_UNAVAILABLE");
});
test.each([{ network: "" }, { network: "x".repeat(256) }, { now: new Date("invalid") }, { limits: { callsPerMinute: 0 } }, { limits: { callsPerMinute: 121 } }, { limits: { callsPerMinute: 1.5 } }, { limits: { callsPerMinute: Number.MAX_SAFE_INTEGER + 1 } }])("invalid caller or budget never reaches persistent counters %p", async (patch) => {
	await expect(consumeMcpRateLimit({ ...input, ...patch }, client)).rejects.toThrow("SERVICE_UNAVAILABLE");
	expect(transaction).not.toHaveBeenCalled();
});
test.each([{ authUserId: undefined }, { clientId: undefined }])("unauthenticated call cannot consume a budget %p", async (patch) => {
	await expect(consumeMcpRateLimit({ ...input, ...patch }, client)).rejects.toThrow("AUTHENTICATION_REQUIRED");
	expect(transaction).not.toHaveBeenCalled();
});
test.each([undefined, "short"])("unusable HMAC secret prevents persistence %s", async (secret) => {
	if (secret === undefined) delete process.env.RATE_LIMIT_HASH_SECRET;
	else process.env.RATE_LIMIT_HASH_SECRET = secret;
	await expect(consumeMcpRateLimit(input, client)).rejects.toThrow("SERVICE_UNAVAILABLE");
	expect(transaction).not.toHaveBeenCalled();
});
