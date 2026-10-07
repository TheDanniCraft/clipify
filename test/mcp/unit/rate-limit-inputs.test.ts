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
	transaction.mockReset();
});
afterEach(() => {
	process.env = { ...savedEnvironment };
});

test("unconfigured ingress ignores spoofed client forwarding headers", () => {
	expect(getMcpNetworkSignal(new Request("https://clipify.example/mcp", { headers: { "x-forwarded-for": "127.0.0.1" } }))).toBe("unknown-network");
});
test.each(["127.0.0.1", "2001:db8::1", "127.0.0.1, 127.0.0.2"])("client real-IP header %s cannot split the shared budget", (address) => {
	expect(getMcpNetworkSignal(new Request("https://clipify.example/mcp", { headers: { "x-real-ip": address } }))).toBe("unknown-network");
});
test("fixed budgets are returned without mutable shared state", () => {
	const limits = getMcpRateLimits();
	expect(limits).toEqual({ registrationsPerMinute: 10, registrationsPerDay: 100, callsPerMinute: 120, callsPerNetworkMinute: 600 });
	limits.callsPerMinute = 1;
	expect(getMcpRateLimits().callsPerMinute).toBe(120);
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
