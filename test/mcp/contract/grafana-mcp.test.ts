/** @jest-environment node */
import { readFileSync } from "node:fs";
import { createMcpMetricsStore } from "@/server/mcp/metrics";
import { flattenMcpMetrics, flattenMcpClientStats } from "@/server/mcp/metrics-export";
test("v6 retains v5 panels and uses supported numeric fields with distinct identifiers", () => {
	const dashboard = JSON.parse(readFileSync("grafana/clipify-vm01-overview-v6.json", "utf8"));
	const previous = JSON.parse(readFileSync("grafana/clipify-vm01-overview-v5.json", "utf8"));
	const fields = { ...flattenMcpMetrics(createMcpMetricsStore().snapshot()), ...flattenMcpClientStats(null), mcp_clients_sampledAtUnixSeconds: 0 };
	expect(dashboard.uid).not.toBe(previous.uid);
	expect(new Set(dashboard.panels.map((p: any) => p.id)).size).toBe(dashboard.panels.length);
	for (const p of previous.panels) expect(dashboard.panels).toContainEqual(p);
	const added = dashboard.panels.filter((p: any) => p.id >= 300);
	expect(added.length).toBeGreaterThanOrEqual(9);
	for (const panel of added)
		for (const target of panel.targets) {
			expect(target.refId).toBe("A");
			expect(panel.datasource).toEqual({ type: "influxdb", uid: "efg3es37pgh6ob" });
			for (const match of target.query.matchAll(/"(mcp_[a-zA-Z0-9_]+)"/g)) expect(fields).toHaveProperty(match[1]);
		}
	expect(added.find((p: any) => p.title.includes("p95")).targets[0].query).toContain("histogramQuantile");
});
