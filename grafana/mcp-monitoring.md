# Health and MCP monitoring contract (v6)

`clipify-vm01-overview-v6.json` is the complete Grafana Cloud **Edit as JSON**
resource, including `apiVersion`, `kind`, `metadata` and `spec`. Keep the existing
dashboard identity `clipify-vm01-overview` and the API version used by your editor.
The revised dashboard has 85 panels in 15 rows.

## Data sources

Historical charts use the existing InfluxDB datasource `efg3es37pgh6ob`, bucket
`clipify_monitor`, measurement `clipify_vm01`. The collector recursively flattens
numeric health paths with underscores, including zero values, as Influx floats.
For example, `crawler.dueRecent` becomes `crawler_dueRecent`. No collector-side
string mapping is needed for the new numeric metrics.

The current MCP applications table uses the existing authenticated Infinity
health datasource `dffanq7dkba4gb` at
`https://clipify.us/internal/health/instance`. It reads `mcpClients.items` with the
backend parser, including every self-reported application name. Configure the
bearer token in the datasource's secure settings, never in dashboard JSON.
This table shows current groups and retained 30-day audit usage independently of
the chart time range. Names are metadata, not verified vendor identities. No
numbered-slot identities or Top-X limit are used.

Client adoption totals use the actual numeric collector fields
`mcpClients_summary_*`, taking all columns from the same latest sample. They are
database-wide gauges and must not be summed across replicas. Names need not be
stored in Influx for the current applications table to work.

`mcp-health-sample.json` is a deterministic monitoring fixture, not production
values. The two `*-influx-fields.json` files provide counter/client fixtures for
local acceptance testing; their legacy client mapping is converted to the
collector's `mcpClients_*` paths by the validator. Do not ingest fixture values.

## New health fields

Every authenticated health request reads fresh values; it remains `no-store`.
There is no aggregate TTL cache and no schema migration.

- `crawler`: due and running recent/history jobs, pending manual refreshes,
  future scheduled jobs, retrying jobs, expired leases, oldest due-job age and
  oldest manual-refresh wait. Counts exclude disabled creators and follow the
  workers' due/lease boundaries. Retry counts are gauges, not lifetime failures.
- `notifications`: due first attempts/retries, future scheduled notices/retries,
  active claims, expired claims, failed notices, deliberately skipped notices and
  oldest overdue unclaimed notice. Sent history is excluded from the aggregate
  query. `NOTIFICATION_NO_LONGER_APPLIES` is a skip, not a delivery failure.
- `clips.fallbackReasons`: fixed process counters for missing credentials,
  disabled accounts, refresh failures, missing download scopes, rejected API
  requests, API/network errors, rate limits and empty download responses. They
  contain no user IDs, clip IDs, credentials or arbitrary error text.

Age gauges are seconds, clamped to zero when no matching backlog exists. Future
scheduled work is distinct from overdue work. These are observed queue ages,
not promises about the next start time.

Download permission coverage accepts comma-separated native Better Auth scopes
and whitespace-separated migrated scopes with exact token boundaries. It
measures permission coverage, not token validity or active users. Expired access
tokens may still refresh successfully. Recent sign-ins are labelled as sign-ins,
rather than treating them as every form of application activity.

## Chart semantics

Normalize process counters with `increase()` per source series before calculating
deltas and combining replicas. First samples are baselines; missing scrapes stay
gaps, and work between the last scrape and a restart can be lost. Use stable
per-process scrape targets and tags rather than alternating replicas behind a
load balancer. Never put client names, IDs or payloads in metric tags.

Rates divide deltas by window length. The tool-usage table shows every used tool
sorted by total calls in the selected period. Reason charts retain zero
intervals for each series that has activity in that period.
Average latency and histogram p95 combine observations, never per-instance
percentiles. No-call windows have no latency or error-ratio sample. HTTP responses
and executed tools are separate: a 4xx OAuth challenge can be expected.

Scrape age uses the Influx sample timestamp. Uptime already describes the host
process; no separate estimated MCP process-start panel is needed. Missing
telemetry stays missing rather than appearing as healthy zero traffic.

## Reproducible acceptance

Start fresh disposable Grafana 13.2.x with Infinity 4.1.1 installed and InfluxDB
2.x on loopback (Grafana `admin:admin`, Influx setup not yet completed). Run:

```sh
node test/support/monitoring/validate-mcp-grafana.mjs \
  http://127.0.0.1:18086 http://127.0.0.1:13030
```

The validator rejects non-loopback services, imports the full V2 resource and
executes charts through both Influx and Grafana. It exercises normal traffic,
resets, replicas, zero traffic and missing scrapes, plus an authenticated,
uncached health fixture containing 25 named applications. Real production data
and credentials are not used. The current revision passed on Grafana 13.2.3,
Infinity 4.1.1 and InfluxDB 2.9.1: 78 panels and 400 Flux scenario queries.

The production bucket has a 30-day retention policy. History duration is bounded
by retention, while stored point volume scales with the fields/application groups
exported by the collector. Cloud import/deployment is separate from local
acceptance; new crawler/outbox/fallback fields appear after the app is released
and the existing collector scrapes that version.

## Onboarding guides

`onboarding` is a fresh, single SQL aggregate over saved account guide records.
It contains counts only, with fixed section names from the guide definitions;
no account IDs, overlay IDs, playlist IDs or raw saved state are exported.
The same aggregate appears in the authenticated health endpoint and admin page.

- `trackedAccounts` counts accounts with a saved guide record. `untrackedAccounts`
  counts other accounts; they are excluded from completion denominators.
- `accountsWithProgress` counts records with at least one completed or skipped
  current task. It is not a count of explicit guide starts: existing resources
  can prefill completion, and browser-only legacy progress is not visible until
  imported into the account record.
- `completedAccounts` and `completionRate` require every current task, including
  optional sections, to be completed. Skipped tasks never count as completed.
- `averageProgress` is completed tasks divided by tracked accounts times the
  current number of tasks. `sections` exposes those same counts and ratios for
  overlay setup, appearance, playlists and exploration.
- `invalidProgressAccounts` counts unreadable or unsupported saved records.
  They remain in the denominator as incomplete. Empty populations have zero
  ratios; the admin page displays an explicit empty state.

These are current-state gauges, not event counters. Resetting a guide or adding
new tasks can lower completion. Per-section rates use all tracked accounts,
not just accounts that touched that section. Historical panels use the existing
recursive collector fields (`onboarding_*`) and the latest sample per window,
without summing replicas. The section table uses one latest complete sample in
the selected period. There is no new tracking schema or migration.
