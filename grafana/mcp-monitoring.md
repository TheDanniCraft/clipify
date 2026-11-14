# Health, conversion and MCP monitoring contract (v7)

`clipify-vm01-overview-v7.json` is the complete Grafana Cloud **Edit as JSON**
resource, including `apiVersion`, `kind`, `metadata` and `spec`. Keep the existing
dashboard identity `clipify-vm01-overview` and the API version used by your editor.
The revised dashboard extends v6 with seven panels in a conversion row. Existing panel identities and queries remain unchanged.

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

### Onboarding status and step detail

The overview shows Started (blue), In progress (orange), Completed (green) and
Invalid state. Zero invalid records is green; one or more is red. Completed in
this summary means the required first-overlay guide, not every optional guide.
Started includes saved active tasks as well as completed or skipped milestones;
existing resources may prefill progress. The legacy aggregate fields remain
available for existing consumers but tracked/untracked storage counts are no
longer the primary status summary.

The overlay-link copy card is a separate saved checkpoint. It does not establish
that OBS received the URL or that a stream was broadcast. The step table lists
all current guide tasks in guide order with completed, skipped, pending and
completion-rate columns. Its denominator is valid saved guide records, excluding
invalid states and accounts with no guide record. Section percentages retain
their existing saved-record denominator. Pending steps are not abandonment and
independent task counts are not an ordered conversion funnel.

These additional recursive `onboarding_tasks_*` fields become available after
the application is deployed and scraped. No account or resource identifiers are
exported and no migration or extra event tracking is introduced.

## Conversion and measurement health (v7)

Regenerate the v7 editor resource with
`python3 scripts/monitoring/build-conversion-dashboard.py`, then format the JSON.
It preserves the v6 dashboard identity and panels. Do not import it into another
customer's dashboard or change datasource credentials in JSON.

`conversion` exports numeric aggregates only. The rolling 30-day cohort uses
committed creator-created outcomes for the current deployment, then distinct
creators with observed playback, checkout and verified payment after signup.
It is not an ordered anonymous visitor funnel. Mature first-week activation
includes only creators at least seven days old, and requires playback within
their first seven days. This is a first-week window, not a claim that every
creator received a trial. Account deletion and rolling-window expiry can lower
these gauges. Never add database-wide gauges across replicas.

`billing.payingSubscriptions` counts active, positive-priced subscriptions in
the local billing mirror. It is not recognized revenue or proof that the latest
invoice was paid. Stripe remains authoritative for receipts. Trial, past-due /
unpaid and cancel-at-period-end subscriptions have separate counts; reverse
trials and complimentary access stay in entitlement metrics.

New fixed process-operation counters cover auth sessions (including returning
users), authenticated public checkout continuation, verified webhook handling,
and analytics consent exclusions. They contain neither account identifiers nor
browser events. Counts can include retries; they are not unique buyers.
Dashboard checkout callers remain covered by the durable checkout-created ledger,
not by the public-route operation counter. Normalize resets per stable source.
The new charts show observed increase from the start of the selected range;
first samples are baselines and unsampled work before restart can be lost.

The collector already exports `analyticsCache.deliveryAttempts`,
`deliverySucceeded`, `deliveryFailed` and `deliveryRetries`; v7 makes them
visible. A successful HTTP response is accepted delivery, not proof of exactly-once
ingestion. The existing outcome ID supports reconciliation. Consent exclusions
are expected. Zero attempted deliveries does not prove complete collection or a
failed pipeline. Missing scrapes must remain missing, not healthy zeros.

Do not enable no-sales or zero-event paging at this traffic volume. First inspect
existing alert rules; the connected alert-rule endpoint was unavailable during
the audit. Appropriate operational candidates are stale scrapes, sustained
checkout failures with real attempts, webhook-processing failures/backlog, and
rejected analytics deliveries. Validate thresholds with actual traffic and
separate expected plan restrictions and consent denials from incidents.

Import v7 only with validated queries. New fields remain unavailable until the
application containing this implementation is released and scraped. Existing
retention, credentials, routing and live alert rules are not changed by this
repository artifact.

Webhook backlog gauges come from durable `billing_webhook_events` rows. Failed events remain visible until recovered. Processing older than the existing five-minute lease is counted separately, with the oldest processing age in seconds. These are not failed-payment counts.
