/** @jest-environment node */
jest.mock("@/app/lib/instanceHealth", () => ({ getInstanceHealthSnapshot: jest.fn(async () => ({ status: "ok", mcp: { calls: { started_total: 1 } }, mcpClients: { summary: { registeredClients: 2 } } })) }));
import { getInstanceHealthSnapshot } from "@/app/lib/instanceHealth";
import { GET } from "@/app/internal/health/instance/route";
beforeEach(() => {
	jest.clearAllMocks();
	process.env.INSTANCE_HEALTH_TOKEN = "isolated-health-token";
});
afterAll(() => {
	delete process.env.INSTANCE_HEALTH_TOKEN;
});
test.each([undefined, "Bearer wrong", "Basic isolated-health-token"])("health metrics reject invalid authorization %s before reading data", async (authorization) => {
	const response = await GET(new Request("https://clipify.example/internal/health/instance", { headers: authorization ? { Authorization: authorization } : {} }) as any);
	expect(response.status).toBe(401);
	expect(getInstanceHealthSnapshot).not.toHaveBeenCalled();
	expect(await response.text()).not.toContain("registeredClients");
});
test("authenticated health includes additive MCP data and remains uncached", async () => {
	const response = await GET(new Request("https://clipify.example/internal/health/instance", { headers: { Authorization: "Bearer isolated-health-token" } }) as any);
	expect(response.headers.get("cache-control")).toBe("no-store");
	expect(await response.json()).toMatchObject({ mcp: { calls: { started_total: 1 } }, mcpClients: { summary: { registeredClients: 2 } } });
	expect(getInstanceHealthSnapshot).toHaveBeenCalledWith({ exclude: ["twitchRateLimit"] });
});
