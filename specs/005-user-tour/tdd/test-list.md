# TDD Test List

- [x] TDD-001: Default catalog contains four bounded sections with independent task progress.
- [x] TDD-002: Strict parser rejects invalid JSON, primitive roots, unknown version, invalid step and malformed completed arrays.
- [x] TDD-003: Allowlist and deduplicate completion IDs; bound resource identifiers; reject unsafe routes.
- [x] TDD-004: Authenticated account storage; failed writes retain ordered retryable session events.
- [x] TDD-005: Existing accounts recognize saved resources without inferring preview or external installation.
- [x] TDD-006: Successful overlay save completes the current named or filter task; failed and foreign saves do not.
- [x] TDD-007: Nonempty preview completes preview; zero clips does not.
- [x] TDD-008: Successful copy enables explicit setup confirmation; copy alone and failed copy do not complete setup.
- [x] TDD-009: Successful visible theme save completes customization; unchanged defaults do not.
- [x] TDD-010: Playlist save requires valid name and nonempty clips; saved order and association are tracked.
- [x] TDD-011: Start/pause/resume/replay preserves progress and never initiates resource creation.
- [x] TDD-012: Unknown events and stale/unrelated resource events do not affect active task.
- [x] TDD-013: Ring launcher, one expanded section, quiet task rows and active indeterminate checkbox.
- [x] TDD-014: Keyboard start, Escape pause and focus restoration.
- [x] TDD-015: Spotlight waits for real target, positions with Driver, permits real interaction and cleans up on unmount.
- [x] TDD-016: Action-step advancement waits for success; informational Next cannot complete a domain task.
- [x] TDD-017: Missing target/modal interference/unrelated navigation pauses with recovery.
- [x] TDD-018: Database reload restores active task paused; clearing browser storage retains progress and account switching cannot leak state.
- [x] TDD-019: Analytics include only allowed journey/task identifiers.
- [x] TDD-020: Existing page integration reports only successful owner-scoped mutations and clipboard outcomes.

- [x] TDD-021: Replay naming starts at Add Overlay; resume naming preserves its editor checkpoint.
- [x] TDD-022: Navigation observes real links, menus, tabs and edit controls without automatic router jumps.
- [x] TDD-023: Skip uses a portal popover, cancellation preserves state and confirmation remains distinct from domain completion.
- [x] TDD-024: Account writes validate ownership and serialize concurrent events with row locking.
- [x] TDD-025: Native menu ARIA, report-widget focus and expected dialogs survive spotlight cleanup.

- [x] TDD-026: Starting in Theme Studio stays there; resuming Save from elsewhere teaches Customize then restores the same action.
- [x] TDD-027: Save-step Back reviews settings without resetting or completing the task.
- [x] TDD-028: Persist the current section and display its count after completion/reload.
- [x] TDD-029: Optional filters precede styling and defaults remain a skip.
