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

The badge catalog adds an automatic `clipify-expert` enum value. Include the catalog in the existing post-merge migration workflow’s path filter; do not generate migrations on this branch. No new table or Drizzle configuration is required. Reuse the existing `user_content_states` table, whose account/key primary key and user foreign key already cover this preference. Browser storage is a one-time legacy import source, not durable authority. Store only allowed task/navigation IDs, resource IDs and UI/checkpoint state. Never store URLs, secrets or clip contents.

## Verification

Run affected whole-file Jest suites without coverage. Database integration belongs in the existing database lane at `test/mcp/integration/user-tour-progress.test.ts`, using a separate disposable loopback database per case. Genuine browser flows have one BDD/ATDD owner and their own application server/database. Run all 52 examples and inspect desktop/mobile screenshots, ring placement, native widgets, actual navigation and popover focus. Then verify full lint, explicit feature-owned formatting, types and both builds.

Complete merge coverage/Test and dependency-security gates remain mandatory. Draft CI is scoped feedback, not merge evidence. Do not generate migrations or alter thresholds, hooks or the user's untracked configuration.

## Welcome and earned badge

DashboardContentHost is rendered within the guide provider so the trial welcome can offer Start guided tour and Maybe later. A generic welcome covers accounts without a pending trial message. Preserve modal state while consent temporarily takes priority. The welcome decision is stored with account progress, and starting selects the first unfinished core task without routing programmatically.

The server latches expertAwardedAt when every task in every guide section is completed. Version the award policy with expertAwardVersion=2 so old core-only timestamps cannot grant Expert. The automatic badge resolver reads this timestamp from the existing content-state row, so the member card, public profile and creator page share the ordinary badge registry with a graduation-cap icon. No separate badge table write or email is required. Successful server acknowledgement triggers a single toast in the current session.

Guided current/default confirmations finish a guide without claiming native settings were saved. Explicit checklist skips remain excluded from Expert. Show real Expert completion separately from handled section counts and label skipped rows. Preserve legacy skipped records until replay; there is no evidence to distinguish historical explicit skips from the earlier confirmation bug.
