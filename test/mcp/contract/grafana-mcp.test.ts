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
	for (const key of ["crawler", "notifications", "clips", "mcpClients", "onboarding"]) collect(sample[key], key);
	expect(dashboard).toMatchObject({ apiVersion: "dashboard.grafana.app/v2", kind: "Dashboard", metadata: { name: "clipify-vm01-overview" } });
	expect(Object.keys(dashboard.metadata)).toEqual(["name"]);
	expect(dashboard).not.toHaveProperty("panels");
	expect(dashboard.spec.layout.kind).toBe("RowsLayout");
	const panels = Object.values(dashboard.spec.elements).map((element: any) => {
		expect(element.kind).toBe("Panel");
		return element.spec;
	});
	expect(panels).toHaveLength(86);
	expect(dashboard.spec.layout.spec.rows).toHaveLength(15);
	expect(new Set(panels.map((panel: any) => panel.id)).size).toBe(panels.length);
	const refinedPanels = new Set([6, 7, 16, 20, 30, 39, 46, 101, 102]);
	for (const previousPanel of previous.panels.filter((panel: any) => panel.type !== "row" && !refinedPanels.has(panel.id))) {
		const panel: any = panels.find((panel: any) => panel.id === previousPanel.id);
		expect(panel.title).toBe(previousPanel.title);
		expect(panel.vizConfig.group).toBe(previousPanel.type);
		expect(panel.data.spec.queries.map((target: any) => target.spec.query.spec.query)).toEqual((previousPanel.targets ?? []).map((target: any) => target.query));
	}
	const added = panels.filter((panel: any) => panel.id >= 300 || panel.id === 103);
	expect(added).toHaveLength(29);
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
				for (const match of target.spec.query.spec.query.matchAll(/r\._field == "((?:mcp_|mcpClients_|crawler_|notifications_|clips_|onboarding_)[a-zA-Z0-9_]+)"/g)) expect(fields).toHaveProperty(match[1]);
			}
		}
	expect(added.find((panel: any) => panel.title.includes("p95")).data.spec.queries[0].spec.query.spec.query).toContain("histogramQuantile");
	expect(panels.some((panel: any) => panel.id === 308)).toBe(false);
	for (const panel of added.filter((panel: any) => panel.vizConfig.group === "table")) {
		expect(panel.data.spec.transformations[0]).toMatchObject({ kind: "Transformation", group: "organize", spec: { options: { excludeByName: { Rank: true } } } });
	}
});

test("Flux metric overrides label numeric values without leaking query range metadata", () => {
	const dashboard = JSON.parse(readFileSync("grafana/clipify-vm01-overview-v6.json", "utf8"));
	let checked = 0;
	for (const element of Object.values(dashboard.spec.elements) as any[]) {
		const config = element.spec.vizConfig.spec.fieldConfig;
		for (const override of config.overrides ?? []) {
			const pattern = override.matcher.options;
			const metric = typeof pattern === "string" ? pattern.match(/(?:onboarding|mcp|mcpClients|crawler|notifications|clips)_[A-Za-z0-9_]+/)?.[0] : undefined;
			if (!metric) continue;
			expect(override.matcher.id).toBe("byRegexp");
			const matcher = new RegExp(pattern);
			expect(matcher.test(metric)).toBe(true);
			expect(matcher.test(`_value {_field="${metric}", _start="2026-10-01 00:00:00 +0000 UTC", _stop="2026-10-31 00:00:00 +0000 UTC"}`)).toBe(true);
			expect(matcher.test(`_value {_stop="now", _field="${metric}", _start="then"}`)).toBe(true);
			expect(matcher.test(`_value {_field="${metric}_other"}`)).toBe(false);
			expect(matcher.test(`host {_field="${metric}"}`)).toBe(false);
			checked++;
		}
	}
	expect(checked).toBeGreaterThan(40);
});

test("onboarding summarizes actionable states and exposes every saved guide milestone", () => {
	const dashboard = JSON.parse(readFileSync("grafana/clipify-vm01-overview-v6.json", "utf8"));
	const summary = dashboard.spec.elements["panel-500"].spec;
	expect(summary.title).toBe("Onboarding status");
	const rules = summary.vizConfig.spec.fieldConfig.overrides;
	expect(rules.map((rule: any) => rule.properties.find((property: any) => property.id === "displayName").value)).toEqual(["Started", "In progress", "Completed", "Invalid state"]);
	expect(rules[3].properties).toEqual(
		expect.arrayContaining([
			{
				id: "thresholds",
				value: {
					mode: "absolute",
					steps: [
						{ color: "green", value: null },
						{ color: "red", value: 1 },
					],
				},
			},
		]),
	);
	expect(dashboard.spec.elements["panel-501"].spec.title).toBe("Overlay link copied");
	const taskQuery = dashboard.spec.elements["panel-507"].spec.data.spec.queries[0].spec.query.spec.query;
	const sample = JSON.parse(readFileSync("grafana/mcp-health-sample.json", "utf8"));
	for (const [key, task] of Object.entries(sample.onboarding.tasks) as [string, any][]) {
		expect(taskQuery).toContain(task.title);
		for (const metric of ["completedAccounts", "skippedAccounts", "pendingAccounts", "completionRate"]) expect(taskQuery).toContain(`onboarding_tasks_${key}_${metric}`);
	}
});
