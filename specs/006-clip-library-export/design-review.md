# Dashboard design review

## Scope and preserve

A creator arrives to understand recent clip activity, open a stream or clip, select clips and download them. Apply supported improvements directly, as requested on2026-11-03. Keep Clipify branding/theme, HeroUI3.2.7 and installed HeroUI Pro, existing sidebar/search interactions, creator permissions, dates and factual metrics, all filters, selections, preview/export/recovery actions, guide anchors and resource routes. No new dependency, palette, font, chart data or automated publishing is introduced.

Targets: `CreatorOverview` and the selection/action region of `ClipInventory`. All other existing editor and shell behavior remains covered by its owning regressions. The before state is the implemented feature, captured with real installed components at390px/1440px in both themes. Authentication succeeded through the normal Mobbin OAuth flow; references below were returned by Mobbin and their images were inspected.

## References and selected direction

Choose an overview-first dashboard with grouped metrics, paired content panels and an inline contextual selection toolbar. References supply structure; Clipify supplies components, copy, colours and data.

- [SoundCloud Insights](https://mobbin.com/screens/81f4a402-c167-4470-ab5d-23a892be6a5a): reporting period beside the overview; related Top tracks/Top listeners panels share a row.
- [Buy Me a Coffee Home](https://mobbin.com/screens/d39e3c28-e4a6-4144-8e8a-8fa5cc5324bf): reporting period belongs with the metric and secondary tools follow the overview. Its payment information and visual branding are excluded.
- [Base44 Analytics](https://mobbin.com/screens/52f03ce9-acb4-4bc8-8a53-03b7e8054c96): related Page Traffic/Country panels share a row. This is structural evidence from a different domain, not a source of Clipify analytics or invented charts.
- [Synthesia Videos](https://mobbin.com/screens/815783c9-a00e-4be4-92c5-4a042c16b38a): selection count and bulk actions sit together above the selected library content.
- [Air selected assets](https://mobbin.com/screens/e213ec25-0d67-4977-b0e1-6d49141be0b3) and [Loom move dialog](https://mobbin.com/screens/dc53d6f1-2648-4184-b094-9adac27431b1) were inspected. The floating bottom action bar and move dialog are excluded; this pass takes Synthesia's inline direction.
- [Loom download flow](https://mobbin.com/flows/12ee283b-4ea1-4fd9-8923-333a56d37a57) was inspected across all three screens. Its extra sharing prompt is excluded; Clipify retains direct export and honest download-initiation feedback. [YouTube Downloads](https://mobbin.com/flows/043e0ddf-2c54-436d-acbc-6c35d2d81502) concerns offline viewing, so its automation is outside this feature.

## Move table

| Observed problem and job step                                                                                              | Reference decision                                                                               | Apply                                                                                                                                                  | Preserve                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Home starts with resource shortcuts before the requested clip overview; the reporting window is repeated inside one metric | SoundCloud and Buy Me a Coffee group period with the overview and place secondary tools after it | Lead with a visible clip-performance heading and the existing creation-window text; retain the two metric cards and place shortcuts after the overview | Counts, lifetime-view qualification, local dates, freshness and all shortcut/guide targets |
| Recent streams appear after the entire top-clip list on desktop                                                            | SoundCloud and Base44 place related content panels side by side                                  | Show Recent streams first and Top clips alongside it on desktop; stack streams before top clips on narrow screens                                      | Every existing stream/clip link, loading/empty/error/stale state and independent retry     |
| Selection count and selection actions are separated from Export selected                                                   | Synthesia groups selection count with bulk actions above content                                 | Group existing selection controls and export in one HeroUI Card; retain refresh controls next to the inventory                                         | Explicit cross-page selection, limits, cancellation, reconnect and failed-only retries     |

## Deferred observations

The mobile filter form takes substantial space before the clip table. No inspected reference demonstrated the exact replacement for all of Clipify's filter controls, so this pass does not invent an ungrounded accordion or remove a filter. Floating support/onboarding controls and existing account navigation are outside these target regions.

## Validation

The three moves are applied with existing HeroUI components. Real-component acceptance passed32/32 and core/guide BDD passed109/109 after the final build. Home and Inventory were inspected at390px/1440px in light and dark themes. Portable before/after HTML and PNG boards are available in the ignored `test-results/design-review/clipify-dashboard-review.zip`; these contain actual captures and measured region annotations, not redrawn screens. The complete application coverage checkpoint and CI are recorded separately in test-summary.md.
