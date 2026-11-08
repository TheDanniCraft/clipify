# Saved-stream workspace follow-up

## Job and scope

A creator finds a past stream, reviews its clip moments, applies duration/view rules and exports all matches. Target: Streams list, stream detail, the shared inventory's stream-specific mode and the Automations sidebar placement. Keep HeroUI/HeroUI Pro, Clipify tokens, existing routes/permissions, explicit Apply filters, untouched Original files and the existing export-settings/queue flow. Clip layouts remain a reusable resource under Create and share; account-wide Brand styling remains in Settings.

## Reference review

The initially returned public Twitch video-page reference was rejected by the user and is not the layout authority. Subsequent Mobbin creator-dashboard searches returned Stream Manager, rewards, drops and roles, but not the requested past-stream list. Do not claim those are Video Producer screenshots. The compact thumbnail/title/date/duration/statistics rows follow the user's explicit description and the existing HeroUI table.

Inspected [Twitch creator-dashboard stream manager](https://mobbin.com/screens/f74cabe3-7a94-43ce-a524-f4f43d80cbef) and [creator-dashboard drops list](https://mobbin.com/screens/506c3457-549d-45ae-a655-02c4861a83a9) for the shared creator-dashboard context only. [Grain timestamped chapters](https://mobbin.com/screens/fb864718-3561-44ce-ad2f-d9f08260c370) is a structural example of chronological video navigation, not a streaming-data reference. Installed HeroUI Pro Timeline and HoverCard docs/types define the actual components. Twitch's [Get Clips reference](https://dev.twitch.tv/docs/api/reference/#get-clips) defines returned vod_offset as clip start; the different Create Clip From VOD input offset is an end position and is not used here.

## Moves and preservation

| User problem                                                       | Change                                                                                                                                             | What stays                                                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Missing thumbnails and title-only opening                          | Safe cached clip-thumbnail fallback for expired recordings; whole-row action via installed Table; explicit title link retained                     | Stream metadata, chronological order, pagination, auth and record retention                      |
| Horizontal strip does not explain moments/overlapping perspectives | Pro Timeline, visible representative thumbnail/time, most-viewed overlapping clip first, rich overview on hover/click and explicit preview actions | Exact clip identity and the established preview; unknown offsets remain unknown                  |
| Rule-based export is hard to discover                              | Duration/view fields exposed first in stream mode, explicit Apply retained, Export matching clips resolves every matching ID before confirmation   | Other inventory mode, selected-row exports, queue, quotas and output settings                    |
| Automations location                                               | Disabled Coming soon row moves into Tools                                                                                                          | No destination/page/search target; Clip layouts stays Create and share                           |
| Scattered demo dates are misleading                                | Three labelled estimated same-day Minecraft sessions replace the old dev demo                                                                      | Original clip fields/URLs/creation dates remain unchanged; no production or deployment-hook seed |

## Behavior and scale

Grouping requires at least half of the shorter video interval to overlap an existing fixed anchor. A fixed anchor prevents overlapping chains from merging a whole stream. Representatives sort by views then clip ID; all alternatives remain accessible. Unknown positions are separate entries shown by localized clip date. The detail receives all cached moments; the list/home preview retains its small metadata sample. Five timeline groups show initially; Show more reveals additional groups. Expired groups leave the active interval scan so a long stream does not require comparing every clip with all earlier clips. No video loads until preview is explicitly selected.

Only the known application-owned cached clip metadata supplies the fallback thumbnail; the existing public Twitch image URL validation remains unchanged. Failed images keep a stable icon placeholder. The stream action uses client routing for a stats-cell row action and preserves the title anchor for normal keyboard/link behavior. HeroUI's default table keyboard mode tabs through focusable links/cells, not the non-focusable tr itself.

The export settings snapshot is loaded from the current applied filters, with the existing request/selection epochs preventing stale filter results and revoked-account metadata from opening settings. Preparation failures keep the dialog closed and permit retry. No export starts before confirmation.

## Evidence

- Pure grouping expected Red: /tmp/clipify-stream-moments-red.log; Green: /tmp/clipify-stream-moments-green.log.
- Removed-recording thumbnail/full detail moments Red: /tmp/clipify-stream-thumbnails-red.log; Green: /tmp/clipify-stream-thumbnails-green.log.
- Sidebar grouping Red/Green: /tmp/clipify-automation-tools-{red,green}.log.
- Matching-export preparation Red/Green: /tmp/clipify-export-matches-{red,green}.log.
- Timeline/overview expected Red: /tmp/clipify-timeline-ui-red.log.
- Clean real-browser row-navigation Red and baseline: /tmp/clipify-streams-ux-outer-red-valid.log, /tmp/clipify-streams-ux-before-valid/. An earlier missing disposable root database run is setup failure, not credited as product Red.
- Whole affected owner checkpoint:149 tests /8 suites pass in /tmp/clipify-streams-final-owners.log. Scoped diagnostics cover these owners in /tmp/clipify-streams-ux-coverage.log; missing unrelated gallery owners make this diagnostic, not complete coverage evidence.
- Final exact-source browser/visual and full CI results are recorded in test-summary.md before readiness is claimed.

## Dev session reconstruction

Applied manually via authenticated Infisical CLI with explicit dev environment and project ID on 2026-11-07. A transaction restored five old demo-only associations, removed only the old labelled archive/backup, and associated31 clips across three same-Berlin-day/category groups with no gap over90 minutes and no group span over8 hours. Selected Minecraft dates/counts:2020-09-26(11),2020-10-03(13),2021-06-12(7). IDs999999999999546001–003. All source clip JSON hashes were checked unchanged before commit. The account-owned preview-session-demo:546 record keeps reversal metadata. Approximate offsets derive from clip creation times; they are not recovered VOD timestamps. Titles and durations explicitly identify estimates. No media was downloaded, fabricated or stored, and source availability was not asserted.

Visual checkpoint: `/tmp/clipify-streams-review/board.html` embeds the mobile list before/after images. Fixture timestamps/view totals and the input-context navigation icon differ between captures; those are not credited as visual improvements. There is no matching-data detail baseline, so the detail capture is an after-only review. Mobile timeline, controls and rule export were inspected from actual component screenshots. Compact duration/category metadata now uses separate wrapping flex items.

Final after-only detail/overview captures: /tmp/clipify-streams-final-journeys/. Both themes were inspected at390/1440px. The stronger final4 journeys pass after the reviewed container-width and popup-placement corrections. The earlier27 owner scenarios and8 responsive scenarios also pass; the final build includes TypeScript and patched-dependency validation. Exact-head CI is separate and required before merge.
