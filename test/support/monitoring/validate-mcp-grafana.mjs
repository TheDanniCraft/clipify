import fs from "node:fs/promises";
import assert from "node:assert/strict";
const [influx, grafana] = process.argv.slice(2);
for (const address of [influx, grafana]) {
	const url = new URL(address);
	assert.equal(url.hostname, "127.0.0.1", "Validation requires disposable loopback services");
	assert.equal(url.protocol, "http:");
}

const setup = await fetch(influx + "/api/v2/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "clipify-test", password: "local-validation-only", org: "clipify-validation", bucket: "clipify_monitor" }) });
if (!setup.ok) throw Error("Influx setup " + setup.status);
const init = await setup.json(),
	token = init.auth.token;

const ih = { Authorization: "Token " + token };
const headers = { Authorization: "Basic " + Buffer.from("admin:admin").toString("base64"), "Content-Type": "application/json" };
const dashboard = JSON.parse(await fs.readFile("grafana/clipify-vm01-overview-v6.json", "utf8"));
assert.equal(dashboard.apiVersion, "dashboard.grafana.app/v2");
assert.equal(dashboard.kind, "Dashboard");
const panels = Object.values(dashboard.spec.elements).map(({ spec }) => ({ id: spec.id, title: spec.title, targets: spec.data.spec.queries.map(({ spec: target }) => ({ ...target.query.spec, refId: target.refId, hide: target.hidden, datasource: { type: target.query.group, uid: target.query.datasource.name } })) }));
const fields = { ...JSON.parse(await fs.readFile("grafana/mcp-influx-fields.json", "utf8")), ...JSON.parse(await fs.readFile("grafana/mcp-client-influx-fields.json", "utf8")) };
const end = Math.floor(Date.now() / 1000) - 10,
	start = end - 120;
const scenarios = ["normal", "reset", "replicas", "zero", "gap"];
let lines = [];
for (const scenario of scenarios)
	for (const instance of scenario === "replicas" ? ["a", "b"] : ["a"])
		for (let i = 0; i <= 5; i++) {
			if (scenario === "gap" && i === 3) continue;
			const total = scenario === "zero" ? 0 : scenario === "reset" && i >= 3 ? i - 3 : i;
			const values = { ...fields };
			for (const key of Object.keys(values)) {
				if (key.startsWith("mcp_duration_buckets_")) values[key] = key === "mcp_duration_buckets_le_inf_total" || Number(key.slice("mcp_duration_buckets_le_".length, -"_total".length).replace("_", ".")) >= 0.1 ? total : 0;
			}
			Object.assign(values, {
				mcp_calls_started_total: total,
				mcp_calls_completed_total: total,
				mcp_calls_success_total: total,
				mcp_duration_count: total,
				mcp_duration_seconds_sum: total * 0.1,
				mcp_tools_get_overlay_started_total: total,
				mcp_processStartedAtUnixSeconds: start - 5,
				mcp_sampledAtUnixSeconds: start + i * 20,
				mcp_clients_available: 1,
				mcp_clients_registeredClients: 23,
				mcp_clients_applicationNames: 23,

				mcp_clients_app_1_name: "Meta MCP",
				mcp_clients_app_1_calls30d: 4,
			});
			for (const old of ["galleries_total", "galleries_published", "galleries_draft", "galleries_orphanedCurated", "galleries_curated", "galleries_live", "creatorPages_discoverable", "creatorPages_unlisted", "creatorPages_disabled", "creatorPages_showBio", "analyticsCache_valid", "analyticsCache_expired", "analyticsCache_apiFailures", "analyticsCache_rateLimited", "analyticsCache_staleFallbacks"]) values[old] = 1;
			lines.push(
				"clipify_vm01,scenario=" +
					scenario +
					",instance=" +
					instance +
					" " +
					Object.entries(values)
						.map(([k, v]) => k + "=" + (typeof v === "string" ? JSON.stringify(v) : Number(v)))
						.join(",") +
					" " +
					(start + i * 20),
			);
		}
const write = await fetch(influx + "/api/v2/write?org=clipify-validation&bucket=clipify_monitor&precision=s", { method: "POST", headers: ih, body: lines.join("\n") });
if (!write.ok) throw Error(await write.text());
const ds = await fetch(grafana + "/api/datasources", { method: "POST", headers, body: JSON.stringify({ name: "Clipify validation", uid: "efg3es37pgh6ob", type: "influxdb", access: "proxy", url: influx, jsonData: { version: "Flux", organization: "clipify-validation", defaultBucket: "clipify_monitor" }, secureJsonData: { token } }) });
if (!ds.ok) throw Error("Datasource " + (await ds.text()));
const imported = await fetch(grafana + "/apis/dashboard.grafana.app/v2/namespaces/default/dashboards", { method: "POST", headers, body: JSON.stringify(dashboard) });
if (!imported.ok) throw Error("Import " + (await imported.text()));
console.log("Grafana import:", await imported.json());
let results = [];
for (const scenario of scenarios)
	for (const panel of panels)
		for (const target of panel.targets ?? []) {
			if (!target.query) continue;
			const q = target.query
				.replaceAll("v.timeRangeStart", 'time(v: "' + new Date(start * 1000).toISOString() + '")')
				.replaceAll("v.timeRangeStop", 'time(v: "' + new Date((end + 1) * 1000).toISOString() + '")')
				.replaceAll("v.windowPeriod", "20s")
				.replace('  |> filter(fn: (r) => r._measurement == "clipify_vm01")', '  |> filter(fn: (r) => r._measurement == "clipify_vm01" and r.scenario == "' + scenario + '")');
			const res = await fetch(influx + "/api/v2/query?org=clipify-validation", { method: "POST", headers: { ...ih, "Content-Type": "application/vnd.flux", Accept: "application/csv" }, body: q });
			const csv = await res.text();
			if (!res.ok) throw Error(scenario + " / " + panel.title + "\n" + csv);
			results.push({ scenario, panel: panel.title, csv });
		}
await fs.writeFile("/tmp/clipify-monitoring-query-results.json", JSON.stringify(results));
function values(scenario, panel) {
	const csv = results.find((r) => r.scenario === scenario && r.panel === panel).csv;
	let valueIndex = -1;
	const output = [];
	for (const row of csv.split(/\r?\n/)) {
		const columns = row.split(",");
		if (columns[1] === "result") valueIndex = columns.indexOf("_value");
		else if (columns[1] === "_result" && valueIndex >= 0) output.push(Number(columns[valueIndex]));
	}
	return output;
}
const rateTitle = "MCP calls per minute";
assert.deepEqual(values("normal", rateTitle), [3, 3, 3, 3, 3]);
assert.deepEqual(values("reset", rateTitle), [3, 3, 0, 3, 3]);
assert.deepEqual(values("replicas", rateTitle), [6, 6, 6, 6, 6]);
assert.deepEqual(values("zero", rateTitle), [0, 0, 0, 0, 0]);
assert.equal(values("gap", rateTitle).length, 4);
assert.equal(values("zero", "MCP average duration").length, 0);
assert.equal(values("zero", "MCP p95 duration (histogram)").length, 0);
assert.equal(values("zero", "MCP error ratio").length, 0);
for (const scenario of ["normal", "replicas", "gap"]) {
	assert(values(scenario, "MCP average duration").every((v) => Math.abs(v - 0.1) < 1e-10));
	assert(values(scenario, "MCP p95 duration (histogram)").every((v) => Math.abs(v - 0.0975) < 1e-10));
}

for (const panel of panels) {
	const targets = (panel.targets ?? []).filter((target) => target.query);
	if (!targets.length) continue;
	const res = await fetch(grafana + "/api/ds/query", { method: "POST", headers, body: JSON.stringify({ from: String(start * 1000), to: String((end + 1) * 1000), queries: targets.map((target) => ({ ...target, datasource: { uid: "efg3es37pgh6ob", type: "influxdb" }, intervalMs: 20000, maxDataPoints: 1000 })) }) });
	const data = await res.json();
	if (!res.ok || Object.values(data.results ?? {}).some((result) => result.error)) throw Error("Grafana query " + panel.title + " " + JSON.stringify(data));
}
const adoption = results.find((r) => r.scenario === "normal" && r.panel === "MCP applications (self-reported)");
assert(adoption.csv.includes("Meta MCP"));
assert(adoption.csv.includes("Custom 25"), "Every application is exported, including groups beyond rank 20");
console.log("Flux queries:", results.length, "Grafana panels:", panels.length);
await fs.writeFile("/tmp/clipify-monitoring-validation.json", JSON.stringify({ grafana: (await (await fetch(grafana + "/api/health")).json()).version, influx: "2.9.1", imported: true, panels: panels.length, fluxQueries: results.length, scenarios, validatedAt: new Date().toISOString() }, null, 2));
