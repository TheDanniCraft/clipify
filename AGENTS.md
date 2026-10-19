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

- Use plain lines of Gitmoji commit subjects, matching previous releases. Keep
  the emoji and concise imperative wording; do not add Markdown bullets, section
  headings, PR numbers, test results, deployment instructions, or explanatory
  paragraphs.
- Start from commits since the previous release. Combine related subjects into
  one clear line when helpful, remove duplicates and merge-only commits, and
  omit changes that are irrelevant to end users.
- Keep only changes included in the release target. Describe user-visible fixes
  or features clearly rather than exposing internal implementation details.
- Review recent published releases before writing notes. Do not use GitHub's
  generated release-note template.

Example:

```text
🐛 Fix OAuth sign-in across production and preview
💄 Refine team and authorization management
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

## Drizzle migration ownership (non-negotiable)

- On feature branches, edit `src/db/schema.ts`, `src/db/auth-schema.ts`, and
  `drizzle.config.ts` as needed, but do **not** run `drizzle-kit generate`, run
  `bun run db:generate`, or create/edit generated files under `drizzle/`.
- The `Generate Migrations` workflow owns ordinary migration generation after a
  completed pull request lands on `master`. It generates one migration from the
  final schema diff.
- `bun run db:push` is permitted only against the disposable development
  database through Infisical. Never use it against production.
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

# This is NOT the Next.js you know

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
- Return expected validation, plan restrictions, conflicts and missing prerequisites as typed action results with local actionable feedback. Do not report ordinary user denials as Sentry incidents. Internal transaction rollback exceptions must be translated at the action/API boundary.
- Acceptance for a changed user flow includes real installed components in a browser: first-run setup, success and failure recovery, permissions/upgrade behavior, keyboard/focus, and desktop/mobile layout. Inspect screenshots against the existing Clipify design in both themes. Mocked component tests, screenshot capture alone, and a no-overflow assertion do not establish acceptable UX.
