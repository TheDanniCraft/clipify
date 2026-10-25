# Feature Specification: User tours

**Feature Branch**: `feat/user-tour`

**Created**: 2026-10-25

**Status**: Implemented; UX revision under browser verification

**Input**: Floating expandable guide with interactive spotlight journeys for first overlay, appearance, playlists and optional website/tools/support discovery.

## User Scenarios & Testing

### User Story 1 - Get the first overlay running (Priority: P1)

Create a usable overlay with guided actions and confirm installation.

**Why this priority**: First usable output is the activation boundary.

**Independent Test**: Complete this journey through real dashboard controls and verify its saved output.

**BDD**: Required. **ATDD**: Required. Shared browser scenarios prove the same observable behavior and stakeholder outcome.

**Acceptance Scenarios**:

1. Given a new account, when a user follows the overlay guide, then a named configured overlay exists and preview can be checked.
2. Given a copied URL, when installation is not confirmed, then setup remains incomplete.
3. Given a paused guide, when the user returns, then progress resumes without another resource being created.

### User Story 2 - Customize an overlay (Priority: P2)

Choose a visible appearance change and save it, or retain defaults.

**Why this priority**: Optional capability discovery follows initial value.

**Independent Test**: Complete this journey through real dashboard controls and verify its saved output.

**BDD**: Required. **ATDD**: Required. Shared browser scenarios prove the same observable behavior and stakeholder outcome.

**Acceptance Scenarios**:

1. Given an owned overlay, when a user saves a visible style change, then appearance progress completes.
2. Given unchanged defaults, when the user keeps them, then the guide records a skip without claiming a saved customization.

### User Story 3 - Build and use a playlist (Priority: P2)

Create a playlist, populate and arrange it, then connect it to an overlay.

**Why this priority**: Optional capability discovery follows initial value.

**Independent Test**: Complete this journey through real dashboard controls and verify its saved output.

**BDD**: Required. **ATDD**: Required. Shared browser scenarios prove the same observable behavior and stakeholder outcome.

**Acceptance Scenarios**:

1. Given a new playlist, when a user saves clips and an order, then those clips persist in that order.
2. Given a populated playlist, when an overlay is saved using it, then the playlist journey completes.

### Edge Cases

- **EC-001**: Failed create/save leaves the task incomplete and the existing error visible.
- **EC-002**: No matching clips keeps preview incomplete and offers a broader source or crawl-status guidance.
- **EC-003**: Missing/deleted/unauthorized resources or missing targets pause with recovery guidance; never create a replacement automatically.
- **EC-004**: Malformed, unavailable or obsolete browser storage recovers to usable in-memory defaults without crashing; accounts remain isolated.
- **EC-005**: Failed clipboard write leaves the copy step incomplete and permits retry.
- **EC-006**: Navigation, refresh, modal interactions, switching journeys and repeated completion cannot skip successful-action requirements or duplicate resources.
- **EC-007**: Existing resources count only for their actual observed state; delegated/foreign-owner actions do not complete personal onboarding.

## Requirements

### Functional Requirements

- **FR-001**: System MUST show an authenticated dashboard launcher with expandable first-overlay, appearance, and playlist sections; show progress per section, never a combined backlog.
- **FR-002**: System MUST start a user-requested interactive spotlight tour from each task; keep the real target operable and advance action steps only on successful actions.
- **FR-003**: System MUST guide creating/naming an overlay, choosing clips, saving, previewing available clips, copying the URL, and finishing the OBS/Streamlabs instructions.
- **FR-004**: System MUST offer appearance as a separate optional journey with a visible customization and successful save; allow keeping defaults without claiming a customization.
- **FR-005**: System MUST guide playlist creation/naming, adding and saving clips, arranging clips, and attaching the playlist to an overlay.
- **FR-006**: System MUST persist validated account-scoped progress in this browser; support pause, resume, replay and minimizing without creating resources automatically.
- **FR-007**: System MUST recognize successful actions performed outside a tour; reuse owned existing resources and never treat opening a tour as task completion.
- **FR-008**: System MUST explain external setup with OBS/Streamlabs instructions and an explicit finish action; copying alone never means setup succeeded.
- **FR-009**: System MUST provide keyboard-operable controls, Escape to pause, readable pointers, responsive positioning and reduced-motion support.
- **FR-010**: System MUST emit non-sensitive guide-start, pause and task-complete analytics through existing analytics facilities; never include names, URLs or secrets.
- **FR-011**: System MUST keep the four-task activation path separate from optional website and exploration sections. 24/7 remains deferred. No forced paywalls or automatic blocking spotlights.

### Key Entities

- Journey: ordered tasks for one concrete user outcome.
- Task: stable identifier, title, guidance steps and successful completion condition.
- Progress: version, completed tasks, chosen resource IDs, paused step and panel preference, scoped to one account.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A new user can complete the first-overlay journey and confirm external setup without visiting unrelated features.
- **SC-002**: All supported journeys can be paused, resumed and replayed with no automatic duplicate creation.
- **SC-003**: All launcher and tour controls are usable by keyboard, including pausing with Escape.
- **SC-004**: Every completion corresponds to a successful domain action or explicit finish of an informational/external-setup guide. Skips are recorded separately; failed actions never complete tasks.

## Assumptions

- Progress is per account in the current browser; cross-device synchronization is deferred.
- Tours are opt-in; existing welcome dialogs retain their existing behavior.
- Stream setup is self-confirmed because clipboard success does not prove playback in OBS.
- Existing access checks, plans, revision checks and clip data remain authoritative.
- Activation and paid-conversion impact will be measured after release; no uplift is claimed before an experiment.

## Test-First Specification Addendum

### Test Classification and Applicability Matrix

All US/FR/EC/SC sources require TDD, BDD and ATDD evidence. Browser scenarios own shared BDD/ATDD evidence because the performed action and resulting saved state are both the behavioral example and acceptance boundary. See [test-traceability.md](test-traceability.md) for individual mappings and [tdd/test-list.md](tdd/test-list.md) for implementation inventory. No practice is N/A.

### BDD and ATDD Evidence

Gherkin scenarios live in `test/bdd/features/user-tour/guide.feature`; browser bindings own execution once for both evidence roles. Each scenario has a stable scenario-level ID; all outline examples are enumerated.

## Approved UX revision (2026-10-25)

The checklist opens on first use. Spotlight journeys remain user-initiated so consent and current work are not interrupted. The corner launcher uses a HeroUI progress bar; Sentry feedback shares the right-side dock above it, and chat remains on the left. Consent banners/preferences suspend guide interaction.

Each row has a HeroUI checkbox with explicit skip confirmation and undo. Persist skipped IDs separately from successful actions, and show in-progress status on the task itself. Clicking an in-progress row continues at its current step; there is no separate Resume guide action.

Creation starts at the real Add Overlay button, even if dashboard discovery found an existing overlay. Explicitly opening an existing editor can select it. Saving a name does not implicitly bypass source/filter education. Highlight source choice and the complete filters area separately. A successful task opens a handoff with a next-task action. Keep ordinary Save controls and their disabled behavior unchanged; unchanged defaults can be acknowledged or skipped inside the guide only.

Appearance first highlights Customize Overlay Style, then follows the user's real click to Theme Studio. Copying highlights the copy button, followed by separate Browser Source instructions. Finishing these instructions is self-reported guide completion, not telemetry claiming successful external installation.

- **FR-012**: Optional website journey teaches selecting a player, copying its public iframe code and installing it externally. Optional exploration introduces real Galleries tab, website tools and help/reporting without changing consent choices. No external installation verification is claimed.

### User Story 4 - Discover website installation and help (Priority: P2)

Use the public website tool rather than sharing an OBS secret. Discover galleries, tools and support separately from activation. BDD and ATDD share one browser execution owner. Acceptance: website copy advances only after clipboard success; gallery intro uses the actual tab; support explains functionality consent without granting it. Cases BDD-TOUR-US4-030 through 032 own these journeys. Cases 027 through 029 own default visibility, checkbox skipping and source/filter handoff.

First-use visibility applies to the dashboard welcome panel. Entering an editor without an active tour minimizes it to preserve access to normal controls. Task handoffs and paused guides remain explicit. Expected preview/clip-picker dialogs temporarily own focus and interaction; closing them restores the running pointer, while unexpected dialogs pause with recovery.
