/** @jest-environment node */
import { createMcpMetricsStore } from "@/server/mcp/metrics";
import { flattenMcpMetrics } from "@/server/mcp/metrics-export";
test("collector mapping exports only bounded finite numeric fields and stable timestamp gauges", () => {
	const metrics = createMcpMetricsStore({ startedAt: "2026-10-08T00:00:00Z", instanceId: "never-export-identity" });
	metrics.startCall("get_overlay")("success");
	const values = flattenMcpMetrics(metrics.snapshot());
	expect(values.mcp_calls_success_total).toBe(1);
	expect(values.mcp_processStartedAtUnixSeconds).toBe(1791417600);
	expect(values.mcp_duration_buckets_le_inf_total).toBe(1);
	expect(Object.values(values).every((n) => typeof n === "number" && Number.isFinite(n))).toBe(true);
	expect(JSON.stringify(values)).not.toContain("never-export-identity");
	expect(flattenMcpMetrics(metrics.snapshot()).mcp_calls_success_total).toBe(1);
});

test("client export includes every application without a rank limit", async () => {
	const { flattenMcpClientStats } = await import("@/server/mcp/metrics-export");
	const items = Array.from({ length: 25 }, (_, index) => ({ name: `Custom ${index}`, registeredClients: 1, authorizedClients: 1, activeConnections: 1, activeClients30d: 1, calls30d: 50, lastUsedAt: null }));
	const stats = { summary: { registeredClients: 25, authorizedClients: 25, activeClients30d: 25, calls30d: 1250, applicationNames: 25 }, items, page: 1, pageSize: 25, sampledAt: "2026-10-08T00:00:00Z" };
	const mapped = flattenMcpClientStats(stats);
	expect(mapped.mcp_clients_app_25_name).toBe("Custom 24");
	expect(mapped.mcp_clients_app_25_calls30d).toBe(50);
	expect(Object.keys(mapped).filter((key) => key.endsWith("_name"))).toHaveLength(25);
	expect(mapped).not.toHaveProperty("mcp_clients_otherApplications");
	expect(flattenMcpClientStats(null)).toMatchObject({ mcp_clients_available: 0, mcp_clients_calls30d: 0 });
});
