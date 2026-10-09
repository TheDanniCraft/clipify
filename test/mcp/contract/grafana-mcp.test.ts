/** @jest-environment node */
import { readFileSync } from "node:fs";
import { createMcpMetricsStore } from "@/server/mcp/metrics";
import { flattenMcpMetrics, flattenMcpClientStats } from "@/server/mcp/metrics-export";

test("v6 is a complete V2 editor resource preserving the existing dashboard identity and queries", () => {
	const dashboard = JSON.parse(readFileSync("grafana/clipify-vm01-overview-v6.json", "utf8"));
	const previous = JSON.parse(readFileSync("grafana/clipify-vm01-overview-v5.json", "utf8"));
	const fields = { ...flattenMcpMetrics(createMcpMetricsStore().snapshot()), ...flattenMcpClientStats(null), mcp_clients_sampledAtUnixSeconds: 0 };
	expect(dashboard).toMatchObject({ apiVersion: "dashboard.grafana.app/v2", kind: "Dashboard", metadata: { name: "clipify-vm01-overview" } });
	expect(Object.keys(dashboard.metadata)).toEqual(["name"]);
	expect(dashboard).not.toHaveProperty("panels");
	expect(dashboard.spec.layout.kind).toBe("RowsLayout");
	const panels = Object.values(dashboard.spec.elements).map((element: any) => {
		expect(element.kind).toBe("Panel");
		return element.spec;
	});
	expect(panels).toHaveLength(69);
	expect(dashboard.spec.layout.spec.rows).toHaveLength(12);
	expect(new Set(panels.map((panel: any) => panel.id)).size).toBe(panels.length);
	for (const previousPanel of previous.panels.filter((panel: any) => panel.type !== "row")) {
		const panel: any = panels.find((panel: any) => panel.id === previousPanel.id);
		expect(panel.title).toBe(previousPanel.title);
		expect(panel.vizConfig.group).toBe(previousPanel.type);
		expect(panel.data.spec.queries.map((target: any) => target.spec.query.spec.query)).toEqual((previousPanel.targets ?? []).map((target: any) => target.query));
	}
	const added = panels.filter((panel: any) => panel.id >= 300);
	expect(added).toHaveLength(12);
	for (const panel of added)
		for (const target of panel.data.spec.queries) {
			expect(target.spec.refId).toBe("A");
			expect(target.spec.query.group).toBe("influxdb");
			expect(target.spec.query.datasource.name).toBe("efg3es37pgh6ob");
			for (const match of target.spec.query.spec.query.matchAll(/"(mcp_[a-zA-Z0-9_]+)"/g)) expect(fields).toHaveProperty(match[1]);
		}
	expect(added.find((panel: any) => panel.title.includes("p95")).data.spec.queries[0].spec.query.spec.query).toContain("histogramQuantile");
});
