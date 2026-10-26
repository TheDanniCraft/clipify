# Guide state

`GuideProgress.version` is 2. Persist it as JSON in `user_content_states.state` with content key `clipify-user-tour:v2`, scoped by the existing `user_id` primary-key component. `state_until` stays null; account deletion removes the row through the existing foreign key. No schema migration is required.

Fields: allowed `completed` and `skipped` task IDs, selected overlay/playlist IDs, copied overlay ID, `minimized`, an optional validated `journeyId` for the last active section, and an optional active checkpoint. An active checkpoint has task, action index, paused flag, a bounded queue of navigation target IDs and its initial navigation count. Navigation and action progress are independent. Theme navigation has an explicit destination target, so returning to a saved styling action never ends at overlay settings. Existing records without a section ID infer it from the active task or recorded completion/skip order. Reads restore a checkpoint paused; explicit task activation resumes from the user's current page.

Version 1 completed/skipped IDs import once from the account's old browser key. `website.embed` migrates to the merged `explore.tools` task. Drop incompatible old action pointers. Allowlist and deduplicate IDs; completed tasks take precedence over skips. Bound resource IDs and navigation length. No names, URLs, secrets or media enter this state.

The authenticated action receives an expected account ID and a validated event, not a replacement snapshot. The repository initializes the account row if needed, locks it, applies the reducer and writes the result in one transaction. This preserves simultaneous updates. First-time records infer only known owned setup facts; they never infer preview, customization or external playback. Existing resources minimize the welcome panel. Later reads refresh owned IDs and recover deleted-resource pointers.

The provider applies events optimistically and sends them in order. Failed writes remain queued with Retry. Server state wins on a new session; browser storage clearing cannot restart onboarding. In-flight old-account events are rejected after account switching.

Retired duplicate task appearance.filters is no longer in the catalog. Its acknowledged completions migrate to overlay.source, while its optional skips are dropped. An active old filter checkpoint resumes as overlay.source at filter index 1 or save index 2. Preserve styling progress and keep section counts derived from the current catalog.
