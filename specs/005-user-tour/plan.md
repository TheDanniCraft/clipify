# Implementation plan: Clipify guide

Use a native React/HeroUI checklist and a lazy Driver.js adapter. The checklist is an action launcher, not another help panel. Reference the concise task/action pattern in Usertour and Userflow; record source links in research.md.

## Architecture

- `src/app/lib/userTour.ts`: version 2 progress parser, validated events, four-section catalog, navigation queues separate from action checkpoints, automatic within-journey continuation and legacy task migration.
- `src/app/components/user-tour/provider.tsx`: HeroUI Accordion, Checkbox, Popover and ProgressCircle; server-supplied snapshot; optimistic state with ordered retryable server-action queue. No router calls. Observe the actual page after user navigation. Indeterminate checkbox is the active-state cue; replay is a row action with an icon, not extra prose.
- `src/app/components/user-tour/spotlight.tsx`: target rendering and observation; selected tabs and revealed menus drive action advancement. Preserve native control ARIA around Driver annotations. Allow expected dialogs to suspend/restore a pointer, avoid false missing-target pauses during route transitions, and yield focus to popovers and support widgets.
- `src/app/actions/userTour.ts`: authenticated action boundary. Reads/writes require the expected current account; event validation rejects unknown or foreign-owned updates.
- `src/server/user-tour/progress.ts`: store JSON state in the existing account content-state row under `clipify-user-tour:v2`. Use a transaction and row lock for read/transition/write so simultaneous device updates are not lost. Resolve owned resources on read, recognize existing setup once, and use the existing account-deletion cascade.
- Dashboard layout loads the authoritative snapshot through the action boundary. Normal Dashboard logo navigation uses Next Link; real edit buttons and menu items expose stable targets. Create/save/copy handlers retain their ordinary behavior and report only successful outcomes.

## Data and migrations

No schema, Drizzle configuration or generated migration changes. Reuse the existing `user_content_states` table, whose account/key primary key and user foreign key already cover this preference. Browser storage is a one-time legacy import source, not durable authority. Store only allowed task/navigation IDs, resource IDs and UI/checkpoint state. Never store URLs, secrets or clip contents.

## Verification

Run affected whole-file Jest suites without coverage. Database integration belongs in the existing database lane at `test/mcp/integration/user-tour-progress.test.ts`, using a separate disposable loopback database per case. Genuine browser flows have one BDD/ATDD owner and their own application server/database. Run all 47 examples and inspect desktop/mobile screenshots, ring placement, native widgets, actual navigation and popover focus. Then verify full lint, explicit feature-owned formatting, types and both builds.

Complete merge coverage/Test and dependency-security gates remain mandatory. Draft CI is scoped feedback, not merge evidence. Do not generate migrations or alter thresholds, hooks or the user's untracked configuration.
