# Data Model: Free Runner and Pro Broadcasting

Use `src/db/schema.ts` as schema source only. No generated files under `drizzle/` are created or edited on this feature branch. Remove the unreleased Runner-only entitlement enum and agency Runner seat columns. Shared grant and allocation tables remain for Pro; never convert a Runner-only record into Pro.

## Runner capabilities (derived, not another subscription table)

`basicAccess=true` for authorized authenticated creators; `runnerPro = effectivePro || activeLegacyRunnerGrant || activeAgencyRunnerAllocation`. `maxActiveBroadcasts=1`, `maxTargets=1`, `scheduling=false`, `customStandby=false`, `attributionRequired=true` on Free; Pro limits are null (no commercial cap), scheduling/custom standby enabled and attribution optional. Monthly usage limit is null for both; no quota/metering tables. Snapshot includes capability revision, evaluatedAt, earliest known paid expiry and source classification, never raw entitlement/customer secrets.

## Existing Runner device

Keep id, ownerId, credential, configurationRevision, health and lastHeartbeat. Add negotiated protocolVersion and capability list/lastAcknowledgedConfigRevision if persisted telemetry needs them. Device health is not proof of broadcasting inactivity. Pro supports multiple devices; one live-fallback source per installation avoids existing fixed-port proxy collisions.

## Stream session / broadcast configuration

Keep existing session id, ownerId, runnerId, overlayId, mode, configurationRevision, desired/actual state, resolution/fps. Add controlMode (`manual|scheduled`), brandingProfileId and automationPausedAt/revision. Keep existing mode enum (`24/7|failsafe`) and translate UI names. One active execution per session; commands reference a generation.

Existing `rtmpUrl` / `encryptedStreamKey` remain as legacy read-through source during transition; new destinations are authoritative once a session is normalized. Normalize legacy scalar target into a single named destination on first authorized mutation, transactionally and idempotently. Do not read and rewrite all production rows from planning scripts.

## Destination and selection

`runner_destinations`: id, ownerId, optional runnerId (visible scope), name (1–80 characters), provider (`youtube|twitch|custom`), rtmpUrl, encryptedStreamKey, credentialRevision, configurationRevision, createdAt, updatedAt. Validate RTMP/RTMPS scheme and destination syntax; no browser-supplied owner. Custom targets may deliberately use local/private addresses on the user's PC; do not server-fetch the URL or forward the server's network to it. No full URL-with-key in output/logs.

`stream_session_destinations`: sessionId, destinationId, ownerId, position; unique session+destination. Ordered selection IDs are presentation only; compare normalized sets for adjacency. Deny cross-owner selection; enforce Free target count at save and admission. Limit name/payload/URL sizes as input bounds rather than sales caps. Credential removal preserves metadata but blocks starts that require keys.

## Broadcast admission / execution

`runner_broadcast_admissions`: id, ownerId, runnerId reference retained nullable on device deletion, sessionId reference retained nullable on session deletion, executionGeneration (unique scoped attempt), occurrenceId nullable, state (`reserved|starting|active|draining|uncertain|stopped|failed_before_output`), dispatchedAt, startedAt, lastObservedAt, stoppedAt, configurationRevision, benefitsAtStart (safe JSON, including immutable ingestModeAtStart captured from session.mode), scheduledEnd nullable, transition policy, terminalReason. Stable owner/admission/generation remain after device/session unlink or deletion while uncertain.

Transactions lock owner first, then benefits/resource rows in stable ID order. Count nonterminal admissions across all owner devices, including Free standby/live input. Reserve and commit before dispatch; matching retry reuses its admission. Matching output-closed evidence or failed-before-output frees occupancy; for supported leased Free executions only, expiration of the final signed lease plus its bounded drain and safety margin also releases occupancy. Never derive this from `runner.status=offline`. Pro may have multiple rows; on downgrade new admission requires no nonterminal rows and a one-target configuration; existing rows are grandfathered until normal terminal state. Signed permits bind owner, device, session, generation and allowed targets; they cannot authorize a different installation/session.

## Schedule

`runner_schedule_events`: id, ownerId, runnerId, sessionId, title (1–80), timezone (IANA), recurrence (`once|weekly`), localStartDate/localEndDate for once, weekdays for weekly, localStartTime/localEndTime, endDayOffset for weekly, enabled, configurationRevision, createdAt, updatedAt. A separate `runner_schedule_event_destinations` join records selected targets; source is owned overlay/session configuration. One-time absolute execution bounds are derived from timezone-aware local values.

Implementation of immutable weekly identity: `recurrenceAnchor` retains the original local anchor date, and `weekdayAnchors` stores server-owned `{weekday, anchor}` members. Keep matching members on edits; an unambiguous weekday move retains its slot anchor. Removing another weekday never renumbers remaining slots, and changing the first enabled date never resets the original calendar-week epoch. These fields are not accepted from client mutation input.

Use half-open intervals [start,end). Reject zero/negative duration, missing references, invalid timezone and any overlap on one Runner, including adjacent-date/weekly conflicts. All-day windows use local midnight to the next local midnight (23, 24 or 25 elapsed hours). Timed events may cross days and weeks; no 24-hour duration cap. Weekly endDayOffset is 0–7 and each positive occurrence must end no later than its next weekly recurrence. Changing configuration increments revision and replaces future cached occurrences only after persisted save succeeds.

Server generates occurrences over rolling seven-day horizon: eventId, occurrenceId (`eventId + recurrenceAnchor` (independent of configuration revision)), startUtc, endUtc, offset/disambiguation, source revision, target IDs, benefit validity, signature. DST gap at either boundary skips that occurrence with reason; repeated local time picks the first instant. Duplicate occurrence identity is persisted locally to prevent replay. Adjacent equal source/target events can share active execution; retain each occurrence membership so suppression and ending remain correct.

## Branding profile and assets

`runner_branding_profiles`: id, ownerId, runnerId, watermarkCorner (`top_left|top_right|bottom_left|bottom_right`), proShowAttribution, standbyBackgroundColor, logoAssetId nullable, backgroundAssetId nullable, message (max160), showNextBroadcastTime, revision. Defaults: required Free attribution bottom-right, standard standby, safe contrast. Free cannot save Pro appearance through a hidden API. On downgrade retain custom fields but serve baseline appearance until benefits return.

`runner_branding_assets`: id, ownerId, kind (`logo|background`), normalizedMime, sizeBytes, width, height, checksum, bytes (`bytea`), createdAt. Max2MiB each; PNG/JPEG/WebP only; max4096 per axis and max16M pixels. Verify decoding and re-encode stripped raster data. Old asset remains authoritative on invalid or failed replacement; cleanup detached assets after commit. References enforce owner scope. Presentation responses contain cacheable opaque asset IDs/URLs, not private database rows.

## Local persisted state

Under existing `~/.clipify-runner`, protected atomic snapshot and journal files hold negotiated protocol, signed capability/config snapshot, seven-day occurrence cache, revisions, execution/occurrence state, suppression markers and pending terminal acknowledgments. Keys live in OS keyring with existing protected-file fallback; snapshots hold key references. Atomic write-rename must preserve the last valid snapshot on failure. A corrupted/invalid signature disables new scheduled starts with a visible error; ongoing output follows captured admission/transition state. Never log serialized secrets.

States: pending -> starting -> active -> finishing_clip -> completed; or pending -> skipped/failed_before_output. Manual stop suppresses that occurrence. Restart reconciles only an in-window, unsuppressed occurrence; an ended or completed occurrence is never replayed. Known paid expiry blocks new events; an already active event completes its window/drain. Manual paid sessions may run until normal owner stop. Retain records long enough to cover the cached horizon and acknowledged terminal attempts; bounded cleanup must not erase a still-active suppression/admission.

## Amendment fields and state invariants

Admissions additionally persist leaseId, leaseExpiresAt, protocolSupportsLease, revokedAt, terminalCredentialHash and recoveredAt/reason. Tombstone recovery is generation-bound and never extends bearer privileges. Signed cached occurrences include immutable recurrenceAnchor and independent configurationRevision; local journal stores suppressed/resumed/terminal generation and captured active bounds. One-time schedule has explicit localEndDate; weekly uses endDayOffset 0–7. Projection segment IDs are view-only and never persisted as new schedule events. Active records intersecting the cache horizon remain included even when their start lies before it. See reconciled contracts for exact locks, lease timing and DST semantics.

Destination junction references cascade when either owned parent is removed, allowing complete account cleanup without orphaned selection rows. Individual destination deletion is rejected by the authorized owner-locked service with RESOURCE_IN_USE until references are explicitly removed. DEF063 records why immediate RESTRICT and nondeferrable NO ACTION fail nested owner cascades. No direct user-facing raw SQL deletion path exists.

B2 capture detail: admissions store `targetIdsSnapshot` (historical UUID array, no deleting foreign key) and `encryptedTargetsSnapshot` (encrypted versioned JSON including original URLs, keys and destination revisions). Safe benefit JSON contains no credentials. Assigned-device heartbeats alone receive decrypted original targets; edited named records affect future starts. Session reads expose selected IDs and safe configuration, never scalar URLs/ciphertexts. Device/source reassignment is locked until every admission for that session is terminal, preserving Stop routing. Selection order is presentation; signed target hashes use canonical sets.

D3 offline authority uses the existing admission table with a distinct `authorized` state. This records a signed future start capability; it does not mark session desired/actual output Running. The one-physical-execution partial unique index excludes `authorized` while retaining its existing constraint for reserved/starting/active/draining/uncertain executions. Owner occupancy still includes all unclosed future authority. Current-output routing/locking must distinguish a future authorization from an already activated or potentially active occurrence. Fresh cache manifests bind the individual signed authorizations; a matching terminal receipt or bounded official authorization/end-plus-drain recovery releases authority, never heartbeat age. This remains under implementation and is not yet a qualified complete lifecycle.
