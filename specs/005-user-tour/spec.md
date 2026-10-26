# Feature specification: Clipify guide

Branch: `feat/user-tour`. Current scope includes the user's final checklist, navigation and account-persistence requirements. Earlier implementation experiments are recorded only in the cycle/defect logs.

## User stories

1. **US1, P1: Learn the normal overlay workflow.** A new user creates and names an overlay, chooses clips and filters, previews it and follows OBS/Streamlabs setup instructions. A returning user can replay creation from Add Overlay. From another page, the guide teaches the Dashboard link, Overlays tab and real edit control. Starting a task never changes pages for the user.
2. **US2, P2: Customize an overlay.** The user opens the overlay, clicks Customize Overlay Style, edits a visible setting and uses the normal Save Style control. Keeping defaults records a skip.
3. **US3, P2: Build and use a playlist.** The user creates/names a playlist, selects/orders clips, saves and learns normal navigation back to an overlay to select the playlist.
4. **US4, P2: Explore Clipify.** A single optional section introduces galleries, public website installation through the actual avatar menu and Tools action, and existing report/chat controls.

BDD and ATDD share one browser execution owner per example. The 39 individually tagged examples in `test/bdd/features/user-tour/guide.feature` are canonical. Database concurrency/integrity has separate service-integration ownership; browser journeys are not duplicated as MCP workflows.

## Requirements

- **FR-001:** Show a compact first-use checklist and HeroUI progress ring. Keep Sentry feedback and chat in their original positions; the guide launcher sits above feedback. Remember minimization for the account.
- **FR-002:** Guide navigation through user clicks on normal controls. Replay of overlay creation highlights Add Overlay even when an overlay already exists. Never create a resource automatically. An edit icon is a normal, accessible app control outside the guide too.
- **FR-003:** Keep the four core tasks as one coherent flow. Successful actions advance to the next relevant task without a completion card or an extra Continue summary. Expected preview/clip dialogs temporarily own focus, then restore the pointer.
- **FR-004:** Appearance uses the real Customize Overlay Style entry point and normal Save control. Respect Pro availability and access locks.
- **FR-005:** Playlist creation, selection, order, save and overlay association follow successful owned-resource outcomes. Teach navigation between the playlist and overlay rather than moving pages for the user.
- **FR-006:** Store versioned account progress in PostgreSQL using `user_content_states` under an isolated key. Authenticate reads/writes, require the expected active account on writes, serialize events transactionally and retain queued events on transient failure. Browser clearing must not reset completion, skips or minimization. Import an account's old local state only once. Recognize existing owned setup and keep the welcome checklist minimized for existing accounts.
- **FR-007:** Recognize successful actions outside tours. Separate actual completions from manual skips. Do not infer preview, external installation or customization from resource existence alone.
- **FR-008:** Highlight the actual copy button. Clipboard success advances to external setup instructions; finishing instructions is self-reported guide completion, not verified OBS/website playback. Never put an OBS secret in public website installation code.
- **FR-009:** Use one expanded HeroUI accordion section, clickable task rows, indeterminate checkboxes for active tasks and a separate anchored skip-confirmation popover. Support cancel and undo. Remove status chips, replay/continue subtitles, completion cards, resource-chooser buttons, persistent support paragraphs and browser-storage footer copy. Do not use em dashes in guide copy. Preserve native control ARIA state, keyboard behavior and reduced-motion preferences.
- **FR-010:** Consent UI takes priority. Keep analytics limited to allowed journey/task identifiers. Support introductions point to existing widgets; clicking a support control pauses the spotlight so the normal UI can open and own focus.
- **FR-011:** Keep four sections: first overlay, appearance, playlist and Explore Clipify. Merge website/tools discovery into one task under Explore. Defer 24/7 onboarding.
- **FR-012:** Website setup teaches opening the app menu, choosing Tools, selecting a player and copying public iframe code. Galleries and support remain short, optional introductions.

## Edge cases

- **EC-001:** Failed creates/saves do not complete tasks; the app's normal Save label, disabled state and error handling remain authoritative.
- **EC-002:** Empty previews offer broader source/filter guidance and remain incomplete.
- **EC-003:** Missing controls, deleted resources and unrelated navigation pause with recovery through normal navigation. No automatic replacement or permanent chooser control.
- **EC-004:** Corrupt legacy cache and unavailable browser storage cannot override account state. Server write failure retains optimistic session state plus ordered retryable events and exposes Retry.
- **EC-005:** Clipboard denial leaves copy guidance active and cannot finish setup.
- **EC-006:** Replaying may point at creation, but creates nothing until the user explicitly clicks the normal Add control.
- **EC-007:** Account switching and foreign-owned resource reports cannot modify another account's progress. Account deletion cascades persisted state.

## Success criteria

- **SC-001:** The complete first-overlay path is reachable through real controls, with no programmatic page changes by the provider.
- **SC-002:** Account completion/skips/minimization survive browser clearing and reauthentication; existing users do not receive a fresh welcome popup just because they have no legacy guide record.
- **SC-003:** Ring/checklist/popover controls work on desktop, narrow screens and keyboard. Only one section expands at a time, and normal feedback/chat remain reachable.
- **SC-004:** Every completion maps to a successful action or explicit informational finish; skips stay distinct. All owning examples and required quality gates must pass before merge.
