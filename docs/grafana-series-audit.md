# Grafana series and color audit

Audit date: November 15, 2026. Read-only inventory of all 14 dashboards in the
connected Grafana instance: 323 panels. Clipify fixes are prepared in the complete
v8 export in this PR; no live dashboard or managed template was edited.

## Inventory

“Index” counts explicitly configured order-dependent palettes. “Default” counts
modern chart panels without an explicit color mode, which can fall back to the
index palette. These are configuration findings, not proof that every such panel
has visibly changed colors. Fixed per-series overrides can protect known series.

| Dashboard                                            | Panels | Index | Default | Assessment                                                               |
| ---------------------------------------------------- | -----: | ----: | ------: | ------------------------------------------------------------------------ |
| Alert Groups Insights                                |     17 |     2 |       0 | Order-dependent color assignment can change with returned series         |
| Cardinality management - 1 - overview                |      8 |     0 |       0 | No index-palette setting found in the reviewed chart configuration       |
| Cardinality management - 2 - metrics                 |      9 |     0 |       0 | No index-palette setting found in the reviewed chart configuration       |
| Cardinality management - 3 - labels                  |      6 |     0 |       0 | No index-palette setting found in the reviewed chart configuration       |
| Clipify VM01 Overview v7                             |     93 |    73 |       0 | Confirmed duplicate host series; fixed in v8                             |
| Cloud Logs Export Insights                           |      8 |     0 |       0 | No index-palette setting found in the reviewed chart configuration       |
| Grafana Cloud Billing/Usage                          |    107 |     0 |      52 | 52 charts use default color assignment; pin names for stable comparisons |
| Incident Insights                                    |     20 |     2 |       0 | Index default with four severity color overrides on each affected panel  |
| Usage Insights - 1 - Overview                        |     11 |     1 |       0 | Three explicit series-color overrides protect the index-palette panel    |
| Usage Insights - 2 - Data sources                    |     13 |     2 |       0 | Two color overrides on each affected panel                               |
| Usage Insights - 3 - Query Errors                    |      8 |     1 |       0 | Order-dependent color assignment can change with returned series         |
| Usage Insights - 4 - Alertmanager                    |      4 |     0 |       1 | Order-dependent color assignment can change with returned series         |
| Usage Insights - 5 - Metrics Ingestion               |     10 |     4 |       0 | Order-dependent color assignment can change with returned series         |
| Usage Insights - 6 - Loki Query Fair Usage Drilldown |      9 |     3 |       0 | Confirmed duplicate labels in panels 2 and 3; unpinned colors            |

13 dashboards are provisioned by Grafana. Changes to their source templates or
owned copies require separate maintenance; editing the Clipify export does not
change those dashboards. Runtime validation here targets Clipify's Influx data.
The other dashboards were reviewed for query/label/color configuration, not every
possible variable selection or historical data combination.

## Confirmed live Clipify problem

The live `Crawler wait time` query retains deployment `host` and `url` dimensions.
A 30-day read returned three host series for each of its two metric names: six
frames. Friendly display-name overrides hid the host distinction and produced
repeated legend labels. The index-based palette then assigned colors by returned
series order, explaining the red/blue/green changes.

The corrected read-only query drops metadata dimensions, groups by metric, sorts
by time and selects the latest sample per window. The same live dataset returns
two frames with no host/URL labels. Fixed blue/purple overrides keep the two wait
metrics consistent independently of frame order.

The full Clipify panel inventory and aggregation policy is recorded in
`grafana/clipify-v8-series-audit.json`. V8 preserves all existing panels and their
sizes; it changes query grouping/selection, series naming and color assignment
where the audit found ambiguity. Shared database gauges are never summed across
replicas. Sampled-instance gauges use time ordering so retired hosts cannot win
last-value selection. Clipify has one logical instance. Counter-increase history
removes deployment metadata, collapses duplicate timestamps, sorts the observations and applies
reset-aware increases to the combined timeline. A restart remains part of the
same metric history. Existing rate queries already reduce their process-local
increments into one logical series. Source-presence history also uses one line
per metric across deployment IDs; no chart exposes host IDs as separate legends.

Plan labels now say Pro/Free plan creators, not paid customers. Recent sign-in
labels describe sign-ins rather than continuous activity. Enabled-overlay labels
describe saved configuration rather than connected sources. Subscription panels
remain the billing comparison; current source counts have their own section.

All chart palettes in v8 use stable name-based assignment unless an existing
fixed/threshold policy applies. Static series receive deterministic color
assignments; gauges keep their semantic threshold colors. Current presence stats
also reject health samples older than three minutes, independently of Twitch
snapshot expiry, so a stopped scraper cannot leave old counts looking current.

## Confirmed managed-template label problems

In `Usage Insights - 6 - Loki Query Fair Usage Drilldown`
(`cdybdibbio2dcd`), panel 2 (`query types count`) labels both visible targets C and D
`grafana-alerts`. C filters `source="grafana-alert"`; D filters
`source="grafana-lokiexplore-app"`. D should identify the log-exploration app.
Panel 3 (`bytes by source`) labels both C and D `explore/other` despite D selecting
that app explicitly. Give D the same distinct app label. These are confirmed
configuration collisions; actual visibility depends on the selected instance and
available logs. They were not changed in the provisioned dashboard.

Ten other explicitly index-colored managed panels have no series-color overrides:
Alert Groups Insights 24/36; Usage Insights Query Errors 4; Metrics Ingestion
3/5/6/7; Loki Fair Usage 1/2/11. Their configuration permits colors to shift when
series order changes. The 52 default-color Billing/Usage charts and Alertmanager
Logs Volume panel 5 also lack explicit color assignment. Where category identity
matters, set name-based colors or explicit overrides in maintained source.

## Datasource health

Checked all 15 configured datasources: 11 healthy, one unhealthy, three without a
backend health-check capability. Both Clipify's InfluxDB and authenticated health
Infinity datasource are healthy. The unrelated Knowledge Graph datasource reports
`Stack status is not_initialized` (HTTP 400). Cardinality, Alertmanager and k6
plugins report unsupported backend checks; this is not evidence that their
queries fail. No datasource configuration was changed.

## Validation

Live before/after crawler reads confirmed six frames becoming two. Regression
checks cover every Clipify panel's policy, unique logical-series output, metadata
removal, stable color modes, source rotation, counter resets, replica overlap,
actual zeros and stale Twitch observations. The final v8 export passed 618 Flux
query executions across six scenarios and native datasource queries for all 101
panels in disposable Grafana 13.2.3 and InfluxDB 2.9.1. Native browser checks
confirmed the compact 168-pixel presence stats on desktop and mobile. Community
popovers passed eight browser journeys, including light/dark contrast checks.

Grafana's official schema defines the difference between
[index-based and name-based palette modes](https://github.com/grafana/grafana/blob/main/apps/dashboard/kinds/v2/dashboard_spec.cue).
