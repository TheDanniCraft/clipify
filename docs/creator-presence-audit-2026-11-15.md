# Clipify player-presence audit

November 15, 2026. Production reads, source review, an isolated native OBS
reproduction and application/browser tests. Production was not changed by the
audit. This report distinguishes the proposed patch from the remaining limits.

## Findings

“Using Clipify now” counts distinct owners with an authenticated open overlay
socket whose `sourceActive` is explicitly `true`. A zero means no confirmed
active source was observed. It does not establish that nobody is using Clipify,
and must not authorize a server reboot automatically.

The live Grafana v8 panel 702 and its InfluxDB query were current. Between
06:39:02 and 10:04:01 Europe/Berlin, 206 samples per metric showed:

| Metric                        | Minimum | Maximum | Latest |
| ----------------------------- | ------: | ------: | -----: |
| `presence_connectedCreators`  |       0 |       0 |      0 |
| `presence_onlineUsingClipify` |       0 |       0 |      0 |
| `presence_twitchOnline`       |       1 |       7 |      1 |

The exact live query returned zero with a fresh 10:05:01 sample. Twitch snapshots
were also fresh. Old dashboard JSON or a stale last-value fallback therefore did
not explain the flat zero. There is one logical Clipify deployment; changing
container IDs were not treated as separate products or usage totals.

Existing scraped fields do not distinguish disconnected players from connected
players that never reported source activity. Recent container logs did not fill
that gap. The production observations alone do not establish how many real
on-air players are being missed, or prove that the transport migration caused it.

## Source and transport history

The current path is the overlay page's early activity bootstrap, the player’s
secret-authenticated `/ws` subscription, `source_activity` handling, the shared
subscription registry, and the instance-health aggregate. The community combines
confirmed activity with a fresh Twitch-live observation.

Both the modern `obsSourceActiveChanged` event and legacy
`obsstudio.onActiveChange` callback are supported. State starts unknown. Only an
observed boolean can confirm activity. Controllers, closed sockets, preview-only
sources and unobserved sources stay excluded. Multiple active sources belonging
to one creator count once.

WebSocket ping/pong removes unresponsive connections; it does not establish
whether a source is in program output. The server processes each connection's
messages in order and revalidates source access before accepting activity.

Before October 4, community activity used recent Plausible `/overlay/:id` visits.
That could count a browser source loaded in the background. The strict HTTP
presence implementation was committed at 18:15:45Z on October 4, and its
WebSocket replacement at 18:35:54Z. These are source-history timestamps, not
verified production deployment times. The HTTP version used the same OBS events
and already documented the missing initial-active getter. Its periodic reports
could repeat a known state, but could not recover a state OBS never supplied.

[HTTP introduction](https://github.com/TheDanniCraft/clipify/commit/decdc1a3239da8bc68dce3fd8f77407a9e40ec74),
[WebSocket migration](https://github.com/TheDanniCraft/clipify/commit/139c35bdda61e5506696ee001183b8341f2c3303).

## Native reproduction

Real OBS 32.2.0, obs-browser 2.26.9 and CEF 127 ran in a disposable Ubuntu Docker
container under software rendering. It had no external network or published
ports, no personal OBS configuration, cameras or microphones, and no streaming
or recording output. The installed macOS OBS was not launched.

The probe used the actual compiled Clipify activity adapter, owner selector and
health function. Authentication and the Twitch-cache query were synthetic. It
does not replace the separate application test of authentication and routing.
OBS's native `GetSourceActive` control API provided the independent expected
state; that API was available to the isolated test controller, not to the webpage.

| Case                             | Native program-active | Reported state | Count |
| -------------------------------- | --------------------- | -------------- | ----: |
| Load an already-active source    | true                  | unknown        |     0 |
| Keep source loaded off scene     | false                 | false          |     0 |
| Switch source into program       | true                  | true           |     1 |
| Refresh while already active     | true                  | unknown        |     0 |
| Switch off scene again           | false                 | false          |     0 |
| Switch back into program         | true                  | true           |     1 |
| Reconnect WebSocket while active | true                  | true           |     1 |
| Studio Mode preview only         | false                 | false          |     0 |
| Transition preview into program  | true                  | true           |     1 |
| Disable the source eye           | false                 | false          |     0 |
| Enable the source eye            | true                  | true           |     1 |

All native states settled before assertions. Nine cases matched; two reproduce
the initial-state gap. The modern and legacy callbacks both arrived on scene
transitions. This is evidence of missed initial observations, not an event rename.
The final adapter rerun reproduced the same results.

Frozen baseline evidence is `/tmp/clipify-obs-presence-reproduction.tar.gz`.
Final adapter evidence, native logs and source hashes are in
`/tmp/clipify-obs-evidence/run7`; the local probe source is
`/tmp/clipify-obs-probe`. These are local investigation artifacts, not CI evidence.

## Available APIs and limits

A separate native test compared the exact initial getters with OBS's independent
source-active control API. With read-user permission enabled, it produced:

| Source placement | `visibilityState` | `hidden` | `getCurrentScene()`       | Native `videoActive` |
| ---------------- | ----------------- | -------- | ------------------------- | -------------------- |
| In Program       | visible           | false    | Probe Program, 1280 × 900 | true                 |
| Only in Preview  | visible           | false    | Probe Program, 1280 × 900 | false                |

The webpage saw identical initial getter values for opposite program states.
It cannot distinguish these cases without source membership information. At the
tested default status-only permission level (1), `getCurrentScene` returned null;
the scene object required read-user permission (2). Both tests used the same OBS
instance and browser source, without starting any output.

`getStatus` exposes streaming/recording status, not this source's participation.
Playback, audio and Twitch-live status also do not establish whether this source
is being broadcast. Visibility can identify some hidden sources, but promoting a
visible source to active would count Studio Mode previews. A 50ms delay does not
remove that ambiguity. Hardcoded scene names also cannot establish whether a
source in that scene is enabled or hidden.

Getter experiment records are `/tmp/clipify-obs-getters-evidence/getters.json`;
its isolated probe source is `/tmp/clipify-obs-getters-probe`.

OBS's external WebSocket control API can query initial source activity, but users
must configure access and authentication. It is not a zero-setup feature of a
hosted browser source, so it is not added to Clipify's default setup.

| Client             | Evidence and remaining validation                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| OBS Studio         | Native Linux reproduction above; Windows and macOS builds were not runtime-certified.                                                            |
| Streamlabs Desktop | Its OBS/browser fork exposes the same activity event/callback family. Source-reviewed; installed desktop behavior still needs native validation. |
| PRISM              | Its OBS/browser fork uses the same activity family. Source-reviewed; installed desktop behavior still needs native validation.                   |

[OBS browser bindings](https://github.com/obsproject/obs-browser/blob/d4db73e7e5d5b51d853177c8cddc796715a8ac84/browser-app.cpp),
[OBS callback implementation](https://github.com/obsproject/obs-browser/blob/d4db73e7e5d5b51d853177c8cddc796715a8ac84/obs-browser-source.cpp),
[initial-state API limitation](https://github.com/obsproject/obs-browser/issues/255),
[Streamlabs OBS browser reference](https://github.com/streamlabs/obs-studio/blob/streamlabs/.gitmodules),
[PRISM browser fork](https://github.com/naver/obs-browser),
[OBS WebSocket setup](https://obsproject.com/kb/remote-control-guide).

## Patch and verification

The patch moves the passive OBS bootstrap from the overlay body to the document
head, before the overlay page and its client bundle. A real-app regression case
sends an activity event during head parsing and checks that the observation is
retained through hydration and subscription. Events that
precede the document itself remain unobservable; visibility is not used as a
positive fallback. Ordinary browsers do not install OBS listeners.

The patch also repeats the last OBS-confirmed boolean every 25 seconds over the
existing authenticated WebSocket and replays it on every subscription
acknowledgement, including renewal on the same connection. Cleanup stops periodic
reports. This repairs reconciliation without introducing another HTTP presence
system or inferring activity from connection/visibility alone.

A real-app Chromium journey verifies the actual overlay, authenticated socket,
subscription renewal, reconnect, preview exclusion, inactive heartbeat and the
protected instance-health response. The focused unit and embedded-route checks pass 32 tests.
The native reproduction above separately checks actual OBS event delivery.

The master failure was the mobile sidebar polish scenario. The green PR and
failed squash commit had identical source trees. Playwright's row click could
center-scroll the native Sheet out of view and dismiss it. The scenario now
establishes React Aria focus, expands Settings with ArrowRight, and verifies the
expanded state before checking icons, progress and spacing. Existing pointer
navigation remains covered. All 37 owning recovery/sidebar browser scenarios
passed, including desktop/mobile and both themes. No forced clicks, skipped
scenarios, raised timeouts or reduced coverage thresholds are used.

The head-bootstrap follow-up also passes 31 public-page browser scenarios and
both real overlay reporting journeys. The final production test build, lint and
formatting pass locally. Full required
CI remains the merge gate; local/native investigation is not a substitute.

## Remaining restart problem

The cold-load/full-refresh gap is not solved by this patch. Unknown diagnostics
would explain coverage but would not create a useful safe-maintenance window.
No unknown-based Grafana restart gate is added.

The refresh-deferral proposal was withdrawn: it does not solve a host reboot and
can leave an old player dependent on obsolete server actions. Existing deployment
recovery remains unchanged.

With the current standard browser API, exact initial program participation,
zero extra user setup and exclusion of all preview/background sources cannot all
be established at cold load. Zero confirmed activity must not be presented as
proof that a reboot will interrupt nobody.

Kernel maintenance needs a planned interruption or failover to another host. A
second container on the same host cannot cover a host reboot. Connection draining
can help application rollouts, but is not host failover. This patch does not add
failover, reboot automation or a guarantee of uninterrupted maintenance.
