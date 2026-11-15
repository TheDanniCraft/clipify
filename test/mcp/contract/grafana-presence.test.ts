/** @jest-environment node */
import { readFileSync } from "node:fs";

test("v8 remains a complete dashboard and adds compact presence metrics without changing existing panels", () => {
	const previous = JSON.parse(readFileSync("grafana/clipify-vm01-overview-v7.json", "utf8"));
	const dashboard = JSON.parse(readFileSync("grafana/clipify-vm01-overview-v8.json", "utf8"));
	expect(dashboard).toMatchObject({ apiVersion: previous.apiVersion, kind: "Dashboard", metadata: previous.metadata });
	const audit = JSON.parse(readFileSync("grafana/clipify-v8-series-audit.json", "utf8"));
	expect(audit.policies.map((panel: any) => panel.id).sort((a: number, b: number) => a - b)).toEqual(
		Object.values(dashboard.spec.elements)
			.map((element: any) => element.spec.id)
			.sort((a: number, b: number) => a - b),
	);
	for (const [name, oldElement] of Object.entries(previous.spec.elements) as [string, any][]) {
		const panel = dashboard.spec.elements[name].spec;
		expect(panel.id).toBe(oldElement.spec.id);
		expect(panel.title).toBe(panel.id === 42 ? "Enabled overlays" : oldElement.spec.title);
		expect(panel.vizConfig.spec.options).toEqual(oldElement.spec.vizConfig.spec.options);
		expect(panel.data.spec.transformations).toEqual(oldElement.spec.data.spec.transformations);
		if (!audit.policies.find((row: any) => row.id === panel.id).queryChanged) expect(panel.data.spec.queries).toEqual(oldElement.spec.data.spec.queries);
	}
	expect(Object.keys(dashboard.spec.elements)).toHaveLength(101);
	const rows = dashboard.spec.layout.spec.rows;
	expect(rows.slice(0, 3).map((row: any) => row.spec.title)).toEqual(["Executive Summary", "Creator presence", "Creator presence history"]);
	const references: string[] = [];
	for (const row of rows) {
		expect(row.spec.title.trim()).not.toBe("");
		expect(row.spec.hideHeader).toBeUndefined();
		expect(row.spec.layout.kind).toBe("AutoGridLayout");
		for (const item of row.spec.layout.spec.items) references.push(item.spec.element.name);
	}
	expect(references.sort()).toEqual(Object.keys(dashboard.spec.elements).sort());
	expect(rows[1].spec.layout.spec).toMatchObject({ maxColumnCount: 4, columnWidthMode: "narrow", rowHeightMode: "short" });
	for (let id = 700; id <= 705; id++) {
		const panel = dashboard.spec.elements[`panel-${id}`].spec;
		expect(panel.data.spec.queries[0].spec.query.spec.query).toContain('sort(columns: ["_time"], desc: true)');
		expect(panel.vizConfig.spec.fieldConfig.defaults.noValue).toBe("Unavailable");
		expect(panel.data.spec.queries[0].spec.query.spec.query).toContain("date.sub(d: 3m, from: now())");
	}
	for (const id of [700, 701, 703]) expect(dashboard.spec.elements[`panel-${id}`].spec.data.spec.queries[0].spec.query.spec.query).toContain("presence_twitchSnapshotFresh == 1.0");
	expect(dashboard.spec.elements["panel-707"].spec.title).toBe("Clipify usage over time");
});

test("v8 collapses deployment host labels for shared gauges and gives series stable colors", () => {
	const dashboard = JSON.parse(readFileSync("grafana/clipify-vm01-overview-v8.json", "utf8"));
	const audit = JSON.parse(readFileSync("grafana/clipify-v8-series-audit.json", "utf8"));
	for (const element of Object.values(dashboard.spec.elements) as any[]) {
		const panel = element.spec;
		expect(panel.vizConfig.spec.fieldConfig.defaults.color?.mode).not.toBe("palette-classic");
		const policy = audit.policies.find((row: any) => row.id === panel.id).policy;
		if (policy === "shared-gauge" || policy === "sampled-instance-gauge") {
			for (const target of panel.data.spec.queries) {
				expect(target.spec.query.spec.query).toContain('keep(columns: ["_time", "_value", "_field"])');
				expect(target.spec.query.spec.query).toContain('group(columns: ["_field"])');
				expect(target.spec.query.spec.query).toContain('sort(columns: ["_time"])');
			}
		}
		expect(JSON.stringify(panel.vizConfig.spec.fieldConfig)).not.toContain("__field.labels.host");
		if (policy === "single-instance-counter") {
			const query = panel.data.spec.queries[0].spec.query.spec.query;
			expect(query.indexOf('group(columns: ["_field"])')).toBeLessThan(query.indexOf("increase()"));
			expect(query).toContain('group(columns: ["_field", "_time"])');
		}
	}
	const crawler = dashboard.spec.elements["panel-402"].spec;
	expect(crawler.data.spec.queries[0].spec.query.spec.query).toContain('keep(columns: ["_time", "_value", "_field"])');
	for (const rule of crawler.vizConfig.spec.fieldConfig.overrides) expect(rule.properties).toEqual(expect.arrayContaining([{ id: "color", value: expect.objectContaining({ mode: "fixed" }) }]));
});
