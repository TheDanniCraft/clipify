# Test traceability

Each scenario has one browser execution owner and a disposable loopback database. The current registry contains 51 examples. See [validation evidence](test-summary.md) for full-run and targeted rerun results.

| ID               | Behavior                                                   | Owner       | Scope                         |
| ---------------- | ---------------------------------------------------------- | ----------- | ----------------------------- |
| BDD-TOUR-US1-001 | Open and minimize the guide                                | Browser BDD | Current revision              |
| BDD-TOUR-US1-002 | Follow real overlay actions                                | Browser BDD | Current revision              |
| BDD-TOUR-US1-003 | Preview available clips                                    | Browser BDD | Current revision              |
| BDD-TOUR-US1-004 | Recover from empty clips                                   | Browser BDD | Current revision              |
| BDD-TOUR-US1-005 | Confirm external installation                              | Browser BDD | Current revision              |
| BDD-TOUR-US1-006 | Retry a denied clipboard write                             | Browser BDD | Current revision              |
| BDD-TOUR-US1-007 | Retry failed creation                                      | Browser BDD | Current revision              |
| BDD-TOUR-US1-008 | Retry a failed save                                        | Browser BDD | Current revision              |
| BDD-TOUR-US1-009 | Pause and resume after reload                              | Browser BDD | Current revision              |
| BDD-TOUR-US1-010 | Recover from a missing target                              | Browser BDD | Current revision              |
| BDD-TOUR-US1-011 | Recover from malformed storage                             | Browser BDD | Current revision              |
| BDD-TOUR-US1-012 | Recover from unavailable storage                           | Browser BDD | Current revision              |
| BDD-TOUR-US1-013 | Keep accounts isolated                                     | Browser BDD | Current revision              |
| BDD-TOUR-US1-014 | Use the guide by keyboard                                  | Browser BDD | Current revision              |
| BDD-TOUR-US1-015 | Recognize independent actions                              | Browser BDD | Current revision              |
| BDD-TOUR-US1-016 | Protect private data in analytics                          | Browser BDD | Current revision              |
| BDD-TOUR-US1-017 | Keep initial scope bounded                                 | Browser BDD | Current revision              |
| BDD-TOUR-US2-018 | Save an appearance change                                  | Browser BDD | Current revision              |
| BDD-TOUR-US2-019 | Keep the default appearance                                | Browser BDD | Current revision              |
| BDD-TOUR-US3-020 | Create and populate a playlist                             | Browser BDD | Current revision              |
| BDD-TOUR-US3-021 | Save a playlist order                                      | Browser BDD | Current revision              |
| BDD-TOUR-US3-022 | Use the playlist in an overlay                             | Browser BDD | Current revision              |
| BDD-TOUR-US3-023 | Replay without creating duplicates                         | Browser BDD | Current revision              |
| BDD-TOUR-US1-024 | Use the guide on a narrow screen                           | Browser BDD | Current revision              |
| BDD-TOUR-US1-025 | Choose a replacement for a deleted overlay                 | Browser BDD | Current revision              |
| BDD-TOUR-US2-026 | Explain unavailable theme customization                    | Browser BDD | Current revision              |
| BDD-TOUR-US1-027 | Show the checklist in the corner by default                | Browser BDD | Current revision              |
| BDD-TOUR-US1-028 | Skip and restore a task with the real checkbox             | Browser BDD | Current revision              |
| BDD-TOUR-US1-029 | Continue from creation through source and filters          | Browser BDD | Current revision              |
| BDD-TOUR-US4-030 | Install the public website player                          | Browser BDD | Current revision              |
| BDD-TOUR-US4-031 | Discover galleries through the real tab                    | Browser BDD | Current revision              |
| BDD-TOUR-US4-032 | Find tools and support without changing consent            | Browser BDD | Current revision              |
| BDD-TOUR-US1-033 | Keep account progress after browser data is cleared        | Browser BDD | Current revision              |
| BDD-TOUR-US1-034 | Expand only one section at a time                          | Browser BDD | Current revision              |
| BDD-TOUR-US1-035 | Replay overlay creation from its real entry point          | Browser BDD | Current revision              |
| BDD-TOUR-US1-036 | Recognize an existing account without nagging              | Browser BDD | Current revision              |
| BDD-TOUR-US1-037 | Learn how to access an overlay from another page           | Browser BDD | Current revision              |
| BDD-TOUR-US1-038 | Confirm skipping an active task in a popover               | Browser BDD | Current revision              |
| BDD-TOUR-US4-039 | Keep the report widget usable from its introduction        | Browser BDD | Current revision              |
| BDD-TOUR-US2-040 | Resume styling through its real entry point                | Browser BDD | Personalization refinement    |
| BDD-TOUR-US2-041 | Keep personalization focused on appearance                 | Browser BDD | Personalization refinement    |
| BDD-TOUR-US1-042 | Keep dropdowns above a continuously dimmed tour            | Browser BDD | Layering and section progress |
| BDD-TOUR-US1-043 | Review clip settings with HeroUI guide controls            | Browser BDD | Universal Back and percent    |
| BDD-TOUR-US2-044 | Go back across the Theme Studio entry                      | Browser BDD | Universal Back and percent    |
| BDD-TOUR-US3-045 | Guide selection across clip picker pages                   | Browser BDD | Guided modal                  |
| BDD-TOUR-US3-046 | Resume a cancelled clip picker checkpoint                  | Browser BDD | Guided modal                  |
| BDD-TOUR-US3-047 | Follow the actual overlay source type in playlist guidance | Browser BDD | Source-type recovery          |

| BDD-TOUR-US1-048 | Start the journey from the existing trial welcome | Browser BDD | Welcome integration |
| BDD-TOUR-US1-049 | Defer the welcome without repeat prompts | Browser BDD | Account preference |
| BDD-TOUR-US1-050 | Earn and retain Expert after every guide | Browser BDD | All-guide completion |

| BDD-TOUR-US1-051 | Complete guided defaults from eight-completed/three-skipped state | Browser BDD | Confirmation and skip semantics |

Unit and component suites cover the reducer, authenticated event boundary, native spotlight integration, rendering, focus and retry. Ten PostgreSQL integration cases cover durable state, concurrent writes, ownership, paused checkpoints and existing accounts.
