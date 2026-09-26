# Sentry operational health signals

Clipify keeps high-frequency overlay state in process and publishes one aggregate snapshot per minute. Raw heartbeats, playback positions, queue previews, overlay IDs, owner IDs, clip IDs, and runner IDs are never sent to Sentry.

## Environment behavior

| Environment | Operational metrics            | Operational state logs              | Minute snapshot             |
| ----------- | ------------------------------ | ----------------------------------- | --------------------------- |
| Production  | Sent to Sentry once per minute | Sent to Sentry on state transitions | Not written to the console  |
| Preview     | Not sent                       | Written with `console.info`         | Written with `console.info` |
| Development | Not sent                       | Written with `console.info`         | Written with `console.info` |
| Test        | Not sent                       | Suppressed                          | Returned to tests only      |

Preview detection uses `IS_PREVIEW=true`. Application errors remain governed by the normal Sentry configuration; this gate applies to operational health signals only.

## Published metrics

| Metric                                     | Type         | Attributes                       | Meaning                                                                                     |
| ------------------------------------------ | ------------ | -------------------------------- | ------------------------------------------------------------------------------------------- |
| `clipify.websocket.connections`            | gauge        | `role`                           | Current overlay and controller WebSocket connections                                        |
| `clipify.websocket.subscriptions`          | counter      | `role`, `outcome`                | Accepted subscriptions during the minute                                                    |
| `clipify.websocket.rejections`             | counter      | `reason`                         | Invalid, unauthorized, or timed-out subscriptions                                           |
| `clipify.websocket.disconnects`            | counter      | `role`                           | Closed connections during the minute                                                        |
| `clipify.overlay.eligible`                 | gauge        | —                                | Overlays with a fresh heartbeat, attached player, visible playback, and no pause or standby |
| `clipify.overlay.states`                   | gauge        | `state`                          | Current overlay state: connected, waiting, healthy, recovering, stalled, paused, or standby |
| `clipify.overlay.state_transitions`        | counter      | `from`, `to`                     | Overlay health transitions during the minute                                                |
| `clipify.playback.clip_changes`            | counter      | —                                | Playback advances observed during the minute                                                |
| `clipify.playback.recovery_results`        | counter      | `outcome`                        | Bounded silent-stall recovery outcomes                                                      |
| `clipify.queue.consumers`                  | gauge        | `queue`, `state`                 | Queue owners grouped by viewer/moderator queue and health state                             |
| `clipify.queue.depth`                      | gauge        | `queue`, `state`                 | Queue items grouped by viewer/moderator queue and health state                              |
| `clipify.queue.oldest_age`                 | gauge        | `queue`, `state`                 | Age in seconds of the oldest item in each queue state                                       |
| `clipify.clip_fetch.requests`              | counter      | `outcome`                        | Playback URL results, including cache hits, coalescing, unavailable clips, and failures     |
| `clipify.clip_fetch.sources`               | counter      | `source`, `outcome` or `reason`  | Twitch download API versus GraphQL fallback behavior                                        |
| `clipify.clip_fetch.duration`              | distribution | `outcome`, `aggregation=average` | Per-minute average playback URL resolution latency                                          |
| `clipify.clip_fetch.duration.max`          | gauge        | `outcome`                        | Maximum playback URL resolution latency observed during the minute                          |
| `clipify.auth.callback`                    | counter      | `outcome`                        | OAuth callback results                                                                      |
| `clipify.auth.callback_duration`           | distribution | `outcome`, `aggregation=average` | Per-minute average OAuth callback latency                                                   |
| `clipify.runner.heartbeats`                | counter      | `outcome`                        | Runner heartbeat results                                                                    |
| `clipify.runner.heartbeat_duration`        | distribution | `outcome`, `aggregation=average` | Per-minute average runner heartbeat latency                                                 |
| `clipify.runner.nodes`                     | gauge        | `state`                          | Total and online runner counts                                                              |
| `clipify.runner.streams`                   | gauge        | `state`                          | Total, desired-running, actually-running, and errored stream counts                         |
| `clipify.eventsub.notifications`           | counter      | `subscription_type`              | EventSub notifications processed during the minute                                          |
| `clipify.eventsub.failures`                | counter      | `operation`                      | EventSub processing failures during the minute                                              |
| `clipify.clip_cache.scheduler.runs`        | counter      | `status`                         | Clip-cache scheduler attempts and outcomes                                                  |
| `clipify.clip_cache.scheduler.duration`    | distribution | `aggregation=average`            | Per-minute average scheduler duration                                                       |
| `clipify.clip_cache.scheduler.owner_count` | gauge        | —                                | Owners processed by the latest scheduler run                                                |
| `clipify.health.collection_duration`       | distribution | —                                | Time required to collect and publish the health snapshot                                    |

## State semantics

A queue with no eligible overlay is `dormant`, regardless of its size or age. It can become `stalled` only while a production overlay is connected, has a heartbeat no older than ten seconds, has an attached and visible player, and is neither paused nor in standby. An eligible queue receives a two-minute progress window before it can become stalled. Playback time movement, a clip change, or a falling queue depth counts as progress.

Moderator queues are correlated by broadcaster/owner and require at least one eligible overlay for that owner. Viewer queues are correlated directly with their overlay.

## Suggested first monitors

- Overlay playback: `clipify.overlay.states{state:stalled} > 0` for two consecutive evaluation windows.
- Queue consumption: `clipify.queue.depth{state:stalled} > 0` for two consecutive evaluation windows. Do not alert on dormant depth or age.
- Authentication: alert on a sustained failure ratio derived from `clipify.auth.callback`, excluding missing-code and missing-state traffic if desired.
- Clip playback URLs: alert on a sustained increase in `unavailable` or `failed` outcomes relative to successful requests.
- Runners: alert when desired-running streams exceed actually-running streams for multiple windows, or errored streams remain above zero.
- EventSub: alert when `clipify.eventsub.failures` is non-zero across multiple windows.
- Clip cache: retain the existing `clip-cache-scheduler` Cron monitor and use the metrics for throughput and latency context.

Start with notification-only thresholds and tune them from production baselines before connecting them to an external status page.
