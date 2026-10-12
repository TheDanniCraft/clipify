/** @jest-environment node */
import { readFileSync } from "node:fs";
import { createMcpMetricsStore } from "@/server/mcp/metrics";
import { flattenMcpMetrics, flattenMcpClientStats } from "@/server/mcp/metrics-export";

test("v6 is a complete V2 editor resource preserving the existing dashboard identity and queries", () => {
	const dashboard = JSON.parse(readFileSync("grafana/clipify-vm01-overview-v6.json", "utf8"));
	const previous = JSON.parse(readFileSync("grafana/clipify-vm01-overview-v5.json", "utf8"));
	const fields: Record<string, number | string> = { ...flattenMcpMetrics(createMcpMetricsStore().snapshot()), ...flattenMcpClientStats(null) };
	function collect(value: unknown, path: string) {
		if (typeof value === "number") fields[path] = value;
		else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) collect(child, `${path}_${key}`);
	}
	const sample = JSON.parse(readFileSync("grafana/mcp-health-sample.json", "utf8"));
	for (const key of ["crawler", "notifications", "clips", "mcpClients"]) collect(sample[key], key);
	expect(dashboard).toMatchObject({ apiVersion: "dashboard.grafana.app/v2", kind: "Dashboard", metadata: { name: "clipify-vm01-overview" } });
	expect(Object.keys(dashboard.metadata)).toEqual(["name"]);
	expect(dashboard).not.toHaveProperty("panels");
	expect(dashboard.spec.layout.kind).toBe("RowsLayout");
	const panels = Object.values(dashboard.spec.elements).map((element: any) => {
		expect(element.kind).toBe("Panel");
		return element.spec;
	});
	expect(panels).toHaveLength(78);
	expect(dashboard.spec.layout.spec.rows).toHaveLength(14);
	expect(new Set(panels.map((panel: any) => panel.id)).size).toBe(panels.length);
	const refinedPanels = new Set([6, 7, 16, 20, 30, 39, 46, 101, 102]);
	for (const previousPanel of previous.panels.filter((panel: any) => panel.type !== "row" && !refinedPanels.has(panel.id))) {
		const panel: any = panels.find((panel: any) => panel.id === previousPanel.id);
		expect(panel.title).toBe(previousPanel.title);
		expect(panel.vizConfig.group).toBe(previousPanel.type);
		expect(panel.data.spec.queries.map((target: any) => target.spec.query.spec.query)).toEqual((previousPanel.targets ?? []).map((target: any) => target.query));
	}
	const added = panels.filter((panel: any) => panel.id >= 300 || panel.id === 103);
	expect(added).toHaveLength(21);
	for (const panel of added)
		for (const target of panel.data.spec.queries) {
			expect(target.spec.refId).toBe("A");
			if (panel.id === 310) {
				expect(target.spec.query.group).toBe("yesoreyeram-infinity-datasource");
				expect(target.spec.query.datasource.name).toBe("dffanq7dkba4gb");
				expect(target.spec.query.spec).toMatchObject({ parser: "backend", root_selector: "mcpClients.items", url: "https://clipify.us/internal/health/instance" });
			} else {
				expect(target.spec.query.group).toBe("influxdb");
				expect(target.spec.query.datasource.name).toBe("efg3es37pgh6ob");
				for (const match of target.spec.query.spec.query.matchAll(/r\._field == "((?:mcp_|mcpClients_|crawler_|notifications_|clips_)[a-zA-Z0-9_]+)"/g)) expect(fields).toHaveProperty(match[1]);
			}
		}
	expect(added.find((panel: any) => panel.title.includes("p95")).data.spec.queries[0].spec.query.spec.query).toContain("histogramQuantile");
	expect(panels.some((panel: any) => panel.id === 308)).toBe(false);
	for (const panel of added.filter((panel: any) => panel.vizConfig.group === "table")) {
		expect(panel.data.spec.transformations[0]).toMatchObject({ kind: "Transformation", group: "organize", spec: { options: { excludeByName: { Rank: true } } } });
	}
});
