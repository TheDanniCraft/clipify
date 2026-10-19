# Feature Specification: Free Runner and Pro Broadcasting

**Feature Branch**: `plan/free-runner-branding`

**Created**: 2026-10-14

**Status**: Scope confirmed for technical planning; implementation not started

**Input**: Make self-hosted Runner free with manual single-destination broadcasting and Clipify attribution. Pro adds concurrent broadcasts, simultaneous destinations, scheduling and standby branding.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Free manual broadcasting (Priority: P1)

Creators can register several devices and manually broadcast to one destination at a time, with Clipify attribution on generated content.

**Why this priority**: Deliver the agreed access and upgrade value without disrupting existing broadcasts.

**BDD**: Required. **ATDD**: Required.

**Independent Test**: Exercise this story against its scenario set below without requiring unrelated stories.

**Acceptance Scenarios**:

- **FR-001**: Given an authenticated Free creator, when they register a second device, then both devices remain registered without a purchase.
- **FR-002**: Given a Free owner with one active clip broadcast, when they start live fallback on another device, then the second start is rejected with an explanation and the first broadcast continues.
- **FR-003**: Given a Pro operator managing a Free owner runner with valid control permission, when they attempt a second owner broadcast, then the Free owner limit still applies.
- **FR-004**: Given a manual broadcast playing a clip, when the owner requests stop, then the clip completes and no next clip starts.
- **FR-005**: Given a Free owner configuring a runner, when they select Live fallback, then manual live forwarding and automatic fallback are available without scheduling.

### User Story 2 - Pro multistreaming (Priority: P1)

Creators can send the same broadcast to several destinations and run independent broadcasts across their devices.

**Why this priority**: Deliver the agreed access and upgrade value without disrupting existing broadcasts.

**BDD**: Required. **ATDD**: Required.

**Independent Test**: Exercise this story against its scenario set below without requiring unrelated stories.

**Acceptance Scenarios**:

- **FR-006**: Given a Pro owner with saved destinations, when they select YouTube and Twitch and start playback, then the same content is broadcast to both at the same time.
- **FR-007**: Given a Pro owner broadcasting on one device, when they start an independent broadcast on another, then both broadcasts run.
- **FR-008**: Given a Pro broadcast with two connected outputs, when one destination disconnects, then the other continues and the failed destination shows retrying status.
- **FR-009**: Given a saved destination with a protected stream key, when the creator reopens its editor, then the stored key is masked and replacement and clear actions are available.

### User Story 3 - Scheduled clip playback (Priority: P2)

Creators can build a weekly schedule and let their local Runner start broadcasts and stop after the final playing clip.

**Why this priority**: Deliver the agreed access and upgrade value without disrupting existing broadcasts.

**BDD**: Required. **ATDD**: Required.

**Independent Test**: Exercise this story against its scenario set below without requiring unrelated stories.

**Acceptance Scenarios**:

- **FR-010**: Given a Pro owner viewing the week planner, when they create a broadcast from 18:00 to 20:00, then the event appears with editable times and equivalent form controls.
- **FR-011**: Given a Pro owner editing a weekly broadcast, when they save its timezone source and destinations and reload, then all choices are preserved.
- **FR-012**: Given a running local Runner with a cached event, when the control connection disconnects before its start, then the event starts locally and its end is still honored.
- **FR-013**: Given a scheduled broadcast ending at 22:00 with a clip ending at 22:01, when the clock reaches 22:00, then the clip completes at 22:01 and then outputs stop.
- **FR-014**: Given two adjacent events using different destinations, when the first event reaches its end mid-clip, then the next starts after clip completion only if its window remains active.
- **FR-015**: Given a Runner restarted halfway through a scheduled event, when it restores cached schedules, then it resumes the remaining window once.

### User Story 4 - Branding and standby (Priority: P2)

Creators can preview Clipify attribution; Pro creators can remove it and customize the standby screen.

**Why this priority**: Deliver the agreed access and upgrade value without disrupting existing broadcasts.

**BDD**: Required. **ATDD**: Required.

**Independent Test**: Exercise this story against its scenario set below without requiring unrelated stories.

**Acceptance Scenarios**:

- **FR-016**: Given a Free live fallback broadcast, when live input disconnects then returns, then Clipify-generated fallback is watermarked and returning live video is unwatermarked.
- **FR-017**: Given a Free creator choosing watermark placement, when they choose top-left, then preview and generated broadcast use the readable top-left watermark.
- **FR-018**: Given a Pro creator previewing playback, when they choose branding off, then preview and generated content omit attribution.
- **FR-019**: Given a Pro creator with a customized standby screen, when an active broadcast has no playable clips, then their configured standby is shown.

### User Story 5 - Clear plans and entitlement transitions (Priority: P1)

Creators see Runner included in Free and the additional Pro benefits, with existing grants and downgrade behavior preserved explicitly.

**Why this priority**: Deliver the agreed access and upgrade value without disrupting existing broadcasts.

**BDD**: Required. **ATDD**: Required.

**Independent Test**: Exercise this story against its scenario set below without requiring unrelated stories.

**Acceptance Scenarios**:

- **FR-020**: Given a creator viewing pricing and checkout, when they choose Runner, then Runner is described as included and no standalone Runner purchase is offered.
- **FR-021**: Given a creator with effective Pro through a valid Pro grant, when they schedule a broadcast, then advanced Runner functionality is available. Retired Runner-only grants never confer Pro capabilities.
- **FR-022**: Given a scheduled Pro broadcast active at entitlement expiry, when the entitlement expires, then it completes its current window gracefully and future paid starts are disabled.

### Edge Cases

- **EC-001 — Concurrent Free start requests**: Given two devices belonging to one Free owner, when both request start concurrently, then exactly one broadcast starts and the other receives the limit error.
- **EC-002 — Disconnected device and stale active state**: Given a Free broadcast whose Runner loses its control connection but continues sending video, when another device requests start, then the active slot is not silently released and the user sees recovery guidance.
- **EC-003 — Denied operation**: Given an operator without Runner control permission, when they start edit or stop the runner, then the operation is rejected without changing the broadcast.
- **EC-004 — Invalid or duplicate target**: Given a creator editing destination choices, when they enter an invalid URL a required empty key or the same target twice, then validation blocks saving or starting and preserves existing valid settings.
- **EC-005 — All outputs fail**: Given a broadcast whose every destination is unavailable, when retries cannot connect, then failed status is visible and healthy retry behavior does not create duplicate outputs.
- **EC-006 — Invalid schedule**: Given an event with end before start or a missing source destination or timezone, when the creator saves it, then a specific validation error appears and no event is activated.
- **EC-007 — DST gap**: Given a weekly event at a nonexistent spring-forward local time, when that occurrence is evaluated, then it is skipped with a visible explanation and later occurrences retain their local time.
- **EC-008 — DST repetition**: Given a weekly event at a repeated fall-back local time, when that date is evaluated, then the event runs once at the first occurrence.
- **EC-009 — Clip never completes**: Given a scheduled event ending during stuck playback, when no playback progress occurs for 60 seconds after end or playback exceeds five minutes after end, then the Runner stops safely and reports the playback timeout.
- **EC-010 — Manual override**: Given an active scheduled event, when the owner stops it or pauses automation, then the event is not automatically restarted for that occurrence.
- **EC-011 — Schedule persistence failure**: Given an existing saved event, when a changed event fails to save, then the UI reports failure and the previous saved event remains authoritative.
- **EC-012 — Invalid branding upload**: Given a Pro creator editing standby branding, when an unsupported oversized or unreadable image is supplied, then validation preserves the existing screen and explains the failure.
- **EC-013 — Downgrade with several active broadcasts**: Given a Pro owner with several broadcasts, when Pro expires, then existing broadcasts drain under the transition rule and no new broadcast starts until Free limits can be satisfied.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow authenticated Free and Pro creators to register multiple Runner devices without purchasing an add-on.
- **FR-002**: System MUST limit Free owners to one active broadcast across all owned devices and one output destination for that broadcast. Apply the same limit to clip playback and live fallback, including standby.
- **FR-003**: System MUST authorize Runner operations using resource ownership and team permissions; derive benefits and concurrency from the resource owner rather than the operator.
- **FR-004**: System MUST allow manual start and graceful stop; retain a separate explicit Stop now action for immediate interruption.
- **FR-005**: System MUST name behaviors Clip playback and Live fallback; offer Manual or Scheduled control for Clip playback only. Keep fallback available on Free.
- **FR-006**: System MUST allow Pro owners to save named YouTube, Twitch and custom RTMP destinations and select one or multiple simultaneous destinations per broadcast.
- **FR-007**: System MUST allow Pro owners to run multiple independent broadcasts across registered devices; propose no commercial concurrency cap for this release.
- **FR-008**: System MUST keep healthy outputs running when a destination fails; show per-destination status and retry the failed output without restarting healthy outputs.
- **FR-009**: System MUST protect destination secrets; allow replace and explicit clear, reject invalid destinations and missing required keys, and never reveal stored keys in normal responses, previews or logs.
  Confirmed dashboard deletion may explicitly detach a destination from stopped saved broadcasts in the same owner-locked transaction. Preserve other selected destinations, clear the old endpoint/key when none remain, and require an explicit new selection before Start. Protect active, pending/cached and uncertain executions and schedule references; a failed or stale deletion must leave saved configuration unchanged. Existing callers without explicit detach intent retain reference protection.
- **FR-010**: System MUST provide desktop week-view and mobile day-view create, move, resize and edit interactions plus equivalent keyboard and date/time form/list controls. Display multi-day timed events as segments of one stable logical event.
- **FR-011**: System MUST support one-time and weekly recurring events with explicit timezone, start, end, clip source and one or multiple destinations. Persist edits across reloads. Support explicit end dates across days/weeks; use timezone-aware local boundaries, with no 24-hour cap. Lock an active occurrence against edits/deletion and protect its captured configuration from future-series edits.
- **FR-012**: System MUST execute cached schedules locally while the user PC and Runner are running, including during temporary control-service disconnection. Show offline status and do not imply hosting or PC wake capability.
- **FR-013**: System MUST at scheduled end stop queuing clips, finish the current clip, then close all event outputs; show Finishing current clip and offer no hard-cut preference checkbox.
- **FR-014**: System MUST reject overlapping events on the same Runner; merge adjacent events with identical source and destination set into continuous playback, otherwise begin the next event after the current clip finishes. Never start a delayed event after its window has ended.
- **FR-015**: System MUST after restart resume an event whose window is still active, never replay an ended event, and avoid duplicate starts. Provide pause automation and manual override; manual stop suppresses automatic restart for the current occurrence without changing Scheduled mode. Explicit Resume within that window clears suppression and retains its scheduled end; after the end it is denied. Manual mode requires an explicit user choice.
- **FR-016**: System MUST show logo and two-line Livestream powered / by Clipify.us branding only on Free Runner-generated playback, fallback clips and standby; do not brand incoming live video or ordinary non-Runner overlays.
- **FR-017**: System MUST default attribution to bottom-right; allow all four corners at a fixed 56-pixel two-line text size and 112-pixel logo at 1920x1080, scaled proportionally for output resolution, with fixed translucent styling and collision-aware placement. Free has no hide, size or opacity controls. Preview the actual branded output.
- **FR-018**: System MUST remove required attribution for effective Pro access; optionally allow Pro creators to keep it visible.
- **FR-019**: System MUST allow Pro creators to customize standby logo, background image or color, message and optional next-broadcast time with preview. Show standby only during an active broadcast, never outside scheduled windows.
- **FR-020**: System MUST remove the standalone Runner product from new purchase flows, pricing, checkout, billing controls and onboarding and retire unreleased Runner-only grants, billing configuration and agency Runner seats. Keep Free + Pro names and current prices; update public pricing/features, onboarding/billing copy, llms.txt and llms-full.txt consistently, grouping Runner and broadcasting benefits in the existing comparison.
- **FR-021**: System MUST derive advanced Runner access exclusively from effective Pro, including valid Pro grants, trials and agency creator seats. Remove the standalone Runner entitlement enum and agency Runner seats without converting them into Pro.
- **FR-022**: System MUST on Pro expiry retain settings, disable future scheduled starts, and restore Free branding for generated content. Allow active broadcasts to finish their scheduled window or manual stop without adding targets or new broadcasts. After completion enforce one active broadcast and one destination.

- **FR-023**: System MUST permit unlimited monthly Free broadcast hours; impose no monthly streaming quota or fallback usage multiplier. Free remains limited to one active broadcast and one destination.

### Key Entities

- **Runner device**: Registered user-owned installation and its health/control connection.
- **Broadcast**: Active clip playback or live fallback session, owner, source and outputs.
- **Destination**: Owner-scoped named service or custom RTMP address and protected credential.
- **Schedule event**: Runner, timezone, recurrence, start/end, source, destinations and occurrence state.
- **Branding profile**: Attribution position and Pro standby appearance.
- **Runner benefits**: Effective owner permissions from Free, Pro or scoped legacy grants.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Free creators can register two devices and complete a manual broadcast without a paid purchase; concurrent starts result in exactly one active broadcast.
- **SC-002**: A Pro broadcast delivers the same content to YouTube, Twitch and a custom RTMP receiver simultaneously in the acceptance environment; losing one receiver does not interrupt the others.
- **SC-003**: A cached scheduled event starts within 30 seconds of its start on an awake connected-output Runner; end occurs at the current clip boundary with no next clip queued.
- **SC-004**: All four watermark corners are previewable; live input and ordinary overlays remain unwatermarked; Pro custom standby matches its preview.
- **SC-005**: No new standalone Runner purchase is available; retired Runner-only grants do not confer paid access, while Pro expiry preserves saved configuration.

- **SC-006**: A Free broadcast can continue across month boundaries without a usage-quota warning, forced upgrade or quota-driven stop.

## Assumptions

- Free hours are unlimited at launch as explicitly confirmed by the user. Monthly quotas and weighted fallback metering are outside scope.
- Self-hosted means capture, encoding, scheduling and destination uploads run on the end user's PC. Clipify does not host the Runner or wake a sleeping PC.
- Planning default: Pro has no commercial device, concurrent-broadcast or destination count cap; practical hardware, bandwidth and ordinary service protection still apply. Free limits active broadcasts rather than registered devices.
- The two existing Runner recipients have entitlement grants, not paid Runner subscriptions, as reported by the user. Confirm actual grant/allocation records read-only during technical planning. Do not invent a subscriber migration.
- Existing effective Pro benefits, including valid grants/trials/agency allocations, determine Pro Runner access consistently with other Pro features. Retired Runner-only benefits confer no access beyond Free.
- Watermark removal is branding removal, not a promise to white-label the entire dashboard.
- Adjacent event transition, DST handling, stalled-clip timeout and expiry behavior are proposed defaults for approval. Normal clips always finish; Stop now remains an intentional emergency action.
- Primary measurable goal is adoption and recognition. No unverified promise of adoption uplift or gaming-PC capacity is made.
- Cross-platform output uses a shared compatible stream initially. Per-target resolutions, automatic PC wake, hosted execution and stream-platform metadata management are outside this release.

## Test-First Specification Addendum _(mandatory)_

### Test Classification and Applicability Matrix

All below sources require TDD, BDD and ATDD. Scenario ownership is assigned once; shared behavior/acceptance evidence proves the same externally observable business boundary. No implementation or test execution is claimed here.

| Source ID | Source Type | TDD      | BDD      | ATDD     | Planned evidence                                                                         |
| --------- | ----------- | -------- | -------- | -------- | ---------------------------------------------------------------------------------------- |
| FR-001    | FR          | Required | Required | Required | BDD-US1-FR001; TDD-US1-FR001                                                             |
| FR-002    | FR          | Required | Required | Required | BDD-US1-FR002; TDD-US1-FR002                                                             |
| FR-003    | FR          | Required | Required | Required | BDD-US1-FR003; TDD-US1-FR003                                                             |
| FR-004    | FR          | Required | Required | Required | BDD-US1-FR004; TDD-US1-FR004                                                             |
| FR-005    | FR          | Required | Required | Required | BDD-US1-FR005; TDD-US1-FR005                                                             |
| FR-006    | FR          | Required | Required | Required | BDD-US2-FR006; TDD-US2-FR006                                                             |
| FR-007    | FR          | Required | Required | Required | BDD-US2-FR007; TDD-US2-FR007                                                             |
| FR-008    | FR          | Required | Required | Required | BDD-US2-FR008; TDD-US2-FR008                                                             |
| FR-009    | FR          | Required | Required | Required | BDD-US2-FR009; TDD-US2-FR009                                                             |
| FR-010    | FR          | Required | Required | Required | BDD-US3-FR010; TDD-US3-FR010                                                             |
| FR-011    | FR          | Required | Required | Required | BDD-US3-FR011; TDD-US3-FR011                                                             |
| FR-012    | FR          | Required | Required | Required | BDD-US3-FR012; TDD-US3-FR012                                                             |
| FR-013    | FR          | Required | Required | Required | BDD-US3-FR013; TDD-US3-FR013                                                             |
| FR-014    | FR          | Required | Required | Required | BDD-US3-FR014; TDD-US3-FR014                                                             |
| FR-015    | FR          | Required | Required | Required | BDD-US3-FR015; TDD-US3-FR015                                                             |
| FR-016    | FR          | Required | Required | Required | BDD-US4-FR016; TDD-US4-FR016                                                             |
| FR-017    | FR          | Required | Required | Required | BDD-US4-FR017; TDD-US4-FR017                                                             |
| FR-018    | FR          | Required | Required | Required | BDD-US4-FR018; TDD-US4-FR018                                                             |
| FR-019    | FR          | Required | Required | Required | BDD-US4-FR019; TDD-US4-FR019                                                             |
| FR-020    | FR          | Required | Required | Required | BDD-US5-FR020; TDD-US5-FR020                                                             |
| FR-021    | FR          | Required | Required | Required | BDD-US5-FR021; TDD-US5-FR021                                                             |
| FR-022    | FR          | Required | Required | Required | BDD-US5-FR022; TDD-US5-FR022                                                             |
| EC-001    | EC          | Required | Required | Required | BDD-US1-EC001; TDD-US1-EC001                                                             |
| EC-002    | EC          | Required | Required | Required | BDD-US1-EC002; TDD-US1-EC002                                                             |
| EC-003    | EC          | Required | Required | Required | BDD-US1-EC003; TDD-US1-EC003                                                             |
| EC-004    | EC          | Required | Required | Required | BDD-US2-EC004; TDD-US2-EC004                                                             |
| EC-005    | EC          | Required | Required | Required | BDD-US2-EC005; TDD-US2-EC005                                                             |
| EC-006    | EC          | Required | Required | Required | BDD-US3-EC006; TDD-US3-EC006                                                             |
| EC-007    | EC          | Required | Required | Required | BDD-US3-EC007; TDD-US3-EC007                                                             |
| EC-008    | EC          | Required | Required | Required | BDD-US3-EC008; TDD-US3-EC008                                                             |
| EC-009    | EC          | Required | Required | Required | BDD-US3-EC009; TDD-US3-EC009                                                             |
| EC-010    | EC          | Required | Required | Required | BDD-US3-EC010; TDD-US3-EC010                                                             |
| EC-011    | EC          | Required | Required | Required | BDD-US3-EC011; TDD-US3-EC011                                                             |
| EC-012    | EC          | Required | Required | Required | BDD-US4-EC012; TDD-US4-EC012                                                             |
| EC-013    | EC          | Required | Required | Required | BDD-US5-EC013; TDD-US5-EC013                                                             |
| SC-001    | SC          | Required | Required | Required | ATDD-US1-SC001; TDD-US1-SC001                                                            |
| SC-002    | SC          | Required | Required | Required | ATDD-US2-SC002; TDD-US2-SC002                                                            |
| SC-003    | SC          | Required | Required | Required | ATDD-US3-SC003; TDD-US3-SC003                                                            |
| SC-004    | SC          | Required | Required | Required | ATDD-US4-SC004; TDD-US4-SC004                                                            |
| SC-005    | SC          | Required | Required | Required | ATDD-US5-SC005; TDD-US5-SC005                                                            |
| US1       | User Story  | Required | Required | Required | BDD-US1-FR001, BDD-US1-FR002, BDD-US1-FR003, BDD-US1-FR004, BDD-US1-FR005                |
| US2       | User Story  | Required | Required | Required | BDD-US2-FR006, BDD-US2-FR007, BDD-US2-FR008, BDD-US2-FR009                               |
| US3       | User Story  | Required | Required | Required | BDD-US3-FR010, BDD-US3-FR011, BDD-US3-FR012, BDD-US3-FR013, BDD-US3-FR014, BDD-US3-FR015 |
| US4       | User Story  | Required | Required | Required | BDD-US4-FR016, BDD-US4-FR017, BDD-US4-FR018, BDD-US4-FR019                               |
| US5       | User Story  | Required | Required | Required | BDD-US5-FR020, BDD-US5-FR021, BDD-US5-FR022                                              |

### ATDD Acceptance Evidence and BDD Behavior Evidence

The following concrete scenarios are specification evidence to bind before implementation. SC scenarios provide complete story acceptance; each FR and EC has separate behavior evidence. Scenario IDs attach only to their scenario.

```gherkin
Feature: Free Runner and Pro broadcasting

  @BDD @US1 @FR-001
  @BDD-US1-FR001
  Scenario: FR-001 Allow authenticated Free and Pro creators to register multiple Runner devices without purchasing an add-on.
    Given an authenticated Free creator
    When they register a second device
    Then both devices remain registered without a purchase

  @BDD @US1 @FR-002
  @BDD-US1-FR002
  Scenario: FR-002 Limit Free owners to one active broadcast across all owned devices and one output destination for that broadcast. Apply the same limit to clip playback and live fallback, including standby.
    Given a Free owner with one active clip broadcast
    When they start live fallback on another device
    Then the second start is rejected with an explanation and the first broadcast continues

  @BDD @US1 @FR-003
  @BDD-US1-FR003
  Scenario: FR-003 Authorize Runner operations using resource ownership and team permissions; derive benefits and concurrency from the resource owner rather than the operator.
    Given a Pro operator managing a Free owner runner with valid control permission
    When they attempt a second owner broadcast
    Then the Free owner limit still applies

  @BDD @US1 @FR-004
  @BDD-US1-FR004
  Scenario: FR-004 Allow manual start and graceful stop; retain a separate explicit Stop now action for immediate interruption.
    Given a manual broadcast playing a clip
    When the owner requests stop
    Then the clip completes and no next clip starts

  @BDD @US1 @FR-005
  @BDD-US1-FR005
  Scenario: FR-005 Name behaviors Clip playback and Live fallback; offer Manual or Scheduled control for Clip playback only. Keep fallback available on Free.
    Given a Free owner configuring a runner
    When they select Live fallback
    Then manual live forwarding and automatic fallback are available without scheduling

  @BDD @US2 @FR-006
  @BDD-US2-FR006
  Scenario: FR-006 Allow Pro owners to save named YouTube, Twitch and custom RTMP destinations and select one or multiple simultaneous destinations per broadcast.
    Given a Pro owner with saved destinations
    When they select YouTube and Twitch and start playback
    Then the same content is broadcast to both at the same time

  @BDD @US2 @FR-007
  @BDD-US2-FR007
  Scenario: FR-007 Allow Pro owners to run multiple independent broadcasts across registered devices; propose no commercial concurrency cap for this release.
    Given a Pro owner broadcasting on one device
    When they start an independent broadcast on another
    Then both broadcasts run

  @BDD @US2 @FR-008
  @BDD-US2-FR008
  Scenario: FR-008 Keep healthy outputs running when a destination fails; show per-destination status and retry the failed output without restarting healthy outputs.
    Given a Pro broadcast with two connected outputs
    When one destination disconnects
    Then the other continues and the failed destination shows retrying status

  @BDD @US2 @FR-009
  @BDD-US2-FR009
  Scenario: FR-009 Protect destination secrets; allow replace and explicit clear, reject invalid destinations and missing required keys, and never reveal stored keys in normal responses, previews or logs.
    Given a saved destination with a protected stream key
    When the creator reopens its editor
    Then the stored key is masked and replacement and clear actions are available

  @BDD @US3 @FR-010
  @BDD-US3-FR010
  Scenario: FR-010 Provide week-view create, move, resize and edit interactions plus equivalent keyboard and form/list controls.
    Given a Pro owner viewing the week planner
    When they create a broadcast from 18:00 to 20:00
    Then the event appears with editable times and equivalent form controls

  @BDD @US3 @FR-011
  @BDD-US3-FR011
  Scenario: FR-011 Support one-time and weekly recurring events with explicit timezone, start, end, clip source and one or multiple destinations. Persist edits across reloads.
    Given a Pro owner editing a weekly broadcast
    When they save its timezone source and destinations and reload
    Then all choices are preserved

  @BDD @US3 @FR-012
  @BDD-US3-FR012
  Scenario: FR-012 Execute cached schedules locally while the user PC and Runner are running, including during temporary control-service disconnection. Show offline status and do not imply hosting or PC wake capability.
    Given a running local Runner with a cached event
    When the control connection disconnects before its start
    Then the event starts locally and its end is still honored

  @BDD @US3 @FR-013
  @BDD-US3-FR013
  Scenario: FR-013 At scheduled end stop queuing clips, finish the current clip, then close all event outputs; show Finishing current clip and offer no hard-cut preference checkbox.
    Given a scheduled broadcast ending at 22:00 with a clip ending at 22:01
    When the clock reaches 22:00
    Then the clip completes at 22:01 and then outputs stop

  @BDD @US3 @FR-014
  @BDD-US3-FR014
  Scenario: FR-014 Reject overlapping events on the same Runner; merge adjacent events with identical source and destination set into continuous playback, otherwise begin the next event after the current clip finishes. Never start a delayed event after its window has ended.
    Given two adjacent events using different destinations
    When the first event reaches its end mid-clip
    Then the next starts after clip completion only if its window remains active

  @BDD @US3 @FR-015
  @BDD-US3-FR015
  Scenario: FR-015 After restart resume an event whose window is still active, never replay an ended event, and avoid duplicate starts. Provide pause automation and manual override; manual stop suppresses restart for the current occurrence.
    Given a Runner restarted halfway through a scheduled event
    When it restores cached schedules
    Then it resumes the remaining window once

  @BDD @US4 @FR-016
  @BDD-US4-FR016
  Scenario: FR-016 Show logo and two-line Livestream powered / by Clipify.us branding only on Free Runner-generated playback, fallback clips and standby; do not brand incoming live video or ordinary non-Runner overlays.
    Given a Free live fallback broadcast
    When live input disconnects then returns
    Then Clipify-generated fallback is watermarked and returning live video is unwatermarked

  @BDD @US4 @FR-017
  @BDD-US4-FR017
  Scenario: FR-017 Default attribution to bottom-right; allow all four corners at a fixed readable minimum size without hide or opacity controls. Preview the actual branded output.
    Given a Free creator choosing watermark placement
    When they choose top-left
    Then preview and generated broadcast use the readable top-left watermark

  @BDD @US4 @FR-018
  @BDD-US4-FR018
  Scenario: FR-018 Remove required attribution for effective Pro access; optionally allow Pro creators to keep it visible.
    Given a Pro creator previewing playback
    When they choose branding off
    Then preview and generated content omit attribution

  @BDD @US4 @FR-019
  @BDD-US4-FR019
  Scenario: FR-019 Allow Pro creators to customize standby logo, background image or color, message and optional next-broadcast time with preview. Show standby only during an active broadcast, never outside scheduled windows.
    Given a Pro creator with a customized standby screen
    When an active broadcast has no playable clips
    Then their configured standby is shown

  @BDD @US5 @FR-020
  @BDD-US5-FR020
  Scenario: FR-020 Remove the standalone Runner product from new purchase flows, pricing, checkout, billing controls and onboarding and retire unreleased Runner-only grants, billing configuration and agency Runner seats.
    Given a creator viewing pricing and checkout
    When they choose Runner
    Then Runner is described as included and no standalone Runner purchase is offered

  @BDD @US5 @FR-021
  @BDD-US5-FR021
  Scenario: FR-021 Derive advanced Runner access exclusively from effective Pro; retire standalone Runner-only grants and agency Runner seats without converting them into Pro.
    Given a creator with an active Pro grant
    When they schedule a broadcast
    Then advanced Runner functionality is available through effective Pro

  @BDD @US5 @FR-022
  @BDD-US5-FR022
  Scenario: FR-022 On Pro expiry retain settings, disable future scheduled starts, and restore Free branding for generated content. Allow active broadcasts to finish their scheduled window or manual stop without adding targets or new broadcasts. After completion enforce one active broadcast and one destination.
    Given a scheduled Pro broadcast active at entitlement expiry
    When the entitlement expires
    Then it completes its current window gracefully and future paid starts are disabled

  @BDD @US1 @EC-001
  @BDD-US1-EC001
  Scenario: EC-001 Concurrent Free start requests
    Given two devices belonging to one Free owner
    When both request start concurrently
    Then exactly one broadcast starts and the other receives the limit error

  @BDD @US1 @EC-002
  @BDD-US1-EC002
  Scenario: EC-002 Disconnected device and stale active state
    Given a Free broadcast whose Runner loses its control connection but continues sending video
    When another device requests start
    Then the active slot is not silently released and the user sees recovery guidance

  @BDD @US1 @EC-003
  @BDD-US1-EC003
  Scenario: EC-003 Denied operation
    Given an operator without Runner control permission
    When they start edit or stop the runner
    Then the operation is rejected without changing the broadcast

  @BDD @US2 @EC-004
  @BDD-US2-EC004
  Scenario: EC-004 Invalid or duplicate target
    Given a creator editing destination choices
    When they enter an invalid URL a required empty key or the same target twice
    Then validation blocks saving or starting and preserves existing valid settings

  @BDD @US2 @EC-005
  @BDD-US2-EC005
  Scenario: EC-005 All outputs fail
    Given a broadcast whose every destination is unavailable
    When retries cannot connect
    Then failed status is visible and healthy retry behavior does not create duplicate outputs

  @BDD @US3 @EC-006
  @BDD-US3-EC006
  Scenario: EC-006 Invalid schedule
    Given an event with end before start or a missing source destination or timezone
    When the creator saves it
    Then a specific validation error appears and no event is activated

  @BDD @US3 @EC-007
  @BDD-US3-EC007
  Scenario: EC-007 DST gap
    Given a weekly event at a nonexistent spring-forward local time
    When that occurrence is evaluated
    Then it is skipped with a visible explanation and later occurrences retain their local time

  @BDD @US3 @EC-008
  @BDD-US3-EC008
  Scenario: EC-008 DST repetition
    Given a weekly event at a repeated fall-back local time
    When that date is evaluated
    Then the event runs once at the first occurrence

  @BDD @US3 @EC-009
  @BDD-US3-EC009
  Scenario: EC-009 Clip never completes
    Given a scheduled event ending during stuck playback
    When no playback progress occurs for 60 seconds after end or playback exceeds five minutes after end
    Then the Runner stops safely and reports the playback timeout

  @BDD @US3 @EC-010
  @BDD-US3-EC010
  Scenario: EC-010 Manual override
    Given an active scheduled event
    When the owner stops it or pauses automation
    Then the event is not automatically restarted for that occurrence

  @BDD @US3 @EC-011
  @BDD-US3-EC011
  Scenario: EC-011 Schedule persistence failure
    Given an existing saved event
    When a changed event fails to save
    Then the UI reports failure and the previous saved event remains authoritative

  @BDD @US4 @EC-012
  @BDD-US4-EC012
  Scenario: EC-012 Invalid branding upload
    Given a Pro creator editing standby branding
    When an unsupported oversized or unreadable image is supplied
    Then validation preserves the existing screen and explains the failure

  @BDD @US5 @EC-013
  @BDD-US5-EC013
  Scenario: EC-013 Downgrade with several active broadcasts
    Given a Pro owner with several broadcasts
    When Pro expires
    Then existing broadcasts drain under the transition rule and no new broadcast starts until Free limits can be satisfied

  @ATDD @US1 @SC-001
  @ATDD-US1-SC001
  Scenario: SC-001 Free creators can register two devices and complete a manual broadcast without a paid purchase; concurrent starts result in exactly one active broadcast.
    Given the acceptance setup for US1
    When the complete referenced story scenarios are exercised
    Then free creators can register two devices and complete a manual broadcast without a paid purchase; concurrent starts result in exactly one active broadcast.

  @ATDD @US2 @SC-002
  @ATDD-US2-SC002
  Scenario: SC-002 A Pro broadcast delivers the same content to YouTube, Twitch and a custom RTMP receiver simultaneously in the acceptance environment; losing one receiver does not interrupt the others.
    Given the acceptance setup for US2
    When the complete referenced story scenarios are exercised
    Then a Pro broadcast delivers the same content to YouTube, Twitch and a custom RTMP receiver simultaneously in the acceptance environment; losing one receiver does not interrupt the others.

  @ATDD @US3 @SC-003
  @ATDD-US3-SC003
  Scenario: SC-003 A cached scheduled event starts within 30 seconds of its start on an awake connected-output Runner; end occurs at the current clip boundary with no next clip queued.
    Given the acceptance setup for US3
    When the complete referenced story scenarios are exercised
    Then a cached scheduled event starts within 30 seconds of its start on an awake connected-output Runner; end occurs at the current clip boundary with no next clip queued.

  @ATDD @US4 @SC-004
  @ATDD-US4-SC004
  Scenario: SC-004 All four watermark corners are previewable; live input and ordinary overlays remain unwatermarked; Pro custom standby matches its preview.
    Given the acceptance setup for US4
    When the complete referenced story scenarios are exercised
    Then all four watermark corners are previewable; live input and ordinary overlays remain unwatermarked; Pro custom standby matches its preview.

  @ATDD @US5 @SC-005
  @ATDD-US5-SC005
  Scenario: SC-005 No new standalone Runner purchase is available; retired Runner-only grants do not confer paid access, while Pro expiry preserves saved configuration.
    Given the acceptance setup for US5
    When the complete referenced story scenarios are exercised
    Then no new standalone Runner purchase is available; retired Runner-only grants do not confer paid access, while Pro expiry preserves saved configuration.
```

### TDD Test Inventory _(mandatory)_

| Test ID       | Source ID(s) | Test Level            | Owning suite and planned area                                                  | Intent                                                                                                                                                                                                                                                                                          | Expected Initial Failure                                      |
| ------------- | ------------ | --------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| TDD-US1-FR001 | US1, FR-001  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given an authenticated Free creator; when they register a second device; assert both devices remain registered without a purchase                                                                                                                                                               | Current paid gate, missing capability or incorrect transition |
| TDD-US1-FR002 | US1, FR-002  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Free owner with one active clip broadcast; when they start live fallback on another device; assert the second start is rejected with an explanation and the first broadcast continues                                                                                                   | Current paid gate, missing capability or incorrect transition |
| TDD-US1-FR003 | US1, FR-003  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Pro operator managing a Free owner runner with valid control permission; when they attempt a second owner broadcast; assert the Free owner limit still applies                                                                                                                          | Current paid gate, missing capability or incorrect transition |
| TDD-US1-FR004 | US1, FR-004  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a manual broadcast playing a clip; when the owner requests stop; assert the clip completes and no next clip starts                                                                                                                                                                        | Current paid gate, missing capability or incorrect transition |
| TDD-US1-FR005 | US1, FR-005  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Free owner configuring a runner; when they select Live fallback; assert manual live forwarding and automatic fallback are available without scheduling                                                                                                                                  | Current paid gate, missing capability or incorrect transition |
| TDD-US2-FR006 | US2, FR-006  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Pro owner with saved destinations; when they select YouTube and Twitch and start playback; assert the same content is broadcast to both at the same time                                                                                                                                | Current paid gate, missing capability or incorrect transition |
| TDD-US2-FR007 | US2, FR-007  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Pro owner broadcasting on one device; when they start an independent broadcast on another; assert both broadcasts run                                                                                                                                                                   | Current paid gate, missing capability or incorrect transition |
| TDD-US2-FR008 | US2, FR-008  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Pro broadcast with two connected outputs; when one destination disconnects; assert the other continues and the failed destination shows retrying status                                                                                                                                 | Current paid gate, missing capability or incorrect transition |
| TDD-US2-FR009 | US2, FR-009  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a saved destination with a protected stream key; when the creator reopens its editor; assert the stored key is masked and replacement and clear actions are available                                                                                                                     | Current paid gate, missing capability or incorrect transition |
| TDD-US3-FR010 | US3, FR-010  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Pro owner viewing the week planner; when they create a broadcast from 18:00 to 20:00; assert the event appears with editable times and equivalent form controls                                                                                                                         | Current paid gate, missing capability or incorrect transition |
| TDD-US3-FR011 | US3, FR-011  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Pro owner editing a weekly broadcast; when they save its timezone source and destinations and reload; assert all choices are preserved                                                                                                                                                  | Current paid gate, missing capability or incorrect transition |
| TDD-US3-FR012 | US3, FR-012  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a running local Runner with a cached event; when the control connection disconnects before its start; assert the event starts locally and its end is still honored                                                                                                                        | Current paid gate, missing capability or incorrect transition |
| TDD-US3-FR013 | US3, FR-013  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a scheduled broadcast ending at 22:00 with a clip ending at 22:01; when the clock reaches 22:00; assert the clip completes at 22:01 and then outputs stop                                                                                                                                 | Current paid gate, missing capability or incorrect transition |
| TDD-US3-FR014 | US3, FR-014  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given two adjacent events using different destinations; when the first event reaches its end mid-clip; assert the next starts after clip completion only if its window remains active                                                                                                           | Current paid gate, missing capability or incorrect transition |
| TDD-US3-FR015 | US3, FR-015  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Runner restarted halfway through a scheduled event; when it restores cached schedules; assert it resumes the remaining window once                                                                                                                                                      | Current paid gate, missing capability or incorrect transition |
| TDD-US4-FR016 | US4, FR-016  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Free live fallback broadcast; when live input disconnects then returns; assert Clipify-generated fallback is watermarked and returning live video is unwatermarked                                                                                                                      | Current paid gate, missing capability or incorrect transition |
| TDD-US4-FR017 | US4, FR-017  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Free creator choosing watermark placement; when they choose top-left; assert preview and generated broadcast use the readable top-left watermark                                                                                                                                        | Current paid gate, missing capability or incorrect transition |
| TDD-US4-FR018 | US4, FR-018  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Pro creator previewing playback; when they choose branding off; assert preview and generated content omit attribution                                                                                                                                                                   | Current paid gate, missing capability or incorrect transition |
| TDD-US4-FR019 | US4, FR-019  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Pro creator with a customized standby screen; when an active broadcast has no playable clips; assert their configured standby is shown                                                                                                                                                  | Current paid gate, missing capability or incorrect transition |
| TDD-US5-FR020 | US5, FR-020  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a creator viewing pricing and checkout; when they choose Runner; assert Runner is described as included and no standalone Runner purchase is offered                                                                                                                                      | Current paid gate, missing capability or incorrect transition |
| TDD-US5-FR021 | US5, FR-021  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a creator with an active Pro grant; when they schedule a broadcast; assert advanced Runner functionality is available through effective Pro                                                                                                                                               | Current paid gate, missing capability or incorrect transition |
| TDD-US5-FR022 | US5, FR-022  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a scheduled Pro broadcast active at entitlement expiry; when the entitlement expires; assert it completes its current window gracefully and future paid starts are disabled                                                                                                               | Current paid gate, missing capability or incorrect transition |
| TDD-US1-EC001 | US1, EC-001  | Negative/boundary     | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given two devices belonging to one Free owner; when both request start concurrently; assert exactly one broadcast starts and the other receives the limit error                                                                                                                                 | Current paid gate, missing capability or incorrect transition |
| TDD-US1-EC002 | US1, EC-002  | Negative/boundary     | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Free broadcast whose Runner loses its control connection but continues sending video; when another device requests start; assert the active slot is not silently released and the user sees recovery guidance                                                                           | Current paid gate, missing capability or incorrect transition |
| TDD-US1-EC003 | US1, EC-003  | Negative/boundary     | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given an operator without Runner control permission; when they start edit or stop the runner; assert the operation is rejected without changing the broadcast                                                                                                                                   | Current paid gate, missing capability or incorrect transition |
| TDD-US2-EC004 | US2, EC-004  | Negative/boundary     | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a creator editing destination choices; when they enter an invalid URL a required empty key or the same target twice; assert validation blocks saving or starting and preserves existing valid settings                                                                                    | Current paid gate, missing capability or incorrect transition |
| TDD-US2-EC005 | US2, EC-005  | Negative/boundary     | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a broadcast whose every destination is unavailable; when retries cannot connect; assert failed status is visible and healthy retry behavior does not create duplicate outputs                                                                                                             | Current paid gate, missing capability or incorrect transition |
| TDD-US3-EC006 | US3, EC-006  | Negative/boundary     | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given an event with end before start or a missing source destination or timezone; when the creator saves it; assert a specific validation error appears and no event is activated                                                                                                               | Current paid gate, missing capability or incorrect transition |
| TDD-US3-EC007 | US3, EC-007  | Negative/boundary     | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a weekly event at a nonexistent spring-forward local time; when that occurrence is evaluated; assert it is skipped with a visible explanation and later occurrences retain their local time                                                                                               | Current paid gate, missing capability or incorrect transition |
| TDD-US3-EC008 | US3, EC-008  | Negative/boundary     | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a weekly event at a repeated fall-back local time; when that date is evaluated; assert the event runs once at the first occurrence                                                                                                                                                        | Current paid gate, missing capability or incorrect transition |
| TDD-US3-EC009 | US3, EC-009  | Negative/boundary     | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a scheduled event ending during stuck playback; when no playback progress occurs for 60 seconds after end or playback exceeds five minutes after end; assert the Runner stops safely and reports the playback timeout                                                                     | Current paid gate, missing capability or incorrect transition |
| TDD-US3-EC010 | US3, EC-010  | Negative/boundary     | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given an active scheduled event; when the owner stops it or pauses automation; assert the event is not automatically restarted for that occurrence                                                                                                                                              | Current paid gate, missing capability or incorrect transition |
| TDD-US3-EC011 | US3, EC-011  | Negative/boundary     | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given an existing saved event; when a changed event fails to save; assert the UI reports failure and the previous saved event remains authoritative                                                                                                                                             | Current paid gate, missing capability or incorrect transition |
| TDD-US4-EC012 | US4, EC-012  | Negative/boundary     | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Pro creator editing standby branding; when an unsupported oversized or unreadable image is supplied; assert validation preserves the existing screen and explains the failure                                                                                                           | Current paid gate, missing capability or incorrect transition |
| TDD-US5-EC013 | US5, EC-013  | Negative/boundary     | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given a Pro owner with several broadcasts; when Pro expires; assert existing broadcasts drain under the transition rule and no new broadcast starts until Free limits can be satisfied                                                                                                          | Current paid gate, missing capability or incorrect transition |
| TDD-US1-SC001 | US1, SC-001  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given the acceptance setup for US1; when the complete referenced story scenarios are exercised; assert free creators can register two devices and complete a manual broadcast without a paid purchase; concurrent starts result in exactly one active broadcast.                                | Current paid gate, missing capability or incorrect transition |
| TDD-US2-SC002 | US2, SC-002  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given the acceptance setup for US2; when the complete referenced story scenarios are exercised; assert a Pro broadcast delivers the same content to YouTube, Twitch and a custom RTMP receiver simultaneously in the acceptance environment; losing one receiver does not interrupt the others. | Current paid gate, missing capability or incorrect transition |
| TDD-US3-SC003 | US3, SC-003  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given the acceptance setup for US3; when the complete referenced story scenarios are exercised; assert a cached scheduled event starts within 30 seconds of its start on an awake connected-output Runner; end occurs at the current clip boundary with no next clip queued.                    | Current paid gate, missing capability or incorrect transition |
| TDD-US4-SC004 | US4, SC-004  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given the acceptance setup for US4; when the complete referenced story scenarios are exercised; assert all four watermark corners are previewable; live input and ordinary overlays remain unwatermarked; Pro custom standby matches its preview.                                               | Current paid gate, missing capability or incorrect transition |
| TDD-US5-SC005 | US5, SC-005  | Integration/component | TDD: app Runner/entitlement tests, runner package runtime tests as appropriate | Given the acceptance setup for US5; when the complete referenced story scenarios are exercised; assert no new standalone Runner purchase is available; retired Runner-only grants do not confer paid access, while Pro expiry preserves saved configuration.                                    | Current paid gate, missing capability or incorrect transition |

Additional implementation-level inventory before task execution MUST separately cover: owner/operator authorization; Free absent/one-active slot and concurrent reservation; reservation rollback on failed start; disconnected active-runner reconciliation; effective Free/Pro/trial/agency benefits and rejected retired Runner-only access and expired/revoked grants; manual start/stop/immediate stop; clip/live/standby transitions; all destination types individually and together; credential keep/replace/clear and response/log redaction; per-output connect/failure/retry/stop cleanup; event create/move/resize/edit/delete and persistence failure; recurrence, midnight crossing, timezone changes, DST gap/repetition; local clock evaluation, cache replacement, stale schedule update and restart idempotency; offline-before-start, outage-during-event and ended-window skip; overlap/adjacency and delayed-event expiry; clip-end-before/at/after event end, missing/stalled clip and timeout; manual override reset on next recurrence; attribution in each corner and each generated state; absent attribution on live/non-Runner output; valid/invalid standby assets; entitlement expiry with zero/one/many active sessions; removal of every Runner purchase entry point and removal of unreleased Runner-only commercial configuration. The enumerated option evidence below adds stable inventory rows; technical planning refines paths and contracts in tdd/test-list.md before production changes.

### Scenario Coverage Matrix _(mandatory for BDD/ATDD Required decisions)_

| Scenario ID    | Owning Suite | Evidence Roles | Primary Source | Covered Inputs / Classes                                                                                                                        | Kind              | Interface               | Equivalence rationale                                                                          |
| -------------- | ------------ | -------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| BDD-US1-FR001  | BDD          | BDD, ATDD      | FR-001         | an authenticated Free creator; they register a second device                                                                                    | Positive          | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US1-FR002  | BDD          | BDD, ATDD      | FR-002         | a Free owner with one active clip broadcast; they start live fallback on another device                                                         | Positive          | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US1-FR003  | BDD          | BDD, ATDD      | FR-003         | a Pro operator managing a Free owner runner with valid control permission; they attempt a second owner broadcast                                | Positive          | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US1-FR004  | BDD          | BDD, ATDD      | FR-004         | a manual broadcast playing a clip; the owner requests stop                                                                                      | Positive          | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US1-FR005  | BDD          | BDD, ATDD      | FR-005         | a Free owner configuring a runner; they select Live fallback                                                                                    | Positive          | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US2-FR006  | BDD          | BDD, ATDD      | FR-006         | a Pro owner with saved destinations; they select YouTube and Twitch and start playback                                                          | Positive          | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US2-FR007  | BDD          | BDD, ATDD      | FR-007         | a Pro owner broadcasting on one device; they start an independent broadcast on another                                                          | Positive          | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US2-FR008  | BDD          | BDD, ATDD      | FR-008         | a Pro broadcast with two connected outputs; one destination disconnects                                                                         | Positive          | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US2-FR009  | BDD          | BDD, ATDD      | FR-009         | a saved destination with a protected stream key; the creator reopens its editor                                                                 | Positive          | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US3-FR010  | BDD          | BDD, ATDD      | FR-010         | a Pro owner viewing the week planner; they create a broadcast from 18:00 to 20:00                                                               | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US3-FR011  | BDD          | BDD, ATDD      | FR-011         | a Pro owner editing a weekly broadcast; they save its timezone source and destinations and reload                                               | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US3-FR012  | BDD          | BDD, ATDD      | FR-012         | a running local Runner with a cached event; the control connection disconnects before its start                                                 | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US3-FR013  | BDD          | BDD, ATDD      | FR-013         | a scheduled broadcast ending at 22:00 with a clip ending at 22:01; the clock reaches 22:00                                                      | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US3-FR014  | BDD          | BDD, ATDD      | FR-014         | two adjacent events using different destinations; the first event reaches its end mid-clip                                                      | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US3-FR015  | BDD          | BDD, ATDD      | FR-015         | a Runner restarted halfway through a scheduled event; it restores cached schedules                                                              | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US4-FR016  | BDD          | BDD, ATDD      | FR-016         | a Free live fallback broadcast; live input disconnects then returns                                                                             | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US4-FR017  | BDD          | BDD, ATDD      | FR-017         | a Free creator choosing watermark placement; they choose top-left                                                                               | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US4-FR018  | BDD          | BDD, ATDD      | FR-018         | a Pro creator previewing playback; they choose branding off                                                                                     | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US4-FR019  | BDD          | BDD, ATDD      | FR-019         | a Pro creator with a customized standby screen; an active broadcast has no playable clips                                                       | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US5-FR020  | BDD          | BDD, ATDD      | FR-020         | a creator viewing pricing and checkout; they choose Runner                                                                                      | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US5-FR021  | BDD          | BDD, ATDD      | FR-021         | a creator with an active Pro grant; they schedule a broadcast                                                                                   | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US5-FR022  | BDD          | BDD, ATDD      | FR-022         | a scheduled Pro broadcast active at entitlement expiry; the entitlement expires                                                                 | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US1-EC001  | BDD          | BDD, ATDD      | EC-001         | two devices belonging to one Free owner; both request start concurrently                                                                        | Negative/boundary | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US1-EC002  | BDD          | BDD, ATDD      | EC-002         | a Free broadcast whose Runner loses its control connection but continues sending video; another device requests start                           | Negative/boundary | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US1-EC003  | BDD          | BDD, ATDD      | EC-003         | an operator without Runner control permission; they start edit or stop the runner                                                               | Negative/boundary | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US2-EC004  | BDD          | BDD, ATDD      | EC-004         | a creator editing destination choices; they enter an invalid URL a required empty key or the same target twice                                  | Negative/boundary | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US2-EC005  | BDD          | BDD, ATDD      | EC-005         | a broadcast whose every destination is unavailable; retries cannot connect                                                                      | Negative/boundary | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US3-EC006  | BDD          | BDD, ATDD      | EC-006         | an event with end before start or a missing source destination or timezone; the creator saves it                                                | Negative/boundary | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US3-EC007  | BDD          | BDD, ATDD      | EC-007         | a weekly event at a nonexistent spring-forward local time; that occurrence is evaluated                                                         | Negative/boundary | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US3-EC008  | BDD          | BDD, ATDD      | EC-008         | a weekly event at a repeated fall-back local time; that date is evaluated                                                                       | Negative/boundary | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US3-EC009  | BDD          | BDD, ATDD      | EC-009         | a scheduled event ending during stuck playback; no playback progress occurs for 60 seconds after end or playback exceeds five minutes after end | Negative/boundary | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US3-EC010  | BDD          | BDD, ATDD      | EC-010         | an active scheduled event; the owner stops it or pauses automation                                                                              | Negative/boundary | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US3-EC011  | BDD          | BDD, ATDD      | EC-011         | an existing saved event; a changed event fails to save                                                                                          | Negative/boundary | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US4-EC012  | BDD          | BDD, ATDD      | EC-012         | a Pro creator editing standby branding; an unsupported oversized or unreadable image is supplied                                                | Negative/boundary | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| BDD-US5-EC013  | BDD          | BDD, ATDD      | EC-013         | a Pro owner with several broadcasts; Pro expires                                                                                                | Negative/boundary | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| ATDD-US1-SC001 | ATDD         | BDD, ATDD      | SC-001         | the acceptance setup for US1; the complete referenced story scenarios are exercised                                                             | Positive          | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| ATDD-US2-SC002 | ATDD         | BDD, ATDD      | SC-002         | the acceptance setup for US2; the complete referenced story scenarios are exercised                                                             | Positive          | Runner workflow/runtime | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| ATDD-US3-SC003 | ATDD         | BDD, ATDD      | SC-003         | the acceptance setup for US3; the complete referenced story scenarios are exercised                                                             | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| ATDD-US4-SC004 | ATDD         | BDD, ATDD      | SC-004         | the acceptance setup for US4; the complete referenced story scenarios are exercised                                                             | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |
| ATDD-US5-SC005 | ATDD         | BDD, ATDD      | SC-005         | the acceptance setup for US5; the complete referenced story scenarios are exercised                                                             | Positive          | Browser journey         | The stated observable result is both the behavior example and stakeholder acceptance boundary. |

Required option inventory, expanded in the enumerated evidence below: each destination type singly and the three-target combination; Free/Pro/legacy owners; clip/live/standby states; four corners; one-time/weekly recurrence; create/move/resize/edit via pointer and form/keyboard; background color/image and optional logo/message/next-time; invalid address/key, denied role, upload and persistence failures individually. Enumerate all these examples; no sampling strategy is approved. MCP workflow scenarios have one workflow owner; browser journeys remain browser-owned. Canonical artifact routing and expanded scenario rows will be recorded in test-traceability.md by technical planning.

### Specification Traceability Inputs

All US/FR/SC/EC sources above map to named planned evidence. TDD and executable scenario expansion precede implementation; a Red/Green/Refactor record is mandatory. All affected suites, browser scenarios, full coverage, lint, formatting, types and build are mandatory before merge. Tests use disposable local databases. Schema edits are allowed on this feature branch; generated migrations remain owned by the post-merge Generate Migrations workflow.

### Enumerated Option and Boundary Evidence

All examples below are required; no sampling is used. Each planned BDD-owned artifact also supplies ATDD evidence because the same observed result is the stakeholder acceptance boundary.

```gherkin
Feature: Runner supported options and boundaries

  @BDD @US1 @FR-001
  @BDD-US1-OPT001
  Scenario: Required option 001
    Given an owner with Free access
    When they register a Runner
    Then registration succeeds without a Runner purchase

  @BDD @US1 @FR-001
  @BDD-US1-OPT002
  Scenario: Required option 002
    Given an owner with Pro access
    When they register a Runner
    Then registration succeeds without a Runner purchase

  @BDD @US1 @FR-001
  @BDD-US1-OPT003
  Scenario: Required option 003
    Given an owner with an active Pro grant
    When they register a Runner
    Then registration succeeds without a Runner purchase

  @BDD @US1 @FR-001
  @BDD-US1-OPT004
  Scenario: Required option 004
    Given an owner with an active agency creator Pro allocation
    When they register a Runner
    Then registration succeeds without a Runner purchase

  @BDD @US1 @FR-001
  @BDD-US1-OPT005
  Scenario: Required option 005
    Given an owner with active Pro trial access
    When they register a Runner
    Then registration succeeds without a Runner purchase

  @BDD @US1 @FR-002
  @BDD-US1-OPT006
  Scenario: Required option 006
    Given a Free owner already broadcasting in Clip playback
    When a second device requests start
    Then the request is rejected and the existing output continues

  @BDD @US1 @FR-002
  @BDD-US1-OPT007
  Scenario: Required option 007
    Given a Free owner already broadcasting in Live fallback forwarding live input
    When a second device requests start
    Then the request is rejected and the existing output continues

  @BDD @US1 @FR-002
  @BDD-US1-OPT008
  Scenario: Required option 008
    Given a Free owner already broadcasting in Live fallback playing clips
    When a second device requests start
    Then the request is rejected and the existing output continues

  @BDD @US1 @FR-002
  @BDD-US1-OPT009
  Scenario: Required option 009
    Given a Free owner already broadcasting in Live fallback showing standby
    When a second device requests start
    Then the request is rejected and the existing output continues

  @BDD @US2 @FR-006
  @BDD-US2-OPT010
  Scenario: Required option 010
    Given a Pro owner selecting only YouTube
    When they start their broadcast
    Then the selected YouTube destination receives the content

  @BDD @US2 @FR-006
  @BDD-US2-OPT011
  Scenario: Required option 011
    Given a Pro owner selecting only Twitch
    When they start their broadcast
    Then the selected Twitch destination receives the content

  @BDD @US2 @FR-006
  @BDD-US2-OPT012
  Scenario: Required option 012
    Given a Pro owner selecting only custom RTMP
    When they start their broadcast
    Then the selected custom RTMP destination receives the content

  @BDD @US2 @FR-009
  @BDD-US2-OPT013
  Scenario: Required option 013
    Given a creator with previously valid destination settings
    When they submit a invalid RTMP address
    Then the invalid submission is rejected and previous settings and protected keys remain unchanged

  @BDD @US2 @FR-009
  @BDD-US2-OPT014
  Scenario: Required option 014
    Given a creator with previously valid destination settings
    When they submit a missing required YouTube key
    Then the invalid submission is rejected and previous settings and protected keys remain unchanged

  @BDD @US2 @FR-009
  @BDD-US2-OPT015
  Scenario: Required option 015
    Given a creator with previously valid destination settings
    When they submit a missing required Twitch key
    Then the invalid submission is rejected and previous settings and protected keys remain unchanged

  @BDD @US2 @FR-009
  @BDD-US2-OPT016
  Scenario: Required option 016
    Given a creator with previously valid destination settings
    When they submit a duplicate destination
    Then the invalid submission is rejected and previous settings and protected keys remain unchanged

  @BDD @US2 @FR-009
  @BDD-US2-OPT017
  Scenario: Required option 017
    Given a destination with a stored key
    When the authorized creator chooses keep
    Then the original protected credential remains

  @BDD @US2 @FR-009
  @BDD-US2-OPT018
  Scenario: Required option 018
    Given a destination with a stored key
    When the authorized creator chooses replace
    Then the new protected credential replaces the old one

  @BDD @US2 @FR-009
  @BDD-US2-OPT019
  Scenario: Required option 019
    Given a destination with a stored key
    When the authorized creator chooses clear
    Then the credential is removed and targets requiring a key cannot start

  @BDD @US3 @FR-010
  @BDD-US3-OPT020
  Scenario: Required option 020
    Given a Pro owner with a valid week schedule
    When they create an event using pointer planner
    Then the create operation persists and the visible schedule reflects it

  @BDD @US3 @FR-010
  @BDD-US3-OPT021
  Scenario: Required option 021
    Given a Pro owner with a valid week schedule
    When they create an event using keyboard and form/list controls
    Then the create operation persists and the visible schedule reflects it

  @BDD @US3 @FR-010
  @BDD-US3-OPT022
  Scenario: Required option 022
    Given a Pro owner with a valid week schedule
    When they move an event using pointer planner
    Then the move operation persists and the visible schedule reflects it

  @BDD @US3 @FR-010
  @BDD-US3-OPT023
  Scenario: Required option 023
    Given a Pro owner with a valid week schedule
    When they move an event using keyboard and form/list controls
    Then the move operation persists and the visible schedule reflects it

  @BDD @US3 @FR-010
  @BDD-US3-OPT024
  Scenario: Required option 024
    Given a Pro owner with a valid week schedule
    When they resize an event using pointer planner
    Then the resize operation persists and the visible schedule reflects it

  @BDD @US3 @FR-010
  @BDD-US3-OPT025
  Scenario: Required option 025
    Given a Pro owner with a valid week schedule
    When they resize an event using keyboard and form/list controls
    Then the resize operation persists and the visible schedule reflects it

  @BDD @US3 @FR-010
  @BDD-US3-OPT026
  Scenario: Required option 026
    Given a Pro owner with a valid week schedule
    When they edit an event using pointer planner
    Then the edit operation persists and the visible schedule reflects it

  @BDD @US3 @FR-010
  @BDD-US3-OPT027
  Scenario: Required option 027
    Given a Pro owner with a valid week schedule
    When they edit an event using keyboard and form/list controls
    Then the edit operation persists and the visible schedule reflects it

  @BDD @US3 @FR-010
  @BDD-US3-OPT028
  Scenario: Required option 028
    Given a Pro owner with a valid week schedule
    When they delete an event using pointer planner
    Then the delete operation persists and the visible schedule reflects it

  @BDD @US3 @FR-010
  @BDD-US3-OPT029
  Scenario: Required option 029
    Given a Pro owner with a valid week schedule
    When they delete an event using keyboard and form/list controls
    Then the delete operation persists and the visible schedule reflects it

  @BDD @US3 @FR-011
  @BDD-US3-OPT030
  Scenario: Required option 030
    Given a saved one-time event with timezone source and selected destinations
    When the owner reloads and the event becomes due
    Then its choices persist and it runs at the intended occurrence

  @BDD @US3 @FR-011
  @BDD-US3-OPT031
  Scenario: Required option 031
    Given a saved weekly event with timezone source and selected destinations
    When the owner reloads and the event becomes due
    Then its choices persist and it runs at the intended occurrence

  @BDD @US3 @FR-011
  @BDD-US3-OPT032
  Scenario: Required option 032
    Given an existing valid schedule
    When the creator submits an event with end before start
    Then saving is rejected with an explanation and the previous schedule remains authoritative

  @BDD @US3 @FR-011
  @BDD-US3-OPT033
  Scenario: Required option 033
    Given an existing valid schedule
    When the creator submits an event with end equal to start
    Then saving is rejected with an explanation and the previous schedule remains authoritative

  @BDD @US3 @FR-011
  @BDD-US3-OPT034
  Scenario: Required option 034
    Given an existing valid schedule
    When the creator submits an event with missing source
    Then saving is rejected with an explanation and the previous schedule remains authoritative

  @BDD @US3 @FR-011
  @BDD-US3-OPT035
  Scenario: Required option 035
    Given an existing valid schedule
    When the creator submits an event with missing destination
    Then saving is rejected with an explanation and the previous schedule remains authoritative

  @BDD @US3 @FR-011
  @BDD-US3-OPT036
  Scenario: Required option 036
    Given an existing valid schedule
    When the creator submits an event with invalid timezone
    Then saving is rejected with an explanation and the previous schedule remains authoritative

  @BDD @US3 @FR-014
  @BDD-US3-OPT037
  Scenario: Required option 037
    Given an existing valid schedule
    When the creator submits an event with overlap with an existing event
    Then saving is rejected with an explanation and the previous schedule remains authoritative

  @BDD @US3 @FR-013
  @BDD-US3-OPT038
  Scenario: Required option 038
    Given an event where clip ends before scheduled end
    When the end boundary is evaluated
    Then another clip may start before the event end

  @BDD @US3 @FR-013
  @BDD-US3-OPT039
  Scenario: Required option 039
    Given an event where clip ends exactly at scheduled end
    When the end boundary is evaluated
    Then the broadcast stops without starting another clip

  @BDD @US3 @FR-013
  @BDD-US3-OPT040
  Scenario: Required option 040
    Given an event where clip ends after scheduled end
    When the end boundary is evaluated
    Then the broadcast stops at that clip end without starting another clip

  @BDD @US3 @FR-013
  @BDD-US3-OPT041
  Scenario: Required option 041
    Given an event where no clip is playing at scheduled end
    When the end boundary is evaluated
    Then the broadcast stops at scheduled end

  @BDD @US3 @FR-015
  @BDD-US3-OPT042
  Scenario: Required option 042
    Given Runner was offline before an event and returns within its window
    When the Runner reconciles its event state
    Then the remaining window starts once

  @BDD @US3 @FR-015
  @BDD-US3-OPT043
  Scenario: Required option 043
    Given Runner returns after an event has ended
    When the Runner reconciles its event state
    Then that event is skipped

  @BDD @US3 @FR-015
  @BDD-US3-OPT044
  Scenario: Required option 044
    Given control connection fails during a cached event
    When the Runner reconciles its event state
    Then local playback and end handling continue

  @BDD @US3 @FR-015
  @BDD-US3-OPT045
  Scenario: Required option 045
    Given Runner restarts while a scheduled event is active
    When the Runner reconciles its event state
    Then the remaining window resumes once

  @BDD @US3 @FR-014
  @BDD-US3-OPT046
  Scenario: Required option 046
    Given adjacent events with identical source and destinations
    When the first event ends during a clip
    Then playback remains continuous without reconnecting

  @BDD @US3 @FR-014
  @BDD-US3-OPT047
  Scenario: Required option 047
    Given adjacent events with different source
    When the first event ends during a clip
    Then the next source starts after clip completion if its window is active

  @BDD @US3 @FR-014
  @BDD-US3-OPT048
  Scenario: Required option 048
    Given adjacent events with different destinations
    When the first event ends during a clip
    Then the next target set starts after clip completion if its window is active

  @BDD @US3 @FR-014
  @BDD-US3-OPT049
  Scenario: Required option 049
    Given adjacent events with next event already ended during overrun
    When the first event ends during a clip
    Then the expired event is skipped

  @BDD @US4 @FR-017
  @BDD-US4-OPT050
  Scenario: Required option 050
    Given a Free owner with a Runner preview
    When they choose top-left
    Then preview and generated output show the readable logo and two-line watermark at top-left

  @BDD @US4 @FR-017
  @BDD-US4-OPT051
  Scenario: Required option 051
    Given a Free owner with a Runner preview
    When they choose top-right
    Then preview and generated output show the readable logo and two-line watermark at top-right

  @BDD @US4 @FR-017
  @BDD-US4-OPT052
  Scenario: Required option 052
    Given a Free owner with a Runner preview
    When they choose bottom-left
    Then preview and generated output show the readable logo and two-line watermark at bottom-left

  @BDD @US4 @FR-017
  @BDD-US4-OPT053
  Scenario: Required option 053
    Given a Free owner with a Runner preview
    When they choose bottom-right
    Then preview and generated output show the readable logo and two-line watermark at bottom-right

  @BDD @US4 @FR-016
  @BDD-US4-OPT054
  Scenario: Required option 054
    Given a Free owner displaying clip playback
    When the output is observed
    Then the Clipify watermark is present

  @BDD @US4 @FR-016
  @BDD-US4-OPT055
  Scenario: Required option 055
    Given a Free owner displaying fallback clips
    When the output is observed
    Then the Clipify watermark is present

  @BDD @US4 @FR-016
  @BDD-US4-OPT056
  Scenario: Required option 056
    Given a Free owner displaying standby
    When the output is observed
    Then the Clipify watermark is present

  @BDD @US4 @FR-016
  @BDD-US4-OPT057
  Scenario: Required option 057
    Given a Free owner displaying incoming live video
    When the output is observed
    Then the Clipify watermark is absent

  @BDD @US4 @FR-016
  @BDD-US4-OPT058
  Scenario: Required option 058
    Given a Free owner displaying ordinary non-Runner overlay
    When the output is observed
    Then the Clipify watermark is absent

  @BDD @US4 @FR-019
  @BDD-US4-OPT059
  Scenario: Required option 059
    Given a Pro owner editing standby
    When they configure background color and preview then activate standby
    Then the configured appearance matches preview during the active broadcast

  @BDD @US4 @FR-019
  @BDD-US4-OPT060
  Scenario: Required option 060
    Given a Pro owner editing standby
    When they configure background image and preview then activate standby
    Then the configured appearance matches preview during the active broadcast

  @BDD @US4 @FR-019
  @BDD-US4-OPT061
  Scenario: Required option 061
    Given a Pro owner editing standby
    When they configure custom logo and preview then activate standby
    Then the configured appearance matches preview during the active broadcast

  @BDD @US4 @FR-019
  @BDD-US4-OPT062
  Scenario: Required option 062
    Given a Pro owner editing standby
    When they configure custom message and preview then activate standby
    Then the configured appearance matches preview during the active broadcast

  @BDD @US4 @FR-019
  @BDD-US4-OPT063
  Scenario: Required option 063
    Given a Pro owner editing standby
    When they configure next-broadcast time and preview then activate standby
    Then the configured appearance matches preview during the active broadcast

  @BDD @US5 @FR-020
  @BDD-US5-OPT064
  Scenario: Required option 064
    Given a creator at public pricing
    When they inspect or attempt the standalone Runner purchase
    Then no new Runner product can be purchased and included Free access is clear

  @BDD @US5 @FR-020
  @BDD-US5-OPT065
  Scenario: Required option 065
    Given a creator at checkout entry point
    When they inspect or attempt the standalone Runner purchase
    Then no new Runner product can be purchased and included Free access is clear

  @BDD @US5 @FR-020
  @BDD-US5-OPT066
  Scenario: Required option 066
    Given a creator at billing controls
    When they inspect or attempt the standalone Runner purchase
    Then no new Runner product can be purchased and included Free access is clear

  @BDD @US5 @FR-020
  @BDD-US5-OPT067
  Scenario: Required option 067
    Given a creator at Runner onboarding
    When they inspect or attempt the standalone Runner purchase
    Then no new Runner product can be purchased and included Free access is clear

  @BDD @US5 @FR-021
  @BDD-US5-OPT068
  Scenario: Required option 068
    Given an owner with an active Pro grant
    When they request a Pro Runner capability
    Then the capability is available through effective Pro

  @BDD @US5 @FR-021
  @BDD-US5-OPT069
  Scenario: Required option 069
    Given an owner with an expired Pro grant
    When they request a Pro Runner capability
    Then the capability is denied without unrelated Pro access

  @BDD @US5 @FR-021
  @BDD-US5-OPT070
  Scenario: Required option 070
    Given an owner with a revoked Pro grant
    When they request a Pro Runner capability
    Then the capability is denied without unrelated Pro access

  @BDD @US5 @FR-021
  @BDD-US5-OPT071
  Scenario: Required option 071
    Given an owner with an active agency creator Pro allocation
    When they request a Pro Runner capability
    Then the capability is available through effective Pro

  @BDD @US5 @FR-021
  @BDD-US5-OPT072
  Scenario: Required option 072
    Given an owner with an ended agency creator Pro allocation
    When they request a Pro Runner capability
    Then the capability is denied without unrelated Pro access

  @BDD @US5 @FR-022
  @BDD-US5-OPT073
  Scenario: Required option 073
    Given a Pro owner with 0 active broadcasts and saved paid settings
    When their Pro entitlement expires
    Then configuration remains saved and new paid starts are disabled; existing sessions finish under the transition rule

  @BDD @US5 @FR-022
  @BDD-US5-OPT074
  Scenario: Required option 074
    Given a Pro owner with 1 active broadcasts and saved paid settings
    When their Pro entitlement expires
    Then configuration remains saved and new paid starts are disabled; existing sessions finish under the transition rule

  @BDD @US5 @FR-022
  @BDD-US5-OPT075
  Scenario: Required option 075
    Given a Pro owner with 2 active broadcasts and saved paid settings
    When their Pro entitlement expires
    Then configuration remains saved and new paid starts are disabled; existing sessions finish under the transition rule

  @BDD @US3 @FR-013
  @BDD-US3-OPT076
  Scenario: Required option 076
    Given an ending event with no playback progress for 60 seconds after event end
    When the timeout is reached
    Then the broadcast stops safely and shows a playback timeout

  @BDD @US3 @FR-013
  @BDD-US3-OPT077
  Scenario: Required option 077
    Given an ending event with five minutes of playback overrun after event end
    When the timeout is reached
    Then the broadcast stops safely and shows a playback timeout

  @BDD @US4 @FR-019
  @BDD-US4-OPT078
  Scenario: Required option 078
    Given a saved custom standby screen
    When the creator submits an asset with unsupported image type
    Then the old screen remains and the upload error is visible

  @BDD @US4 @FR-019
  @BDD-US4-OPT079
  Scenario: Required option 079
    Given a saved custom standby screen
    When the creator submits an asset with image exceeding the advertised size limit
    Then the old screen remains and the upload error is visible

  @BDD @US4 @FR-019
  @BDD-US4-OPT080
  Scenario: Required option 080
    Given a saved custom standby screen
    When the creator submits an asset with unreadable image
    Then the old screen remains and the upload error is visible

  @BDD @US4 @FR-019
  @BDD-US4-OPT081
  Scenario: Required option 081
    Given a saved custom standby screen
    When the creator submits an asset with upload storage failure
    Then the old screen remains and the upload error is visible

  @BDD @US1 @FR-003
  @BDD-US1-OPT082
  Scenario: Required option 082
    Given an operator without the required permission
    When they request start
    Then the operation is denied without changing resource state

  @BDD @US1 @FR-003
  @BDD-US1-OPT083
  Scenario: Required option 083
    Given an operator without the required permission
    When they request stop
    Then the operation is denied without changing resource state

  @BDD @US1 @FR-003
  @BDD-US1-OPT084
  Scenario: Required option 084
    Given an operator without the required permission
    When they request edit destinations
    Then the operation is denied without changing resource state

  @BDD @US1 @FR-003
  @BDD-US1-OPT085
  Scenario: Required option 085
    Given an operator without the required permission
    When they request edit schedule
    Then the operation is denied without changing resource state

  @BDD @US1 @FR-003
  @BDD-US1-OPT086
  Scenario: Required option 086
    Given an operator without the required permission
    When they request edit standby
    Then the operation is denied without changing resource state

  @BDD @US1 @FR-002
  @BDD-US1-OPT087
  Scenario: Required option 087
    Given a Free owner whose first start fails before an output is established
    When they retry on another device
    Then the failed start does not consume the active slot

  @BDD @US3 @FR-015
  @BDD-US3-OPT088
  Scenario: Required option 088
    Given an active scheduled event
    When the owner pauses automation
    Then scheduled control pauses and the UI explains the current broadcast state

  @BDD @US3 @FR-015
  @BDD-US3-OPT089
  Scenario: Required option 089
    Given a manually stopped scheduled occurrence
    When the next recurring occurrence begins
    Then automation can start the new occurrence without restarting the stopped one

  @BDD @US3 @FR-011
  @BDD-US3-OPT090
  Scenario: Required option 090
    Given a saved event crossing midnight in its declared timezone
    When its start and end are evaluated
    Then the event runs across the date boundary at the saved local times

  @BDD @US3 @FR-011
  @BDD-US3-OPT091
  Scenario: Required option 091
    Given a saved recurring event
    When the creator changes its timezone
    Then future occurrences follow the new timezone without duplicate current occurrence starts

  @BDD @US2 @FR-008
  @BDD-US2-OPT092
  Scenario: Required option 092
    Given a two-destination broadcast
    When a disconnected target successfully reconnects
    Then only that output rejoins and the healthy destination never restarts

  @BDD @US4 @FR-018
  @BDD-US4-OPT093
  Scenario: Required option 093
    Given a Pro owner with watermark removed
    When they opt to show Clipify branding
    Then the preview and generated output include branding

  @BDD @US4 @FR-019
  @BDD-US4-OPT094
  Scenario: Required option 094
    Given a scheduled Runner outside all broadcast windows
    When no playable content is available
    Then no standby broadcast starts outside its schedule
```

| Scenario ID    | Owning Suite | Evidence Roles | Primary Source | Class                                                                                 | Interface               | Equivalence rationale                                                 |
| -------------- | ------------ | -------------- | -------------- | ------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------- |
| BDD-US1-OPT001 | BDD          | BDD, ATDD      | FR-001         | Positive: they register a Runner                                                      | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US1-OPT002 | BDD          | BDD, ATDD      | FR-001         | Positive: they register a Runner                                                      | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US1-OPT003 | BDD          | BDD, ATDD      | FR-001         | Positive: they register a Runner                                                      | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US1-OPT004 | BDD          | BDD, ATDD      | FR-001         | Positive: they register a Runner                                                      | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US1-OPT005 | BDD          | BDD, ATDD      | FR-001         | Positive: they register a Runner                                                      | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US1-OPT006 | BDD          | BDD, ATDD      | FR-002         | Negative: a second device requests start                                              | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US1-OPT007 | BDD          | BDD, ATDD      | FR-002         | Negative: a second device requests start                                              | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US1-OPT008 | BDD          | BDD, ATDD      | FR-002         | Negative: a second device requests start                                              | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US1-OPT009 | BDD          | BDD, ATDD      | FR-002         | Negative: a second device requests start                                              | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US2-OPT010 | BDD          | BDD, ATDD      | FR-006         | Positive: they start their broadcast                                                  | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US2-OPT011 | BDD          | BDD, ATDD      | FR-006         | Positive: they start their broadcast                                                  | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US2-OPT012 | BDD          | BDD, ATDD      | FR-006         | Positive: they start their broadcast                                                  | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US2-OPT013 | BDD          | BDD, ATDD      | FR-009         | Negative: they submit a invalid RTMP address                                          | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US2-OPT014 | BDD          | BDD, ATDD      | FR-009         | Negative: they submit a missing required YouTube key                                  | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US2-OPT015 | BDD          | BDD, ATDD      | FR-009         | Negative: they submit a missing required Twitch key                                   | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US2-OPT016 | BDD          | BDD, ATDD      | FR-009         | Negative: they submit a duplicate destination                                         | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US2-OPT017 | BDD          | BDD, ATDD      | FR-009         | Positive: the authorized creator chooses keep                                         | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US2-OPT018 | BDD          | BDD, ATDD      | FR-009         | Positive: the authorized creator chooses replace                                      | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US2-OPT019 | BDD          | BDD, ATDD      | FR-009         | Positive: the authorized creator chooses clear                                        | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT020 | BDD          | BDD, ATDD      | FR-010         | Positive: they create an event using pointer planner                                  | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT021 | BDD          | BDD, ATDD      | FR-010         | Positive: they create an event using keyboard and form/list controls                  | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT022 | BDD          | BDD, ATDD      | FR-010         | Positive: they move an event using pointer planner                                    | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT023 | BDD          | BDD, ATDD      | FR-010         | Positive: they move an event using keyboard and form/list controls                    | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT024 | BDD          | BDD, ATDD      | FR-010         | Positive: they resize an event using pointer planner                                  | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT025 | BDD          | BDD, ATDD      | FR-010         | Positive: they resize an event using keyboard and form/list controls                  | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT026 | BDD          | BDD, ATDD      | FR-010         | Positive: they edit an event using pointer planner                                    | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT027 | BDD          | BDD, ATDD      | FR-010         | Positive: they edit an event using keyboard and form/list controls                    | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT028 | BDD          | BDD, ATDD      | FR-010         | Positive: they delete an event using pointer planner                                  | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT029 | BDD          | BDD, ATDD      | FR-010         | Positive: they delete an event using keyboard and form/list controls                  | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT030 | BDD          | BDD, ATDD      | FR-011         | Positive: the owner reloads and the event becomes due                                 | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT031 | BDD          | BDD, ATDD      | FR-011         | Positive: the owner reloads and the event becomes due                                 | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT032 | BDD          | BDD, ATDD      | FR-011         | Negative: the creator submits an event with end before start                          | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT033 | BDD          | BDD, ATDD      | FR-011         | Negative: the creator submits an event with end equal to start                        | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT034 | BDD          | BDD, ATDD      | FR-011         | Negative: the creator submits an event with missing source                            | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT035 | BDD          | BDD, ATDD      | FR-011         | Negative: the creator submits an event with missing destination                       | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT036 | BDD          | BDD, ATDD      | FR-011         | Negative: the creator submits an event with invalid timezone                          | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT037 | BDD          | BDD, ATDD      | FR-014         | Negative: the creator submits an event with overlap with an existing event            | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT038 | BDD          | BDD, ATDD      | FR-013         | Boundary: the end boundary is evaluated                                               | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT039 | BDD          | BDD, ATDD      | FR-013         | Boundary: the end boundary is evaluated                                               | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT040 | BDD          | BDD, ATDD      | FR-013         | Boundary: the end boundary is evaluated                                               | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT041 | BDD          | BDD, ATDD      | FR-013         | Boundary: the end boundary is evaluated                                               | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT042 | BDD          | BDD, ATDD      | FR-015         | Positive: the Runner reconciles its event state                                       | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT043 | BDD          | BDD, ATDD      | FR-015         | Positive: the Runner reconciles its event state                                       | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT044 | BDD          | BDD, ATDD      | FR-015         | Positive: the Runner reconciles its event state                                       | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT045 | BDD          | BDD, ATDD      | FR-015         | Positive: the Runner reconciles its event state                                       | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT046 | BDD          | BDD, ATDD      | FR-014         | Boundary: the first event ends during a clip                                          | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT047 | BDD          | BDD, ATDD      | FR-014         | Boundary: the first event ends during a clip                                          | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT048 | BDD          | BDD, ATDD      | FR-014         | Boundary: the first event ends during a clip                                          | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT049 | BDD          | BDD, ATDD      | FR-014         | Boundary: the first event ends during a clip                                          | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT050 | BDD          | BDD, ATDD      | FR-017         | Positive: they choose top-left                                                        | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT051 | BDD          | BDD, ATDD      | FR-017         | Positive: they choose top-right                                                       | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT052 | BDD          | BDD, ATDD      | FR-017         | Positive: they choose bottom-left                                                     | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT053 | BDD          | BDD, ATDD      | FR-017         | Positive: they choose bottom-right                                                    | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT054 | BDD          | BDD, ATDD      | FR-016         | Positive: the output is observed                                                      | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT055 | BDD          | BDD, ATDD      | FR-016         | Positive: the output is observed                                                      | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT056 | BDD          | BDD, ATDD      | FR-016         | Positive: the output is observed                                                      | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT057 | BDD          | BDD, ATDD      | FR-016         | Positive: the output is observed                                                      | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT058 | BDD          | BDD, ATDD      | FR-016         | Positive: the output is observed                                                      | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT059 | BDD          | BDD, ATDD      | FR-019         | Positive: they configure background color and preview then activate standby           | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT060 | BDD          | BDD, ATDD      | FR-019         | Positive: they configure background image and preview then activate standby           | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT061 | BDD          | BDD, ATDD      | FR-019         | Positive: they configure custom logo and preview then activate standby                | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT062 | BDD          | BDD, ATDD      | FR-019         | Positive: they configure custom message and preview then activate standby             | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT063 | BDD          | BDD, ATDD      | FR-019         | Positive: they configure next-broadcast time and preview then activate standby        | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US5-OPT064 | BDD          | BDD, ATDD      | FR-020         | Positive: they inspect or attempt the standalone Runner purchase                      | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US5-OPT065 | BDD          | BDD, ATDD      | FR-020         | Positive: they inspect or attempt the standalone Runner purchase                      | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US5-OPT066 | BDD          | BDD, ATDD      | FR-020         | Positive: they inspect or attempt the standalone Runner purchase                      | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US5-OPT067 | BDD          | BDD, ATDD      | FR-020         | Positive: they inspect or attempt the standalone Runner purchase                      | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US5-OPT068 | BDD          | BDD, ATDD      | FR-021         | Positive: they request a Pro Runner capability                                        | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US5-OPT069 | BDD          | BDD, ATDD      | FR-021         | Positive: they request a Pro Runner capability                                        | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US5-OPT070 | BDD          | BDD, ATDD      | FR-021         | Positive: they request a Pro Runner capability                                        | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US5-OPT071 | BDD          | BDD, ATDD      | FR-021         | Positive: they request a Pro Runner capability                                        | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US5-OPT072 | BDD          | BDD, ATDD      | FR-021         | Positive: they request a Pro Runner capability                                        | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US5-OPT073 | BDD          | BDD, ATDD      | FR-022         | Boundary: their Pro entitlement expires                                               | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US5-OPT074 | BDD          | BDD, ATDD      | FR-022         | Boundary: their Pro entitlement expires                                               | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US5-OPT075 | BDD          | BDD, ATDD      | FR-022         | Boundary: their Pro entitlement expires                                               | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT076 | BDD          | BDD, ATDD      | FR-013         | Negative: the timeout is reached                                                      | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT077 | BDD          | BDD, ATDD      | FR-013         | Negative: the timeout is reached                                                      | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT078 | BDD          | BDD, ATDD      | FR-019         | Negative: the creator submits an asset with unsupported image type                    | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT079 | BDD          | BDD, ATDD      | FR-019         | Negative: the creator submits an asset with image exceeding the advertised size limit | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT080 | BDD          | BDD, ATDD      | FR-019         | Negative: the creator submits an asset with unreadable image                          | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT081 | BDD          | BDD, ATDD      | FR-019         | Negative: the creator submits an asset with upload storage failure                    | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US1-OPT082 | BDD          | BDD, ATDD      | FR-003         | Negative: they request start                                                          | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US1-OPT083 | BDD          | BDD, ATDD      | FR-003         | Negative: they request stop                                                           | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US1-OPT084 | BDD          | BDD, ATDD      | FR-003         | Negative: they request edit destinations                                              | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US1-OPT085 | BDD          | BDD, ATDD      | FR-003         | Negative: they request edit schedule                                                  | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US1-OPT086 | BDD          | BDD, ATDD      | FR-003         | Negative: they request edit standby                                                   | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US1-OPT087 | BDD          | BDD, ATDD      | FR-002         | Positive: they retry on another device                                                | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT088 | BDD          | BDD, ATDD      | FR-015         | Positive: the owner pauses automation                                                 | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT089 | BDD          | BDD, ATDD      | FR-015         | Positive: the next recurring occurrence begins                                        | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT090 | BDD          | BDD, ATDD      | FR-011         | Positive: its start and end are evaluated                                             | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US3-OPT091 | BDD          | BDD, ATDD      | FR-011         | Positive: the creator changes its timezone                                            | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US2-OPT092 | BDD          | BDD, ATDD      | FR-008         | Positive: a disconnected target successfully reconnects                               | Runner workflow/runtime | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT093 | BDD          | BDD, ATDD      | FR-018         | Positive: they opt to show Clipify branding                                           | Browser                 | The specific outcome is both behavior and acceptance for this option. |
| BDD-US4-OPT094 | BDD          | BDD, ATDD      | FR-019         | Positive: no playable content is available                                            | Browser                 | The specific outcome is both behavior and acceptance for this option. |

| Test ID        | Sources     | Level    | Owning suite / area                             | Intent                                                                                                                                                                                                               | Expected initial failure                   |
| -------------- | ----------- | -------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| TDD-US1-OPT001 | US1, FR-001 | Positive | TDD / Runner access, runtime or component tests | an owner with Free access; they register a Runner; assert registration succeeds without a Runner purchase                                                                                                            | Missing behavior or wrong state transition |
| TDD-US1-OPT002 | US1, FR-001 | Positive | TDD / Runner access, runtime or component tests | an owner with Pro access; they register a Runner; assert registration succeeds without a Runner purchase                                                                                                             | Missing behavior or wrong state transition |
| TDD-US1-OPT003 | US1, FR-001 | Positive | TDD / Runner access, runtime or component tests | an owner with an active Pro grant; they register a Runner; assert registration succeeds without a Runner purchase                                                                                                    | Missing behavior or wrong state transition |
| TDD-US1-OPT004 | US1, FR-001 | Positive | TDD / Runner access, runtime or component tests | an owner with an active agency creator Pro allocation; they register a Runner; assert registration succeeds without a Runner purchase                                                                                | Missing behavior or wrong state transition |
| TDD-US1-OPT005 | US1, FR-001 | Positive | TDD / Runner access, runtime or component tests | an owner with active Pro trial access; they register a Runner; assert registration succeeds without a Runner purchase                                                                                                | Missing behavior or wrong state transition |
| TDD-US1-OPT006 | US1, FR-002 | Negative | TDD / Runner access, runtime or component tests | a Free owner already broadcasting in Clip playback; a second device requests start; assert the request is rejected and the existing output continues                                                                 | Missing behavior or wrong state transition |
| TDD-US1-OPT007 | US1, FR-002 | Negative | TDD / Runner access, runtime or component tests | a Free owner already broadcasting in Live fallback forwarding live input; a second device requests start; assert the request is rejected and the existing output continues                                           | Missing behavior or wrong state transition |
| TDD-US1-OPT008 | US1, FR-002 | Negative | TDD / Runner access, runtime or component tests | a Free owner already broadcasting in Live fallback playing clips; a second device requests start; assert the request is rejected and the existing output continues                                                   | Missing behavior or wrong state transition |
| TDD-US1-OPT009 | US1, FR-002 | Negative | TDD / Runner access, runtime or component tests | a Free owner already broadcasting in Live fallback showing standby; a second device requests start; assert the request is rejected and the existing output continues                                                 | Missing behavior or wrong state transition |
| TDD-US2-OPT010 | US2, FR-006 | Positive | TDD / Runner access, runtime or component tests | a Pro owner selecting only YouTube; they start their broadcast; assert the selected YouTube destination receives the content                                                                                         | Missing behavior or wrong state transition |
| TDD-US2-OPT011 | US2, FR-006 | Positive | TDD / Runner access, runtime or component tests | a Pro owner selecting only Twitch; they start their broadcast; assert the selected Twitch destination receives the content                                                                                           | Missing behavior or wrong state transition |
| TDD-US2-OPT012 | US2, FR-006 | Positive | TDD / Runner access, runtime or component tests | a Pro owner selecting only custom RTMP; they start their broadcast; assert the selected custom RTMP destination receives the content                                                                                 | Missing behavior or wrong state transition |
| TDD-US2-OPT013 | US2, FR-009 | Negative | TDD / Runner access, runtime or component tests | a creator with previously valid destination settings; they submit a invalid RTMP address; assert the invalid submission is rejected and previous settings and protected keys remain unchanged                        | Missing behavior or wrong state transition |
| TDD-US2-OPT014 | US2, FR-009 | Negative | TDD / Runner access, runtime or component tests | a creator with previously valid destination settings; they submit a missing required YouTube key; assert the invalid submission is rejected and previous settings and protected keys remain unchanged                | Missing behavior or wrong state transition |
| TDD-US2-OPT015 | US2, FR-009 | Negative | TDD / Runner access, runtime or component tests | a creator with previously valid destination settings; they submit a missing required Twitch key; assert the invalid submission is rejected and previous settings and protected keys remain unchanged                 | Missing behavior or wrong state transition |
| TDD-US2-OPT016 | US2, FR-009 | Negative | TDD / Runner access, runtime or component tests | a creator with previously valid destination settings; they submit a duplicate destination; assert the invalid submission is rejected and previous settings and protected keys remain unchanged                       | Missing behavior or wrong state transition |
| TDD-US2-OPT017 | US2, FR-009 | Positive | TDD / Runner access, runtime or component tests | a destination with a stored key; the authorized creator chooses keep; assert the original protected credential remains                                                                                               | Missing behavior or wrong state transition |
| TDD-US2-OPT018 | US2, FR-009 | Positive | TDD / Runner access, runtime or component tests | a destination with a stored key; the authorized creator chooses replace; assert the new protected credential replaces the old one                                                                                    | Missing behavior or wrong state transition |
| TDD-US2-OPT019 | US2, FR-009 | Positive | TDD / Runner access, runtime or component tests | a destination with a stored key; the authorized creator chooses clear; assert the credential is removed and targets requiring a key cannot start                                                                     | Missing behavior or wrong state transition |
| TDD-US3-OPT020 | US3, FR-010 | Positive | TDD / Runner access, runtime or component tests | a Pro owner with a valid week schedule; they create an event using pointer planner; assert the create operation persists and the visible schedule reflects it                                                        | Missing behavior or wrong state transition |
| TDD-US3-OPT021 | US3, FR-010 | Positive | TDD / Runner access, runtime or component tests | a Pro owner with a valid week schedule; they create an event using keyboard and form/list controls; assert the create operation persists and the visible schedule reflects it                                        | Missing behavior or wrong state transition |
| TDD-US3-OPT022 | US3, FR-010 | Positive | TDD / Runner access, runtime or component tests | a Pro owner with a valid week schedule; they move an event using pointer planner; assert the move operation persists and the visible schedule reflects it                                                            | Missing behavior or wrong state transition |
| TDD-US3-OPT023 | US3, FR-010 | Positive | TDD / Runner access, runtime or component tests | a Pro owner with a valid week schedule; they move an event using keyboard and form/list controls; assert the move operation persists and the visible schedule reflects it                                            | Missing behavior or wrong state transition |
| TDD-US3-OPT024 | US3, FR-010 | Positive | TDD / Runner access, runtime or component tests | a Pro owner with a valid week schedule; they resize an event using pointer planner; assert the resize operation persists and the visible schedule reflects it                                                        | Missing behavior or wrong state transition |
| TDD-US3-OPT025 | US3, FR-010 | Positive | TDD / Runner access, runtime or component tests | a Pro owner with a valid week schedule; they resize an event using keyboard and form/list controls; assert the resize operation persists and the visible schedule reflects it                                        | Missing behavior or wrong state transition |
| TDD-US3-OPT026 | US3, FR-010 | Positive | TDD / Runner access, runtime or component tests | a Pro owner with a valid week schedule; they edit an event using pointer planner; assert the edit operation persists and the visible schedule reflects it                                                            | Missing behavior or wrong state transition |
| TDD-US3-OPT027 | US3, FR-010 | Positive | TDD / Runner access, runtime or component tests | a Pro owner with a valid week schedule; they edit an event using keyboard and form/list controls; assert the edit operation persists and the visible schedule reflects it                                            | Missing behavior or wrong state transition |
| TDD-US3-OPT028 | US3, FR-010 | Positive | TDD / Runner access, runtime or component tests | a Pro owner with a valid week schedule; they delete an event using pointer planner; assert the delete operation persists and the visible schedule reflects it                                                        | Missing behavior or wrong state transition |
| TDD-US3-OPT029 | US3, FR-010 | Positive | TDD / Runner access, runtime or component tests | a Pro owner with a valid week schedule; they delete an event using keyboard and form/list controls; assert the delete operation persists and the visible schedule reflects it                                        | Missing behavior or wrong state transition |
| TDD-US3-OPT030 | US3, FR-011 | Positive | TDD / Runner access, runtime or component tests | a saved one-time event with timezone source and selected destinations; the owner reloads and the event becomes due; assert its choices persist and it runs at the intended occurrence                                | Missing behavior or wrong state transition |
| TDD-US3-OPT031 | US3, FR-011 | Positive | TDD / Runner access, runtime or component tests | a saved weekly event with timezone source and selected destinations; the owner reloads and the event becomes due; assert its choices persist and it runs at the intended occurrence                                  | Missing behavior or wrong state transition |
| TDD-US3-OPT032 | US3, FR-011 | Negative | TDD / Runner access, runtime or component tests | an existing valid schedule; the creator submits an event with end before start; assert saving is rejected with an explanation and the previous schedule remains authoritative                                        | Missing behavior or wrong state transition |
| TDD-US3-OPT033 | US3, FR-011 | Negative | TDD / Runner access, runtime or component tests | an existing valid schedule; the creator submits an event with end equal to start; assert saving is rejected with an explanation and the previous schedule remains authoritative                                      | Missing behavior or wrong state transition |
| TDD-US3-OPT034 | US3, FR-011 | Negative | TDD / Runner access, runtime or component tests | an existing valid schedule; the creator submits an event with missing source; assert saving is rejected with an explanation and the previous schedule remains authoritative                                          | Missing behavior or wrong state transition |
| TDD-US3-OPT035 | US3, FR-011 | Negative | TDD / Runner access, runtime or component tests | an existing valid schedule; the creator submits an event with missing destination; assert saving is rejected with an explanation and the previous schedule remains authoritative                                     | Missing behavior or wrong state transition |
| TDD-US3-OPT036 | US3, FR-011 | Negative | TDD / Runner access, runtime or component tests | an existing valid schedule; the creator submits an event with invalid timezone; assert saving is rejected with an explanation and the previous schedule remains authoritative                                        | Missing behavior or wrong state transition |
| TDD-US3-OPT037 | US3, FR-014 | Negative | TDD / Runner access, runtime or component tests | an existing valid schedule; the creator submits an event with overlap with an existing event; assert saving is rejected with an explanation and the previous schedule remains authoritative                          | Missing behavior or wrong state transition |
| TDD-US3-OPT038 | US3, FR-013 | Boundary | TDD / Runner access, runtime or component tests | an event where clip ends before scheduled end; the end boundary is evaluated; assert another clip may start before the event end                                                                                     | Missing behavior or wrong state transition |
| TDD-US3-OPT039 | US3, FR-013 | Boundary | TDD / Runner access, runtime or component tests | an event where clip ends exactly at scheduled end; the end boundary is evaluated; assert the broadcast stops without starting another clip                                                                           | Missing behavior or wrong state transition |
| TDD-US3-OPT040 | US3, FR-013 | Boundary | TDD / Runner access, runtime or component tests | an event where clip ends after scheduled end; the end boundary is evaluated; assert the broadcast stops at that clip end without starting another clip                                                               | Missing behavior or wrong state transition |
| TDD-US3-OPT041 | US3, FR-013 | Boundary | TDD / Runner access, runtime or component tests | an event where no clip is playing at scheduled end; the end boundary is evaluated; assert the broadcast stops at scheduled end                                                                                       | Missing behavior or wrong state transition |
| TDD-US3-OPT042 | US3, FR-015 | Positive | TDD / Runner access, runtime or component tests | Runner was offline before an event and returns within its window; the Runner reconciles its event state; assert the remaining window starts once                                                                     | Missing behavior or wrong state transition |
| TDD-US3-OPT043 | US3, FR-015 | Positive | TDD / Runner access, runtime or component tests | Runner returns after an event has ended; the Runner reconciles its event state; assert that event is skipped                                                                                                         | Missing behavior or wrong state transition |
| TDD-US3-OPT044 | US3, FR-015 | Positive | TDD / Runner access, runtime or component tests | control connection fails during a cached event; the Runner reconciles its event state; assert local playback and end handling continue                                                                               | Missing behavior or wrong state transition |
| TDD-US3-OPT045 | US3, FR-015 | Positive | TDD / Runner access, runtime or component tests | Runner restarts while a scheduled event is active; the Runner reconciles its event state; assert the remaining window resumes once                                                                                   | Missing behavior or wrong state transition |
| TDD-US3-OPT046 | US3, FR-014 | Boundary | TDD / Runner access, runtime or component tests | adjacent events with identical source and destinations; the first event ends during a clip; assert playback remains continuous without reconnecting                                                                  | Missing behavior or wrong state transition |
| TDD-US3-OPT047 | US3, FR-014 | Boundary | TDD / Runner access, runtime or component tests | adjacent events with different source; the first event ends during a clip; assert the next source starts after clip completion if its window is active                                                               | Missing behavior or wrong state transition |
| TDD-US3-OPT048 | US3, FR-014 | Boundary | TDD / Runner access, runtime or component tests | adjacent events with different destinations; the first event ends during a clip; assert the next target set starts after clip completion if its window is active                                                     | Missing behavior or wrong state transition |
| TDD-US3-OPT049 | US3, FR-014 | Boundary | TDD / Runner access, runtime or component tests | adjacent events with next event already ended during overrun; the first event ends during a clip; assert the expired event is skipped                                                                                | Missing behavior or wrong state transition |
| TDD-US4-OPT050 | US4, FR-017 | Positive | TDD / Runner access, runtime or component tests | a Free owner with a Runner preview; they choose top-left; assert preview and generated output show the readable logo and two-line watermark at top-left                                                              | Missing behavior or wrong state transition |
| TDD-US4-OPT051 | US4, FR-017 | Positive | TDD / Runner access, runtime or component tests | a Free owner with a Runner preview; they choose top-right; assert preview and generated output show the readable logo and two-line watermark at top-right                                                            | Missing behavior or wrong state transition |
| TDD-US4-OPT052 | US4, FR-017 | Positive | TDD / Runner access, runtime or component tests | a Free owner with a Runner preview; they choose bottom-left; assert preview and generated output show the readable logo and two-line watermark at bottom-left                                                        | Missing behavior or wrong state transition |
| TDD-US4-OPT053 | US4, FR-017 | Positive | TDD / Runner access, runtime or component tests | a Free owner with a Runner preview; they choose bottom-right; assert preview and generated output show the readable logo and two-line watermark at bottom-right                                                      | Missing behavior or wrong state transition |
| TDD-US4-OPT054 | US4, FR-016 | Positive | TDD / Runner access, runtime or component tests | a Free owner displaying clip playback; the output is observed; assert the Clipify watermark is present                                                                                                               | Missing behavior or wrong state transition |
| TDD-US4-OPT055 | US4, FR-016 | Positive | TDD / Runner access, runtime or component tests | a Free owner displaying fallback clips; the output is observed; assert the Clipify watermark is present                                                                                                              | Missing behavior or wrong state transition |
| TDD-US4-OPT056 | US4, FR-016 | Positive | TDD / Runner access, runtime or component tests | a Free owner displaying standby; the output is observed; assert the Clipify watermark is present                                                                                                                     | Missing behavior or wrong state transition |
| TDD-US4-OPT057 | US4, FR-016 | Positive | TDD / Runner access, runtime or component tests | a Free owner displaying incoming live video; the output is observed; assert the Clipify watermark is absent                                                                                                          | Missing behavior or wrong state transition |
| TDD-US4-OPT058 | US4, FR-016 | Positive | TDD / Runner access, runtime or component tests | a Free owner displaying ordinary non-Runner overlay; the output is observed; assert the Clipify watermark is absent                                                                                                  | Missing behavior or wrong state transition |
| TDD-US4-OPT059 | US4, FR-019 | Positive | TDD / Runner access, runtime or component tests | a Pro owner editing standby; they configure background color and preview then activate standby; assert the configured appearance matches preview during the active broadcast                                         | Missing behavior or wrong state transition |
| TDD-US4-OPT060 | US4, FR-019 | Positive | TDD / Runner access, runtime or component tests | a Pro owner editing standby; they configure background image and preview then activate standby; assert the configured appearance matches preview during the active broadcast                                         | Missing behavior or wrong state transition |
| TDD-US4-OPT061 | US4, FR-019 | Positive | TDD / Runner access, runtime or component tests | a Pro owner editing standby; they configure custom logo and preview then activate standby; assert the configured appearance matches preview during the active broadcast                                              | Missing behavior or wrong state transition |
| TDD-US4-OPT062 | US4, FR-019 | Positive | TDD / Runner access, runtime or component tests | a Pro owner editing standby; they configure custom message and preview then activate standby; assert the configured appearance matches preview during the active broadcast                                           | Missing behavior or wrong state transition |
| TDD-US4-OPT063 | US4, FR-019 | Positive | TDD / Runner access, runtime or component tests | a Pro owner editing standby; they configure next-broadcast time and preview then activate standby; assert the configured appearance matches preview during the active broadcast                                      | Missing behavior or wrong state transition |
| TDD-US5-OPT064 | US5, FR-020 | Positive | TDD / Runner access, runtime or component tests | a creator at public pricing; they inspect or attempt the standalone Runner purchase; assert no new Runner product can be purchased and included Free access is clear                                                 | Missing behavior or wrong state transition |
| TDD-US5-OPT065 | US5, FR-020 | Positive | TDD / Runner access, runtime or component tests | a creator at checkout entry point; they inspect or attempt the standalone Runner purchase; assert no new Runner product can be purchased and included Free access is clear                                           | Missing behavior or wrong state transition |
| TDD-US5-OPT066 | US5, FR-020 | Positive | TDD / Runner access, runtime or component tests | a creator at billing controls; they inspect or attempt the standalone Runner purchase; assert no new Runner product can be purchased and included Free access is clear                                               | Missing behavior or wrong state transition |
| TDD-US5-OPT067 | US5, FR-020 | Positive | TDD / Runner access, runtime or component tests | a creator at Runner onboarding; they inspect or attempt the standalone Runner purchase; assert no new Runner product can be purchased and included Free access is clear                                              | Missing behavior or wrong state transition |
| TDD-US5-OPT068 | US5, FR-021 | Positive | TDD / Runner access, runtime or component tests | an owner with an active Pro grant; they request a Pro Runner capability; assert the capability is available through effective Pro                                                                                    | Missing behavior or wrong state transition |
| TDD-US5-OPT069 | US5, FR-021 | Positive | TDD / Runner access, runtime or component tests | an owner with an expired Pro grant; they request a Pro Runner capability; assert the capability is denied without unrelated Pro access                                                                               | Missing behavior or wrong state transition |
| TDD-US5-OPT070 | US5, FR-021 | Positive | TDD / Runner access, runtime or component tests | an owner with a revoked Pro grant; they request a Pro Runner capability; assert the capability is denied without unrelated Pro access                                                                                | Missing behavior or wrong state transition |
| TDD-US5-OPT071 | US5, FR-021 | Positive | TDD / Runner access, runtime or component tests | an owner with an active agency creator Pro allocation; they request a Pro Runner capability; assert the capability is available through effective Pro                                                                | Missing behavior or wrong state transition |
| TDD-US5-OPT072 | US5, FR-021 | Positive | TDD / Runner access, runtime or component tests | an owner with an ended agency creator Pro allocation; they request a Pro Runner capability; assert the capability is denied without unrelated Pro access                                                             | Missing behavior or wrong state transition |
| TDD-US5-OPT073 | US5, FR-022 | Boundary | TDD / Runner access, runtime or component tests | a Pro owner with 0 active broadcasts and saved paid settings; their Pro entitlement expires; assert configuration remains saved and new paid starts are disabled; existing sessions finish under the transition rule | Missing behavior or wrong state transition |
| TDD-US5-OPT074 | US5, FR-022 | Boundary | TDD / Runner access, runtime or component tests | a Pro owner with 1 active broadcasts and saved paid settings; their Pro entitlement expires; assert configuration remains saved and new paid starts are disabled; existing sessions finish under the transition rule | Missing behavior or wrong state transition |
| TDD-US5-OPT075 | US5, FR-022 | Boundary | TDD / Runner access, runtime or component tests | a Pro owner with 2 active broadcasts and saved paid settings; their Pro entitlement expires; assert configuration remains saved and new paid starts are disabled; existing sessions finish under the transition rule | Missing behavior or wrong state transition |
| TDD-US3-OPT076 | US3, FR-013 | Negative | TDD / Runner access, runtime or component tests | an ending event with no playback progress for 60 seconds after event end; the timeout is reached; assert the broadcast stops safely and shows a playback timeout                                                     | Missing behavior or wrong state transition |
| TDD-US3-OPT077 | US3, FR-013 | Negative | TDD / Runner access, runtime or component tests | an ending event with five minutes of playback overrun after event end; the timeout is reached; assert the broadcast stops safely and shows a playback timeout                                                        | Missing behavior or wrong state transition |
| TDD-US4-OPT078 | US4, FR-019 | Negative | TDD / Runner access, runtime or component tests | a saved custom standby screen; the creator submits an asset with unsupported image type; assert the old screen remains and the upload error is visible                                                               | Missing behavior or wrong state transition |
| TDD-US4-OPT079 | US4, FR-019 | Negative | TDD / Runner access, runtime or component tests | a saved custom standby screen; the creator submits an asset with image exceeding the advertised size limit; assert the old screen remains and the upload error is visible                                            | Missing behavior or wrong state transition |
| TDD-US4-OPT080 | US4, FR-019 | Negative | TDD / Runner access, runtime or component tests | a saved custom standby screen; the creator submits an asset with unreadable image; assert the old screen remains and the upload error is visible                                                                     | Missing behavior or wrong state transition |
| TDD-US4-OPT081 | US4, FR-019 | Negative | TDD / Runner access, runtime or component tests | a saved custom standby screen; the creator submits an asset with upload storage failure; assert the old screen remains and the upload error is visible                                                               | Missing behavior or wrong state transition |
| TDD-US1-OPT082 | US1, FR-003 | Negative | TDD / Runner access, runtime or component tests | an operator without the required permission; they request start; assert the operation is denied without changing resource state                                                                                      | Missing behavior or wrong state transition |
| TDD-US1-OPT083 | US1, FR-003 | Negative | TDD / Runner access, runtime or component tests | an operator without the required permission; they request stop; assert the operation is denied without changing resource state                                                                                       | Missing behavior or wrong state transition |
| TDD-US1-OPT084 | US1, FR-003 | Negative | TDD / Runner access, runtime or component tests | an operator without the required permission; they request edit destinations; assert the operation is denied without changing resource state                                                                          | Missing behavior or wrong state transition |
| TDD-US1-OPT085 | US1, FR-003 | Negative | TDD / Runner access, runtime or component tests | an operator without the required permission; they request edit schedule; assert the operation is denied without changing resource state                                                                              | Missing behavior or wrong state transition |
| TDD-US1-OPT086 | US1, FR-003 | Negative | TDD / Runner access, runtime or component tests | an operator without the required permission; they request edit standby; assert the operation is denied without changing resource state                                                                               | Missing behavior or wrong state transition |
| TDD-US1-OPT087 | US1, FR-002 | Positive | TDD / Runner access, runtime or component tests | a Free owner whose first start fails before an output is established; they retry on another device; assert the failed start does not consume the active slot                                                         | Missing behavior or wrong state transition |
| TDD-US3-OPT088 | US3, FR-015 | Positive | TDD / Runner access, runtime or component tests | an active scheduled event; the owner pauses automation; assert scheduled control pauses and the UI explains the current broadcast state                                                                              | Missing behavior or wrong state transition |
| TDD-US3-OPT089 | US3, FR-015 | Positive | TDD / Runner access, runtime or component tests | a manually stopped scheduled occurrence; the next recurring occurrence begins; assert automation can start the new occurrence without restarting the stopped one                                                     | Missing behavior or wrong state transition |
| TDD-US3-OPT090 | US3, FR-011 | Positive | TDD / Runner access, runtime or component tests | a saved event crossing midnight in its declared timezone; its start and end are evaluated; assert the event runs across the date boundary at the saved local times                                                   | Missing behavior or wrong state transition |
| TDD-US3-OPT091 | US3, FR-011 | Positive | TDD / Runner access, runtime or component tests | a saved recurring event; the creator changes its timezone; assert future occurrences follow the new timezone without duplicate current occurrence starts                                                             | Missing behavior or wrong state transition |
| TDD-US2-OPT092 | US2, FR-008 | Positive | TDD / Runner access, runtime or component tests | a two-destination broadcast; a disconnected target successfully reconnects; assert only that output rejoins and the healthy destination never restarts                                                               | Missing behavior or wrong state transition |
| TDD-US4-OPT093 | US4, FR-018 | Positive | TDD / Runner access, runtime or component tests | a Pro owner with watermark removed; they opt to show Clipify branding; assert the preview and generated output include branding                                                                                      | Missing behavior or wrong state transition |
| TDD-US4-OPT094 | US4, FR-019 | Positive | TDD / Runner access, runtime or component tests | a scheduled Runner outside all broadcast windows; no playable content is available; assert no standby broadcast starts outside its schedule                                                                          | Missing behavior or wrong state transition |

### Confirmed Unlimited Hours Evidence

```gherkin
Feature: Free unlimited broadcasting hours
  @BDD @US1 @FR-023 @SC-006
  @BDD-US1-FR023
  Scenario: Free broadcasting continues across a month boundary
    Given a Free owner with one active single-destination broadcast
    When playback crosses the month boundary after extended streaming
    Then playback continues without quota warnings or a usage-driven stop

  @ATDD @US1 @FR-023 @SC-006
  @ATDD-US1-SC006
  Scenario: Unlimited hours preserve the concurrent broadcast restriction
    Given a Free owner with a long-running broadcast
    When another owned device requests a broadcast
    Then the second start is denied by concurrency rather than consumed monthly time
```

| Source ID | Type        | TDD      | BDD      | ATDD     | Evidence                      |
| --------- | ----------- | -------- | -------- | -------- | ----------------------------- |
| FR-023    | Requirement | Required | Required | Required | TDD-US1-FR023, BDD-US1-FR023  |
| SC-006    | Outcome     | Required | Required | Required | TDD-US1-SC006, ATDD-US1-SC006 |

| Scenario ID    | Owner | Roles     | Primary source | Inputs                                      | Kind     | Interface       | Rationale                                                               |
| -------------- | ----- | --------- | -------------- | ------------------------------------------- | -------- | --------------- | ----------------------------------------------------------------------- |
| BDD-US1-FR023  | BDD   | BDD, ATDD | FR-023         | Long-running Free broadcast crossing months | Boundary | Runner workflow | Continued playback is both behavior and acceptance.                     |
| ATDD-US1-SC006 | ATDD  | BDD, ATDD | SC-006         | Extended playback plus concurrent start     | Boundary | Runner workflow | Unlimited hours and concurrency remain distinct stakeholder boundaries. |

| Test ID       | Sources     | Owner / level     | Intent                                                        | Expected initial failure                         |
| ------------- | ----------- | ----------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| TDD-US1-FR023 | US1, FR-023 | TDD / runtime     | Extended playback and month rollover never stop on time quota | Existing access gates or missing baseline policy |
| TDD-US1-SC006 | US1, SC-006 | TDD / integration | Extended playback still denies a concurrent Free start        | Missing owner-wide concurrency enforcement       |

## Explicit Validation Boundary Evidence — Approved C2 Refinement

All examples below are required; other inputs remain valid to isolate each boundary. Limits are unchanged: 2MiB is2097152 file bytes;16million pixels is16000000; names/titles1–80, message maximum160. Text-length cases use ASCII to avoid changing Unicode policy. DST duration interpretation remains a separate open finding.

```gherkin
Feature: Explicit Runner input boundaries
  @BDD @US2 @FR-009
  @BDD-US2-BND001
  Scenario: Boundary 001: destination name length 0
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit destination name length of 0
    Then the input is rejected and previous saved settings remain unchanged

  @BDD @US2 @FR-009
  @BDD-US2-BND002
  Scenario: Boundary 002: destination name length 1
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit destination name length of 1
    Then the input is accepted and the saved or normalized result is available

  @BDD @US2 @FR-009
  @BDD-US2-BND003
  Scenario: Boundary 003: destination name length 80
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit destination name length of 80
    Then the input is accepted and the saved or normalized result is available

  @BDD @US2 @FR-009
  @BDD-US2-BND004
  Scenario: Boundary 004: destination name length 81
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit destination name length of 81
    Then the input is rejected and previous saved settings remain unchanged

  @BDD @US3 @FR-011
  @BDD-US3-BND005
  Scenario: Boundary 005: event title length 0
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit event title length of 0
    Then the input is rejected and previous saved settings remain unchanged

  @BDD @US3 @FR-011
  @BDD-US3-BND006
  Scenario: Boundary 006: event title length 1
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit event title length of 1
    Then the input is accepted and the saved or normalized result is available

  @BDD @US3 @FR-011
  @BDD-US3-BND007
  Scenario: Boundary 007: event title length 80
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit event title length of 80
    Then the input is accepted and the saved or normalized result is available

  @BDD @US3 @FR-011
  @BDD-US3-BND008
  Scenario: Boundary 008: event title length 81
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit event title length of 81
    Then the input is rejected and previous saved settings remain unchanged

  @BDD @US3 @FR-011
  @BDD-US3-BND009
  Scenario: Boundary 009: elapsed schedule duration in a timezone without DST at this date 0
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit elapsed schedule duration in a timezone without DST at this date of 0
    Then the input is rejected and previous saved settings remain unchanged

  @BDD @US3 @FR-011
  @BDD-US3-BND010
  Scenario: Boundary 010: elapsed schedule duration in a timezone without DST at this date 24 hours
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit elapsed schedule duration in a timezone without DST at this date of 24 hours
    Then the input is accepted and the saved or normalized result is available

  @BDD @US3 @FR-011
  @BDD-US3-BND011
  Scenario: Boundary 011: elapsed schedule duration in a timezone without DST at this date 24 hours plus one minute
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit elapsed schedule duration in a timezone without DST at this date of 24 hours plus one minute
    Then the input is accepted and the saved or normalized result is available

  @BDD @US4 @FR-019
  @BDD-US4-BND012
  Scenario: Boundary 012: plain-text message length 159
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit plain-text message length of 159
    Then the input is accepted and the saved or normalized result is available

  @BDD @US4 @FR-019
  @BDD-US4-BND013
  Scenario: Boundary 013: plain-text message length 160
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit plain-text message length of 160
    Then the input is accepted and the saved or normalized result is available

  @BDD @US4 @FR-019
  @BDD-US4-BND014
  Scenario: Boundary 014: plain-text message length 161
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit plain-text message length of 161
    Then the input is rejected and previous saved settings remain unchanged

  @BDD @US4 @FR-019
  @BDD-US4-BND015
  Scenario: Boundary 015: asset file bytes excluding request envelope 2097151
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit asset file bytes excluding request envelope of 2097151
    Then the input is accepted and the saved or normalized result is available

  @BDD @US4 @FR-019
  @BDD-US4-BND016
  Scenario: Boundary 016: asset file bytes excluding request envelope 2097152
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit asset file bytes excluding request envelope of 2097152
    Then the input is accepted and the saved or normalized result is available

  @BDD @US4 @FR-019
  @BDD-US4-BND017
  Scenario: Boundary 017: asset file bytes excluding request envelope 2097153
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit asset file bytes excluding request envelope of 2097153
    Then the input is rejected and previous saved settings remain unchanged

  @BDD @US4 @FR-019
  @BDD-US4-BND018
  Scenario: Boundary 018: decoded image dimensions with pixel count below limit 4096x1
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit decoded image dimensions with pixel count below limit of 4096x1
    Then the input is accepted and the saved or normalized result is available

  @BDD @US4 @FR-019
  @BDD-US4-BND019
  Scenario: Boundary 019: decoded image dimensions with pixel count below limit 4097x1
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit decoded image dimensions with pixel count below limit of 4097x1
    Then the input is rejected and previous saved settings remain unchanged

  @BDD @US4 @FR-019
  @BDD-US4-BND020
  Scenario: Boundary 020: decoded image dimensions with pixel count below limit 1x4096
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit decoded image dimensions with pixel count below limit of 1x4096
    Then the input is accepted and the saved or normalized result is available

  @BDD @US4 @FR-019
  @BDD-US4-BND021
  Scenario: Boundary 021: decoded image dimensions with pixel count below limit 1x4097
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit decoded image dimensions with pixel count below limit of 1x4097
    Then the input is rejected and previous saved settings remain unchanged

  @BDD @US4 @FR-019
  @BDD-US4-BND022
  Scenario: Boundary 022: decoded pixel count with both axes within limit 3999x4000 = 15996000
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit decoded pixel count with both axes within limit of 3999x4000 = 15996000
    Then the input is accepted and the saved or normalized result is available

  @BDD @US4 @FR-019
  @BDD-US4-BND023
  Scenario: Boundary 023: decoded pixel count with both axes within limit 4000x4000 = 16000000
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit decoded pixel count with both axes within limit of 4000x4000 = 16000000
    Then the input is accepted and the saved or normalized result is available

  @BDD @US4 @FR-019
  @BDD-US4-BND024
  Scenario: Boundary 024: decoded pixel count with both axes within limit 4001x4000 = 16004000
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit decoded pixel count with both axes within limit of 4001x4000 = 16004000
    Then the input is rejected and previous saved settings remain unchanged

  @BDD @US4 @FR-019
  @BDD-US4-BND025
  Scenario: Boundary 025: valid raster format PNG
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit valid raster format of PNG
    Then the input is accepted and the saved or normalized result is available

  @BDD @US4 @FR-019
  @BDD-US4-BND026
  Scenario: Boundary 026: valid raster format JPEG
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit valid raster format of JPEG
    Then the input is accepted and the saved or normalized result is available

  @BDD @US4 @FR-019
  @BDD-US4-BND027
  Scenario: Boundary 027: valid raster format WebP
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit valid raster format of WebP
    Then the input is accepted and the saved or normalized result is available

  @BDD @US4 @FR-019
  @BDD-US4-BND028
  Scenario: Boundary 028: invalid raster input SVG
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit invalid raster input of SVG
    Then the input is rejected and previous saved settings remain unchanged

  @BDD @US4 @FR-019
  @BDD-US4-BND029
  Scenario: Boundary 029: invalid raster input HTML
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit invalid raster input of HTML
    Then the input is rejected and previous saved settings remain unchanged

  @BDD @US4 @FR-019
  @BDD-US4-BND030
  Scenario: Boundary 030: invalid raster input corrupted PNG
    Given an authorized Pro owner with valid unchanged settings and all other input fields valid
    When they submit invalid raster input of corrupted PNG
    Then the input is rejected and previous saved settings remain unchanged
```

Each BND ID has a planned binding and TDD peer, source mapping and scenario row in test-traceability.md; tasks add these before their existing production slice.

## Confirmed launch decisions after pricing discussion

Ship Free + Pro at current names and current prices. No Plus/Lite tier, price increase, annual-only product, subscriber price-transition policy or release email is part of this feature. Pro includes all existing paid benefits and the planned advanced Runner benefits. Free hours remain unlimited, with one active broadcast and one destination across multiple registered devices. Local execution still runs on the user's PC.

Update src/app/components/Pricing/pricing-catalog.ts, comparison.tsx and existing pricing cards/setup copy; group Runner and broadcasting alongside existing feature categories rather than adding a tier or an oversized undifferentiated list. Produce a reviewable responsive UI using existing HeroUI styling; a gated HeroUI v2 example is design inspiration, not unavailable source assumed installed. Add feature copy and onboarding/billing consistency, remove new Runner add-on offers, preserve historical IDs/grants. Update src/app/llms.txt/llms.txt and src/app/llms-full.txt/llms-full.txt, verifying served routes/src/app/lib/llmsContent.ts reflect the same plan limits, unlimited hours, local scheduling/connectivity and legacy scope. No email is sent by these tasks.

I1: stable identity, captured active occurrence and server-enforced edit/delete locks; Stop/Resume retains Scheduled mode and original end. U1: renewable Free lease with bounded local drain and terminal-only tombstone ACK. I2: focused native workflow Red/Green without coverage; full workflows coverage only at completion gates under the same owner. A1: measurable fixed translucent watermark and overlay collision handling. A2: multi-day/week schedules, DST-local boundaries and mobile day/editor support. These are planning resolutions; all product evidence remains Planned/Not Run.

## Reconciled decision acceptance examples

```gherkin
Feature: Runner decision reconciliation

  @BDD @US1 @FR-002 @EC-002
  @BDD-US1-DEC001
  Scenario: Reconciled decision 001
    Given a Free leased broadcast loses heartbeat while RTMP continues
    When another device requests start before the final lease deadline and drain margin
    Then the slot stays occupied; after supported local bounded stop and deadline+305 seconds exactly one new admission can start

  @BDD @US1 @FR-002 @EC-002
  @BDD-US1-DEC002
  Scenario: Reconciled decision 002
    Given an offline active device is unlinked or deleted
    When its old token attempts heartbeat then submits its matching closed-output terminal ACK
    Then heartbeat and renewal are denied, terminal-only ACK succeeds and frees only its generation

  @BDD @US1 @FR-002 @EC-002
  @BDD-US1-DEC003
  Scenario: Reconciled decision 003
    Given a Free Runner has a lease for a different generation or an expired lease
    When it replays the lease, restarts offline or rolls its wall clock back
    Then no new output starts and monotonic expiry cannot be extended

  @BDD @US3 @FR-011 @FR-015
  @BDD-US3-DEC004
  Scenario: Reconciled decision 004
    Given a one-time event with a persisted suppression marker
    When it is moved before execution or its future configuration revision changes
    Then logical event and occurrence identities remain stable and suppression does not reset

  @BDD @US3 @FR-011 @FR-015
  @BDD-US3-DEC005
  Scenario: Reconciled decision 005
    Given a Pro owner configures a Monday-to-next-Wednesday vacation broadcast
    When they save and reload while viewing successive weeks
    Then explicit end dates persist and an already-active occurrence is included with its full end in the rolling cache

  @BDD @US3 @FR-011 @FR-015
  @BDD-US3-DEC006
  Scenario: Reconciled decision 006
    Given an all-day event in Europe/Berlin on 2026-03-29 or 2026-10-25
    When local midnight boundaries are converted to UTC
    Then the event lasts respectively 23 or 25 hours and executes once

  @BDD @US3 @FR-010 @FR-011 @FR-015 @EC-010
  @BDD-US3-DEC007
  Scenario: Reconciled decision 007
    Given a scheduled occurrence is active or suppressed within its original window
    When dashboard or MCP attempts move, resize, delete or a configuration change affecting that occurrence
    Then the server rejects ACTIVE_OCCURRENCE_LOCKED and preserves its captured bounds and configuration

  @BDD @US3 @FR-010 @FR-011 @FR-015 @EC-010
  @BDD-US3-DEC008
  Scenario: Reconciled decision 008
    Given a scheduled broadcast has been gracefully stopped
    When the owner resumes before its original end, then attempts resume at the end
    Then the first resume retains Scheduled mode and original end; automatic restart stays suppressed until explicit resume and the ended-window resume is denied

  @BDD @US3 @FR-010 @FR-011 @FR-015 @EC-010
  @BDD-US3-DEC009
  Scenario: Reconciled decision 009
    Given a multi-day event crosses the displayed week on a 360px-wide viewport
    When the owner navigates day view and edits explicit start and end dates
    Then all segments map to one event, true bounds persist, and mobile planning remains usable by form and keyboard

  @BDD @US3 @FR-014
  @BDD-US3-DEC010
  Scenario: Reconciled decision 010
    Given two matching scheduled windows touch exactly at local midnight or a week boundary
    When the boundary passes during a playing clip
    Then one execution continues without a hard cut, output reconnect or duplicate clip

  @BDD @US4 @FR-017 @SC-004
  @BDD-US4-DEC011
  Scenario: Reconciled decision 011
    Given generated clip, fallback and standby fixtures at 1080p and a 360px-wide preview
    When the fixed branding is rendered over light, dark and busy backgrounds
    Then the 56px reference text and 112px logo scale uniformly with fixed 0.85 foreground opacity, meet 4.5:1 fixture contrast and remain readable and unclipped

  @BDD @US4 @FR-017 @SC-004
  @BDD-US4-DEC012
  Scenario: Reconciled decision 012
    Given titles, progress and theme decorations occupy preferred watermark corners
    When preview and actual generated output resolve placement for all four corners
    Then the renderer preserves fixed size and 12px clearance and selects a deterministic free position; fully blocked layouts show a configuration error instead of obscuring UI

  @BDD @US5 @FR-020 @FR-023
  @BDD-US5-DEC013
  Scenario: Reconciled decision 013
    Given a creator views public pricing, features, setup and served llms.txt and llms-full.txt
    When they compare Free and Pro after the Runner release
    Then all surfaces retain current two-plan prices and describe unlimited hours and grouped included Runner benefits without a new add-on, Plus or Lite offer
```

## Superseding UX correction decisions (2026-10-18)

The user's explicit hard-cut authorization supersedes all earlier references to preserving standalone Runner grants, billing products, agency Runner seats and historical Runner-only configuration. Only effective Pro access (including existing Pro grant/trial/creator-seat mechanisms) unlocks advanced Runner functionality. Retire `runner_access`, the standalone Runner product and agency Runner seat configuration. The unreleased Runner records need not be preserved or migrated into Pro. Preserve unrelated Pro entitlements and agency creator functionality. Edit schema sources only; generated migrations remain workflow-owned.

The editor must follow the Product UI and UX rules in AGENTS.md. A fresh Free creator must be able to configure a destination beside the broadcast controls, save Manual configuration and start. Paid locks open the existing upgrade dialog. Appearance and schedule use coherent editor modes/dialogs, shared overlay color/preview foundations, secondary fields, Pro DropZone and the installed Agenda controls. Calendar and event editing share the chosen local timezone. Typing in appearance must not navigate/recreate the preview iframe. Real-browser acceptance and inspected desktop/mobile screenshots are required for completion.

## Calendar and locale follow-up (2026-10-19)

Group Agenda's month heading and schedule/automation actions together, with a primary Add schedule action and an icon on Pause/Resume. Keep navigation, displayed date, timezone and view selection in aligned responsive groups. Use the installed all-day strip and month-spanning components for whole-day windows, with an All day control in the event editor. The editor's all-day end date is inclusive; scheduling continues to use the existing midnight-to-midnight interval and selected timezone, including23/25-hour DST days. These remain saved scheduled events. Frontend edits continue through server actions; no new REST or database contract is needed.

The user's chosen date policy is browser locale. Share numeric date/date-time UI formatting with the locale used by installed date pickers, preserve date-only days and explicitly selected timezones, and avoid hard-coded US/UK UI formats. ISO transport/storage values and deterministic server-generated image formatting remain unchanged.
