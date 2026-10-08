# MCP monitoring contract (v6)

Import `clipify-vm01-overview-v6.json` as a new dashboard. It preserves v5 and uses
its existing InfluxDB datasource UID `efg3es37pgh6ob`, Flux bucket
`clipify_monitor`, and measurement `clipify_vm01`.

## Collector integration

The authenticated `/internal/health/instance` response gains an additive `mcp`
object. Existing fields, internal authentication and `no-store` remain unchanged.
`mcp-health-sample.json` is a deterministic zero-traffic example, not live data.
`mcp-influx-fields.json` is the exact numeric runtime field catalogue from that example. `mcp-client-influx-fields.json` is a 25-application fixture illustrating the dynamic adoption slots: counters/gauges are floats and `_name` fields are strings. There is no application-count limit; emit one slot per returned group.
`src/server/mcp/metrics-export.ts` supplies the mapping: recursively flatten
numeric paths using underscores, exclude strings/nulls, and convert the two ISO
start/sample timestamps to Unix seconds. Every numeric field must be written as
an Influx **float**, including counters and zero values, to avoid field-type
conflicts and integer/float Flux arithmetic conflicts. Do not write the sample
values into production.

Scrape each app process directly. Use a stable `instance` tag identifying its
scrape target; do not alternate replicas behind a load balancer under the same
tag. Keep the existing collector's host tags. Process UUIDs, timestamps, client
IDs, creator IDs and payloads must not become tags. Tool/reason labels are a fixed
catalogue, including one bounded `unknown`/`other` entry. Never reset counters on
read. Export timestamp gauges too; a changed start gauge marks a restart.

The collector configuration is external to this repository. Its operator must
add the numeric mapping, check stable per-process targeting, and verify points
in the actual bucket before importing v6. App deployment alone cannot establish
that the collector ingests newly added nested fields.

## Chart semantics

Counter queries call `increase()` separately for each source series before
`difference()` and replica aggregation. First samples provide baselines. Counts
are window deltas; rates divide those deltas by window duration. Missing scrapes
remain gaps; activity accumulated across a gap appears at the next observation,
so these rates are observed window rates, not instantaneous rates. No fill-zero
invented traffic is used. Calls after the final scrape and before restart can be
lost. Use the existing durable audit history for retained connection activity.

Latency average uses summed duration/count deltas. p95 uses histogram bucket
deltas summed across instances, with linear interpolation; it never averages
per-instance percentiles. Empty duration/error-ratio windows produce no sample,
not NaN or a misleading zero. The highest finite duration bucket is 60 seconds;
observations above it saturate the histogram estimate at that bound. Runtime
calls and HTTP requests are different counts: OAuth challenges/discovery/prompt
requests are not executed tools, and a domain denial can have HTTP status 200.

The admin view displays this process's totals since startup. Health snapshots
are process-local too. Grafana combines externally collected history across
stable instances. No user-specific RAM maps or sensitive content are collected.

## Reproducible acceptance

Start **fresh disposable** Grafana and InfluxDB 2.x services on loopback (Grafana
admin credentials `admin:admin`; InfluxDB setup not completed). Then run:

```sh
node test/support/monitoring/validate-mcp-grafana.mjs \
  http://127.0.0.1:18086 http://127.0.0.1:13030
```

The validator refuses non-loopback addresses. It sets up a test bucket and
datasource, imports v6 through Grafana's dashboard API, executes all query-bearing panels
through both InfluxDB and Grafana, and asserts fixture values for normal traffic,
reset, replicas, missing scrapes, zero traffic, average and histogram p95.
Validation was run locally with Grafana 12.2.0 and InfluxDB OSS 2.9.1. This proves
those real parsers accept the artifact; the external connector also accepted the new MCP queries, but live collector ingestion remains pending. The full 81-panel dashboard imported successfully; 360 Flux target queries across five scenarios and every query-bearing Grafana panel were accepted.

Client adoption uses existing OAuth clients, current grants and retained MCP
audit events, cached for one minute. These are database-wide gauges; do not sum
replica snapshots. Admin pagination covers every currently known app-name group.
The health endpoint and Grafana export every group, without a Top-X cap. Names
are bounded to 200 characters and case-normalized for grouping, are not verified
vendor identities, and never become tags. Expired unconsented registrations can
be removed by existing cleanup; deleted metadata is shown as `Unavailable app`.
Usage is limited by retained audits, not durable all-time analytics. The table selects fields from the latest snapshot timestamp, so removed slots do not remain visible. Influx retains points for 30 days; this limits history duration, while point volume still scales with application count.
The Flux table casts value columns to strings before pivot, then casts numeric
columns back to floats; this avoids Influx string/float schema collisions.

Both v5 and v6 are full dashboard JSON exports. The v5 baseline was read from the deployed dashboard (68 panels, version 17); v6 preserves all 68 and adds an MCP row and 12 panels.
