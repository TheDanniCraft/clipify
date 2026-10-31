Gitmoji Guide for AI Assistants
Purpose

This guide helps AI assistants understand and use gitmoji convention when creating commits. Using emojis on commit messages provides an easy way of identifying the purpose or intention of a commit with only looking at the emojis used. Gitmoji use emojis to make commit messages more expressive and easier to understand at a glance.
Repository Convention

A commit message is composed using the following pieces:

    intention: The intention you want to express with the commit, using one Unicode emoji from the gitmoji list.
    message: A brief, natural-language explanation of the change in imperative mood.

Format

<intention> <imperative message>

[optional body]

Do not add Conventional Commit prefixes or scopes such as `feat:`, `fix:`, `docs:`, `refactor:`, or `chore:`. Match the repository's existing history: after the emoji, begin directly with a capitalized action verb such as `Add`, `Fix`, `Refine`, `Move`, `Show`, `Guard`, `Bump`, or `Resolve`.

Gitmoji reference

Fetch all available gitmojis from: https://gitmoji.dev/api/gitmojis.
Usage Guidelines for AI
Selecting the correct emoji

    Identify the primary purpose of the commit
    Choose the most specific emoji that matches the change
    Use only one emoji per commit for clarity
    Prioritize by impact: Breaking changes (💥) > Features (✨) > Fixes (🐛) > Refactoring (♻️)

Examples

✨ Add user authentication system

Implement JWT-based authentication with login and registration endpoints.
Closes #123

🐛 Resolve null pointer exception in user service

Added null check before accessing user properties to prevent crashes.

📝 Update installation instructions

Added step-by-step guide for setting up the development environment.

⚡️ Optimize user query with indexing

Reduced query time from 500ms to 50ms by adding composite index.

💥 Update API response format to REST specification

All API endpoints now return data in a standardized envelope format.
Clients must update their response parsing logic.

Best Practices

    Be atomic: One emoji, one purpose, one commit
    Write clear subjects: Keep under 60 characters, imperative mood
    Use the body: Explain "why" not "what" for complex changes
    Reference issues: Include issue numbers when applicable
    Indicate breaking changes: Use 💥 :boom:.

Resources

    Gitmojis list: https://gitmoji.dev/api/gitmojis
    Gitmoji website: https://gitmoji.dev/
    Gitmoji specification: https://gitmoji.dev/specification

## Release notes

Release notes appear on the Clipify website and are written for end users.

- Write plain lines of concise, end-user change summaries. Do not copy Gitmoji
  commit subjects verbatim. Omit emojis, Markdown bullets, section headings,
  PR numbers, test results, deployment instructions and implementation detail.
- Start from pull requests squash-merged since the previous release and included
  in the release target. Review each PR's final description and diff, and consult
  its original commits when needed: one squash subject can hide several distinct
  user-visible improvements. A PR can contribute more than one release-note line.
- Combine related outcomes, remove duplicates, and omit changes irrelevant to end
  users. Describe only behavior actually included in the release target.
- Review recent published releases for product context. Do not use GitHub's
  generated release-note template. This plain-text policy applies to new releases;
  do not rewrite previously published notes unless explicitly requested.
- Commit messages and squash PR titles still follow the Gitmoji convention above;
  release notes are a separate editorial artifact.

Example:

```text
Fix account access and deployment recovery
Keep connected AI apps authorized between sessions
Add advanced Runner ingest settings
```

## Local test prerequisites

- Before a local full-suite, native MCP workflow or browser baseline, follow
  [docs/local-testing.md](docs/local-testing.md). Verify disposable loopback
  PostgreSQL is accepting connections, set a job-owned `MCP_TEST_TEMPLATE_ID`,
  and install Chromium with its operating-system dependencies.
- Environment exports do not persist between terminals or agent shell calls.
  Reapply the documented test environment for each execution; never substitute
  production or shared development credentials.
- Compare the exact owning CI job and environment before treating a local
  prerequisite failure as a code regression. Missing services or browser
  libraries are blocked setup evidence, not an intended product-test Red.

## Test execution and pull requests

- Follow the canonical [validation strategy](docs/local-testing.md#validation-strategy):
  smallest sufficient test boundary, one execution owner, duration-planned independent
  shards, and strict merged evidence before squash merge.

- Open new pull requests as drafts by default. Draft CI provides scoped feedback;
  it does not satisfy the required full Test gate. Mark ready only at the final
  review checkpoint; `ready_for_review` triggers complete validation.
- During development, run the changed behavior's whole-file tests without
  coverage. At a completed slice, run complete affected suites and the relevant
  browser scenarios. Do not repeat unchanged successful checks without a reason.
- Full coverage, all owning scenarios, lint, formatting, type checks and build
  remain mandatory before merge. Independent coverage lanes produce one merged
  report with unchanged thresholds; missing or foreign evidence fails the gate.
- MCP workflow scenarios have one execution owner for both BDD and coverage.
  Genuine browser journeys remain browser-owned; do not duplicate evidence merely
  to attach another practice label.
- Tests use disposable loopback databases. Schema-template cloning may accelerate
  setup, but every case retains its own database and job-owned templates are
  removed. Production and shared development data are never test fixtures.
- Master keeps complete validation unless identical tested source and execution
  inputs are verified. A prior successful head SHA alone is insufficient evidence.

## Push checkpoints

- Do not push an intentionally failing TDD Red. Keep Red/Green cycles local and
  push only after the affected whole-file tests pass.
- During development, run the affected whole-file tests without coverage and the
  relevant browser journeys. Keep the failing Red local. Expensive complete suites,
  coverage, type checking and platform validation belong to GitHub's required gate;
  a developer laptop is not required to repeat that gate before a push.
- Select local tests from changed behavior and its callers, including subprocess
  probes, shared fixtures and BDD bindings; changed test filenames alone are not
  a dependency map. Use the [local selection rules](docs/local-testing.md#select-local-tests)
  and expand only for a concrete unresolved boundary or failure.
- Do not start a full local suite or coverage owner merely because a slice is
  ready to push. Reserve that for an explicit request, reproducing a CI failure,
  or shared execution changes whose impact cannot be bounded to affected owners.
- Local hooks retain the migration guard and fast staged-file checks. The pre-push
  hook reports where validation runs; it does not execute application suites.
- Draft PRs provide scoped feedback. Mark ready only when affected checks pass;
  complete CI validation with unchanged thresholds is mandatory before merge.
- Merge PRs with squash only. The PR title must follow the Gitmoji commit convention;
  the required title check also runs on title edits without restarting full CI.
- Never bypass a failed hook or lower thresholds to push. Fix the failure or report
  the specific unavailable prerequisite. Do not repeatedly push speculative fixes
  and cancel the validation checkpoint before its final gate finishes.
- Use measured-work CI planning without artificial job ceilings; preserve complete
  scenario inventories, and report slow groups and queue/setup/test time. A timing cache is scheduling
  data, never passing test evidence. Split files only for verified independent fixtures.
- Report local checks, platform-specific checks and the final CI gate separately.
  Windows process/update/capture changes need real Windows validation; a Linux
  test run or Linux Docker host cannot establish Windows behavior.

## Drizzle migration ownership (non-negotiable)

- On feature branches, edit `src/db/schema.ts`, `src/db/auth-schema.ts`, and
  `drizzle.config.ts` as needed, but do **not** run `drizzle-kit generate`, run
  `bun run db:generate`, or create/edit generated files under `drizzle/`.
- The `Generate Migrations` workflow owns ordinary migration generation after a
  completed pull request lands on `master`. It generates one migration from the
  final schema diff.
- Development and preview databases are synchronized only by an explicit
  operator-run `bun run db:push` through Infisical. Preview container startup
  must never run `drizzle-kit push`, `drizzle-kit migrate`, or any equivalent
  automatic schema mutation.
- Production releases apply the generated migrations committed after merge.
  Never use `db:push` against production, and never use production migrations
  to synchronize a feature branch's preview database before those migrations
  have been generated from `master`.
- The sole CI exception is `bun run db:push:e2e`, which is guarded to run only
  in GitHub Actions job `browser-tests` against PostgreSQL on loopback, database
  and user `clipify_e2e`, with `CLIPIFY_E2E_SCHEMA_PUSH=1`. It must never accept
  a remote host or persistent database.
- A manual/custom migration is allowed only when Drizzle cannot express the
  required database behavior and the user explicitly authorizes that exact
  migration. Stop and explain the unsupported behavior before creating it.
- Never set `CLIPIFY_MANUAL_MIGRATION_APPROVED` or bypass the migration guard on
  your own. The override is a human approval mechanism, not an agent workaround.
- Never edit, remove, or bypass `.husky/pre-commit` or
  `scripts/check-drizzle-migration-policy.mjs` to make a commit pass.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Product UI and UX

- Use the installed HeroUI and HeroUI Pro components for visible controls. Read their installed API and official examples before composing them. Prefer the library's date/time pickers, select/multiselect, DropZone, color controls and Agenda compound components over hand-styled native substitutes. Native elements inside library components and hidden form inputs are expected.
- Reuse Clipify's existing editor, dialog, preview, color-picker and layout patterns. Extract shared components from established screens when necessary; do not create a separate visual language for each feature.
- Standard resource editors use `DashboardEditorLayout`, matching the overlay/gallery width and gutters. Keep Back, the resource heading and contextual actions together in `Card.Header`; use the full available header width on mobile.
- Use `variant='secondary'` on supported field controls placed on cards or equivalent surfaces. Follow current theme tokens, consistent widths, spacing and responsive layout. Review light and dark themes.
- Keep controls close to their prerequisites: provide inline create/manage actions for empty selectors, explain a missing prerequisite at the relevant field, and preserve drafts after failures. Disable actions only for a clear temporary or incompatible state. Paid locks should open the existing upgrade flow without changing or saving an unavailable value.
- Use coherent editor sections or modes, with focused modals for secondary editing. Avoid long stacks of unrelated cards, duplicate headings, scattered save buttons, and permanent empty previews. Keep previews stable while editing; do not reload an iframe on every keystroke.
- Write UI copy for the user's action or outcome. Keep internal policy, storage, architecture and implementation rationale out of normal screens. Put plan comparisons on pricing surfaces. Do not use middle-dot separators as decorative copy formatting.
- Default dates and schedules to the user's local or saved timezone and use that selection consistently in calendar views and event forms. Provide accessible names, keyboard operation, visible focus, loading, empty, error and retry states.
- Format browser-visible dates through the shared LocalizedDate component and dateFormat utilities, using the user's browser locale consistently with HeroUI date pickers. Preserve date-only calendar days and explicit saved timezones. Keep ISO values for storage, APIs and form transport; do not hard-code US/UK display formats.
- Return expected validation, plan restrictions, conflicts and missing prerequisites as typed action results with local actionable feedback. Do not report ordinary user denials as Sentry incidents. Internal transaction rollback exceptions must be translated at the action/API boundary.
- Acceptance for a changed user flow includes real installed components in a browser: first-run setup, success and failure recovery, permissions/upgrade behavior, keyboard/focus, and desktop/mobile layout. Inspect screenshots against the existing Clipify design in both themes. Mocked component tests, screenshot capture alone, and a no-overflow assertion do not establish acceptable UX.
