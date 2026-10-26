# Guide state

`GuideProgress.version` is 2. Persist it as JSON in `user_content_states.state` with content key `clipify-user-tour:v2`, scoped by the existing `user_id` primary-key component. `state_until` stays null; account deletion removes the row through the existing foreign key. No new table is required; the badge enum expansion is described below.

Fields: allowed `completed` and `skipped` task IDs, selected overlay/playlist IDs, copied overlay ID, `minimized`, an optional validated `journeyId` for the last active section, and an optional active checkpoint. An active checkpoint has task, action index, paused flag, a bounded queue of navigation target IDs and its initial navigation count. Navigation and action progress are independent. Theme navigation has an explicit destination target, so returning to a saved styling action never ends at overlay settings. Existing records without a section ID infer it from the active task or recorded completion/skip order. Reads restore a checkpoint paused; explicit task activation resumes from the user's current page.

Version 1 completed/skipped IDs import once from the account's old browser key. `website.embed` migrates to the merged `explore.tools` task. Drop incompatible old action pointers. Allowlist and deduplicate IDs; completed tasks take precedence over skips. Bound resource IDs and navigation length. No names, URLs, secrets or media enter this state.

The authenticated action receives an expected account ID and a validated event, not a replacement snapshot. The repository initializes the account row if needed, locks it, applies the reducer and writes the result in one transaction. This preserves simultaneous updates. First-time records infer only known owned setup facts; they never infer preview, customization or external playback. Existing resources minimize the welcome panel. Later reads refresh owned IDs and recover deleted-resource pointers.

The provider applies events optimistically and sends them in order. Failed writes remain queued with Retry. Server state wins on a new session; browser storage clearing cannot restart onboarding. In-flight old-account events are rejected after account switching.

Retired duplicate task appearance.filters is no longer in the catalog. Its acknowledged completions migrate to overlay.source, while its optional skips are dropped. An active old filter checkpoint resumes as overlay.source at filter index 1 or save index 2. Preserve styling progress and keep section counts derived from the current catalog.

playlistClipsVersion=2 marks the expanded six-step clip flow. Older three-step indices 0/1/2 migrate to entry/arrangement/save indices 0/4/5. Modal checkpoints 1–3 reopen through clip-picker navigation when the picker is physically closed; Back to entry uses close-picker and observes actual closure. pickerOpen is a validated UI observation on start/resume/previous events, not an authorization flag. playlist.clips-added carries owner, playlist and bounded count and advances only the matching active task without completing it. This clip-picker expansion needs no database schema change.

playlistSource is a validated boolean observation associated with the selected overlay. Authenticated reads refresh it from the owned overlay’s saved type; client type-selection events update the current draft observation. It is not authorization or completion. Start/resume/arrival uses it to avoid an unavailable playlist selector, and false observations rewind an active playlist-use task to source. Wrong-account and unrelated-overlay events do not advance guidance.

## Welcome and completion recognition

Progress adds optional `welcomeSeen` and `expertAwardedAt` fields. Welcome start/dismiss events persist the account preference; existing active/completed/skipped progress migrates as already introduced. `welcome.start` begins the first unfinished core task.

Only the server persistence layer creates the first completion timestamp after every task ID from every journey is present in completed (currently 11 tasks). Skipped IDs do not count. The timestamp survives replay/restore and powers the automatic `completed-all-guides` badge condition. The catalog-derived PostgreSQL badge enum includes `clipify-expert`; the post-merge Generate Migrations workflow owns the enum migration. No generated migration is created in this branch.

The award policy is versioned independently as `expertAwardVersion=2`. Ignore unversioned core-only timestamps when reading progress or resolving member badges. Valid all-guides awards remain permanent during replay even if completion checkboxes are later restored. Icon changes do not alter the badge slug or PostgreSQL enum.

Terminal guide acknowledgements now add their task to completed and remove it from skipped. Only explicit task.skip creates a skipped record. The old skipOnFinish step flag is removed. No JSON schema, database schema or award-policy change is required; ambiguous pre-fix skipped entries are preserved until the user completes the guide again.
