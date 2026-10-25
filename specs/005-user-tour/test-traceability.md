# Test Traceability: User tours

[Spec](spec.md) · [Plan](plan.md) · [Cycle log](tdd/cycle-log.md) · [Summary](test-summary.md)

Current scope is the approved UX revision, not the first 26-case candidate. Each browser example owns both BDD and ATDD evidence once, using a case-owned disposable loopback database and application server. No duplicate MCP/browser execution is claimed.

## Scenario registry

| ID               | Observable behavior                               | Owner             | Current evidence                   |
| ---------------- | ------------------------------------------------- | ----------------- | ---------------------------------- |
| BDD-TOUR-US1-001 | Open and minimize the guide                       | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-002 | Follow real overlay actions                       | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-003 | Preview available clips                           | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-004 | Recover from empty clips                          | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-005 | Confirm external installation                     | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-006 | Retry a denied clipboard write                    | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-007 | Retry failed creation                             | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-008 | Retry a failed save                               | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-009 | Pause and resume after reload                     | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-010 | Recover from a missing target                     | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-011 | Recover from malformed storage                    | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-012 | Recover from unavailable storage                  | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-013 | Keep accounts isolated                            | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-014 | Use the guide by keyboard                         | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-015 | Recognize independent actions                     | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-016 | Protect private data in analytics                 | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-017 | Keep initial scope bounded                        | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US2-018 | Save an appearance change                         | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US2-019 | Keep the default appearance                       | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US3-020 | Create and populate a playlist                    | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US3-021 | Save a playlist order                             | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US3-022 | Use the playlist in an overlay                    | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US3-023 | Replay without creating duplicates                | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-024 | Use the guide on a narrow screen                  | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-025 | Choose a replacement for a deleted overlay        | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US2-026 | Explain unavailable theme customization           | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-027 | Show the checklist in the corner by default       | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-028 | Skip and restore a task with the real checkbox    | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US1-029 | Continue from creation through source and filters | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US4-030 | Install the public website player                 | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US4-031 | Discover galleries through the real tab           | BDD + shared ATDD | Green · final complete 32/32 sweep |
| BDD-TOUR-US4-032 | Find tools and support without changing consent   | BDD + shared ATDD | Green · final complete 32/32 sweep |

## Quality gates

- State/provider/adapter/editor regression suites: run `bun run test:affected f6efa1c6`; 17 suites / 448 tests passed.
- Browser: `MCP_TEST_DATABASE_URL=<disposable-loopback-admin> bunx playwright test --project=bdd-chromium .features-gen/bdd/user-tour --workers=2`; all 32 owning scenarios passed in one final complete sweep (5.5 minutes).
- E2E build and TypeScript: final E2E and standalone production builds passed; their TypeScript checks passed.
- Lint: final full lint passes with zero errors and five unrelated existing warnings.
- Formatting: explicit feature-owned inventory passes; preserve the pre-existing untracked .infisical.yaml.
- Full coverage/Test: pending before merge. Draft feedback is not the full merge gate.
- Dependency audit: original branch and first candidate both contain the same three existing high advisories (follow-redirects and transitive zod); no dependency changes in this revision. No exception is claimed.

## Behavioral coverage

The state tests cover validated browser persistence, foreign ownership, action-success rules, safe routes, explicit Add Overlay entry, handoffs and independent skips. Provider tests cover first-use visibility, pause/reload/account isolation, skip confirmation/undo, direct in-place resume, safe analytics, asynchronous previews and consent preferences. Adapter tests cover real targets, access-locked interaction, reduced motion, missing/late targets, native popovers, Escape and application modals. Editor suites preserve normal save behavior and success-only reports. The browser registry above owns installed HeroUI interactions and cross-page flows. External OBS/website installation remains self-reported guide completion; no device/site verification is claimed.
