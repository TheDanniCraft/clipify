# Creator presence monitoring

The next app release adds aggregate `presence` fields to the existing protected,
uncached `/internal/health/instance` response. Import the complete
`grafana/clipify-vm01-overview-v8.json` after the new fields are being scraped.
V8 keeps all 93 existing panels and adds eight compact presence panels. The
[dashboard-wide series audit](grafana-series-audit.md) also fixes duplicate host
series, unstable colors and misleading activity labels in the existing panels.

| Field                      | Meaning                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `twitchOnline`             | Confirmed live creators in the latest Twitch snapshot                   |
| `twitchOffline`            | Confirmed offline creators, excluding unchecked batches                 |
| `twitchUnknown`            | Creators whose Twitch status was not confirmed                          |
| `twitchSnapshotFresh`      | 1 for a valid observation younger than two minutes; 0 otherwise         |
| `twitchSnapshotAgeSeconds` | Observation age, or null if unavailable                                 |
| `connectedCreators`        | Distinct owners with an open, active OBS source on this server instance |
| `onlineUsingClipify`       | Confirmed live creators among this instance's active source owners      |

Twitch observations reuse the existing background community snapshot, which
covers all enabled creators before public-profile filtering and normally refreshes
once per minute. Failed batches are unknown; they are never counted as confirmed
offline. Old cache formats, invalid snapshots and observations at least two minutes
old return null online/offline/live-with-Clipify values. No new Twitch calls run
on health scrapes. The next refresh replaces old cache formats automatically.

Player presence uses the existing server-side subscription registry. Multiple
sources owned by one creator count once. Controllers, inactive previews, closed
sockets and disconnected sources do not count. An active source does not prove
that a clip is playing or visible to Twitch viewers. This is operational presence,
not a new visitor-tracking mechanism; health exposes no creator IDs or profiles.

Twitch counts are shared observations and must not be summed across replicas.
Current stat panels use the latest scraped instance; historical shared counts use
window maxima. Source counts remain explicitly per-instance because the same
creator can connect to multiple servers. Historical source lines identify their
server, without printing the raw metric or URL labels.

Current stat queries select the newest health sample before checking freshness,
so an older successful observation cannot conceal a current outage. Health samples
older than three minutes are also excluded from current stats. Missing or
stale Twitch values show "Unavailable"; actual zero counts remain zero. Source
counts remain available when Twitch status is unavailable. The unknown count and
snapshot age make partial coverage and stale observations visible.

Community profile popovers use HeroUI status chips matching the existing avatar
outlines: green for Live with Clipify, red for Live on Twitch, neutral for Offline.
Text labels remain visible so color is not the only status cue.

This PR is for the next release. It does not import dashboards or change production
data. No schema changes or generated migrations are needed.
