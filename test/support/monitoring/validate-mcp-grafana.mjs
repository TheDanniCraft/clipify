import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createServer } from "node:http";
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
const clientFields = JSON.parse(await fs.readFile("grafana/mcp-client-influx-fields.json", "utf8"));
const collectorClientFields = {};
for (const [key, value] of Object.entries(clientFields)) {
	const application = key.match(/^mcp_clients_app_(\d+)_(.+)$/);
	if (application) collectorClientFields[`mcpClients_items_${Number(application[1]) - 1}_${application[2]}`] = value;
	else if (/^mcp_clients_(registeredClients|authorizedClients|activeClients30d|calls30d|applicationNames)$/.test(key)) collectorClientFields[key.replace("mcp_clients_", "mcpClients_summary_")] = value;
}
const fields = { ...JSON.parse(await fs.readFile("grafana/mcp-influx-fields.json", "utf8")), ...collectorClientFields };
const sample = JSON.parse(await fs.readFile("grafana/mcp-health-sample.json", "utf8"));
function flattenNumbers(value, path) {
	if (typeof value === "number") fields[path] = value;
	else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) flattenNumbers(child, `${path}_${key}`);
}
for (const key of ["crawler", "notifications", "clips", "onboarding"]) flattenNumbers(sample[key], key);
const healthFixture = { ...sample, mcpClients: { ...sample.mcpClients, items: Array.from({ length: 25 }, (_, index) => ({ name: index === 0 ? "Meta MCP" : `Custom ${index + 1}`, registeredClients: 1, authorizedClients: 1, activeConnections: 1, activeClients30d: 1, calls30d: 4 })) } };
let healthReads = 0;
const fixture = createServer((request, response) => {
	if (request.headers.authorization !== "Bearer monitoring-fixture-only") {
		response.writeHead(401);
		response.end();
		return;
	}
	healthReads++;
	response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
	response.end(JSON.stringify(healthFixture));
});
await new Promise((resolve) => fixture.listen(0, "127.0.0.1", resolve));
fixture.unref();
const healthUrl = `http://127.0.0.1:${fixture.address().port}/internal/health/instance`;
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
			if (scenario === "zero") for (const key of Object.keys(values)) if (key.startsWith("onboarding_") && !key.endsWith("tasksPerAccount")) values[key] = 0;
			Object.assign(values, {
				mcp_calls_started_total: total,
				mcp_calls_completed_total: total,
				mcp_calls_success_total: total,
				mcp_duration_count: total,
				mcp_duration_seconds_sum: total * 0.1,
				mcp_tools_get_overlay_started_total: total,
				mcp_processStartedAtUnixSeconds: start - 5,
				mcp_sampledAtUnixSeconds: start + i * 20,
				mcpClients_summary_registeredClients: 23,
				mcpClients_summary_applicationNames: 23,

				mcpClients_items_0_name: "Meta MCP",
				mcpClients_items_0_calls30d: 4,
				crawler_dueRecent: 3,
				crawler_dueBackfill: 2,
				crawler_runningRecent: 1,
				crawler_oldestManualWaitSeconds: 45,
				notifications_duePending: 2,
				notifications_failed: 1,
				notifications_skipped: 4,
				notifications_oldestDueAgeSeconds: 30,
				clips_fallbackReasons_missingScope: total,
				clips_fetches_v1GraphQL: total,
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
const healthDs = await fetch(grafana + "/api/datasources", { method: "POST", headers, body: JSON.stringify({ name: "Health fixture", uid: "dffanq7dkba4gb", type: "yesoreyeram-infinity-datasource", access: "proxy", url: healthUrl, jsonData: { auth_method: "bearerToken", allowedHosts: [healthUrl] }, secureJsonData: { bearerToken: "monitoring-fixture-only" } }) });
if (!healthDs.ok) throw Error("Health datasource " + (await healthDs.text()));
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
for (const scenario of ["normal", "replicas", "gap"]) {
	assert.deepEqual(values(scenario, "First-overlay guide completion"), [0.2]);
	assert(values(scenario, "Average guide progress").every((value) => Math.abs(value - 22 / 90) < 1e-10));
}
assert.deepEqual(values("zero", "First-overlay guide completion"), [0]);
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

let namedApplications;
let guideSections;
let guideSteps;
for (const panel of panels) {
	const targets = (panel.targets ?? []).filter((target) => target.query || target.type === "json");
	if (!targets.length) continue;
	const res = await fetch(grafana + "/api/ds/query", { method: "POST", headers, body: JSON.stringify({ from: String(start * 1000), to: String((end + 1) * 1000), queries: targets.map((target) => ({ ...target, ...(target.type === "json" ? { url: healthUrl } : {}), intervalMs: 20000, maxDataPoints: 1000 })) }) });
	const data = await res.json();
	if (!res.ok || Object.values(data.results ?? {}).some((result) => result.error)) throw Error("Grafana query " + panel.title + " " + JSON.stringify(data));
	if (panel.title === "MCP applications (current)") namedApplications = data;
	if (panel.title === "Guide sections") guideSections = data;
	if (panel.title === "Guide step details") guideSteps = data;
}
const sectionNames = guideSections.results.A.frames.flatMap((frame) => {
	const column = frame.schema.fields.findIndex((field) => field.name === "Section");
	return column < 0 ? [] : frame.data.values[column];
});
assert.deepEqual(
	sectionNames,
	Object.values(sample.onboarding.sections).map((section) => section.title),
);
const stepNames = guideSteps.results.A.frames.flatMap((frame) => {
	const column = frame.schema.fields.findIndex((field) => field.name === "Step");
	return column < 0 ? [] : frame.data.values[column];
});
assert.deepEqual(
	stepNames,
	Object.values(sample.onboarding.tasks).map((task) => task.title),
);
assert(JSON.stringify(namedApplications).includes("Meta MCP"));
assert(JSON.stringify(namedApplications).includes("Custom 25"), "Every application is returned, including groups beyond rank 20");
assert(healthReads > 0, "Named applications are read through the authenticated health datasource");
assert(values("normal", "Oldest overdue email").every((value) => value === 30));
assert(values("normal", "Crawler wait time").includes(45));
fixture.close();
console.log("Flux queries:", results.length, "Grafana panels:", panels.length);
await fs.writeFile("/tmp/clipify-monitoring-validation.json", JSON.stringify({ grafana: (await (await fetch(grafana + "/api/health")).json()).version, influx: "2.9.1", imported: true, panels: panels.length, fluxQueries: results.length, scenarios, validatedAt: new Date().toISOString() }, null, 2));
