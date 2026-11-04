---
feature: 006-clip-library-export
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 15
planned_at: b6c8e591
updated_at: b6c8e591
suite_baseline: green
---

# Test List: Creator Dashboard and Clip Export

## Outer loop: acceptance behaviors

One row per numbered acceptance criterion, in spec order. Browser BDD owns executable evidence once and supplies BDD+ATDD roles. The four story feature files and shared bindings now exist;48 core examples have passed in a prior checkpoint, with a fresh current-source run in progress. Additional real-component layout/recovery/editor acceptance has passed30/30. The rows below retain original planning identities; PENDING means that the full declared criterion or its test-first evidence has not yet been reconciled, not that the product implementation is absent. Consult test-summary.md, test-traceability.md and cycle-log.md for actual owners, executions and explicit ordering gaps. Do not claim a planned181-example matrix passed from the smaller executed set.

| id  | behavior                                                                           | traces                                                                                | kind    | state   | test                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | A creator opens Home and can navigate all permitted working destinations           | US1-AC1; BDD-US1-001, BDD-US1-007                                                     | example | PENDING | Planned: `test/bdd/features/clip-library/us1.feature`; `test/bdd/steps/clip-library.steps.ts`                                                                |
| A2  | A bookmarked editor retains its resource, actions and unsaved-change recovery      | US1-AC2; BDD-US1-002                                                                  | example | PENDING | Planned: `test/bdd/features/clip-library/us1.feature`; `test/bdd/steps/clip-library.steps.ts`                                                                |
| A3  | Keyboard users can navigate and search in narrow or collapsed layouts              | US1-AC3; BDD-US1-003, BDD-US1-004, BDD-US1-006, BDD-US1-008                           | example | PENDING | Planned: `test/bdd/features/clip-library/us1.feature`; `test/bdd/steps/clip-library.steps.ts`                                                                |
| A4  | Changing creator clears previous search, selection and export feedback             | US1-AC4; BDD-US1-005, BDD-US3-005, BDD-US4-011                                        | example | PENDING | Planned: `test/bdd/features/clip-library/us1.feature`; `test/bdd/steps/clip-library.steps.ts`                                                                |
| A5  | Home accurately reports known clip metrics in the local creation window            | US2-AC1; BDD-US2-001, BDD-US2-004, BDD-US2-006                                        | example | PENDING | Planned: `test/bdd/features/clip-library/us2.feature`; `test/bdd/steps/clip-library.steps.ts`                                                                |
| A6  | A verified available broadcast opens exactly its VOD-associated clips              | US2-AC2; BDD-US2-002, BDD-US2-003, BDD-US2-007                                        | example | PENDING | Planned: `test/bdd/features/clip-library/us2.feature`; `test/bdd/steps/clip-library.steps.ts`                                                                |
| A7  | Empty, partial and failed stream data have distinct recoverable states             | US2-AC3; BDD-US2-004, BDD-US2-005                                                     | example | PENDING | Planned: `test/bdd/features/clip-library/us2.feature`; `test/bdd/steps/clip-library.steps.ts`                                                                |
| A8  | Each filter, sort and restored URL returns the expected inventory identities       | US3-AC1; BDD-US3-001, BDD-US3-002, BDD-US3-003, BDD-US3-006, BDD-US3-008, BDD-US3-010 | example | PENDING | Core browser checks Green; full planning matrix reconciliation pending: `test/bdd/features/clip-library/us3.feature`; `test/bdd/steps/clip-library.steps.ts` |
| A9  | Selections across pages contain only explicit unique chosen IDs                    | US3-AC2; BDD-US3-004                                                                  | example | PENDING | Planned: `test/bdd/features/clip-library/us3.feature`; `test/bdd/steps/clip-library.steps.ts`                                                                |
| A10 | Scope changes clear selection while unchanged-request failures preserve it         | US3-AC3; BDD-US3-005, BDD-US3-009                                                     | example | PENDING | Planned: `test/bdd/features/clip-library/us3.feature`; `test/bdd/steps/clip-library.steps.ts`                                                                |
| A11 | Clips with absent VOD or thumbnails remain browsable without fabricated metadata   | US3-AC4; BDD-US3-007                                                                  | example | PENDING | Planned: `test/bdd/features/clip-library/us3.feature`; `test/bdd/steps/clip-library.steps.ts`                                                                |
| A12 | A ZIP contains exactly the selected complete original media with accurate metadata | US4-AC1; BDD-US4-001, BDD-US4-002, BDD-US4-009                                        | example | PENDING | Planned: `test/bdd/features/clip-library/us4.feature`; `test/bdd/steps/clip-library.steps.ts`                                                                |
| A13 | Authorization, limits and provider failure produce local actionable recovery       | US4-AC2; BDD-US4-003, BDD-US4-004, BDD-US4-006, BDD-US4-008, BDD-US4-012, BDD-US4-013 | example | PENDING | Planned: `test/bdd/features/clip-library/us4.feature`; `test/bdd/steps/clip-library.steps.ts`                                                                |
| A14 | Mixed successes produce an accurate partial result and failed-only retry           | US4-AC3; BDD-US4-005, BDD-US4-007, BDD-US4-009                                        | example | PENDING | Planned: `test/bdd/features/clip-library/us4.feature`; `test/bdd/steps/clip-library.steps.ts`                                                                |
| A15 | Cancellation, all-failed export and browser errors never claim save success        | US4-AC4; BDD-US4-010, BDD-US4-011, BDD-US4-014                                        | example | PENDING | Planned: `test/bdd/features/clip-library/us4.feature`; `test/bdd/steps/clip-library.steps.ts`                                                                |

## Inner loop: unit behaviors

Each row is one observable result; valid/invalid equivalence classes in its source inventory are all required. Pure example/contract assertions use existing Jest; no new contract framework. `BASELINE` rows below are existing tests read and successfully run during setup, not new feature behavior.

### `src/app/components/dashboardShell.tsx`

| id  | behavior                                                                      | traces                                     | kind    | state   | test                                          |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------ | ------- | ------- | --------------------------------------------- |
| U1  | Only destinations permitted by current creator authority are visible          | US1-AC1, FR-001 FR-002 EC-010, TDD-US1-001 | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U2  | The current route selects its matching sidebar destination                    | US1-AC1, FR-001 FR-002 EC-010, TDD-US1-001 | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U3  | A resource editor selects its parent list destination                         | US1-AC1, FR-001 FR-002 EC-010, TDD-US1-001 | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U4  | An existing bookmarked editor opens the same resource identity                | US1-AC1, FR-001 FR-002 EC-010, TDD-US1-001 | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U5  | Clip search waits for two typed characters                                    | US1-AC4, FR-003 EC-001, TDD-US1-002        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U6  | Clip search issues its query after the 200 millisecond debounce               | US1-AC4, FR-003 EC-001, TDD-US1-002        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U7  | A newer query response supersedes an older pending result                     | US1-AC4, FR-003 EC-001, TDD-US1-002        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U8  | Changing creator clears previous search suggestions before new results arrive | US1-AC4, FR-003 EC-001, TDD-US1-002        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U9  | Closing search aborts its pending clip lookup                                 | US1-AC4, FR-003 EC-001, TDD-US1-002        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U10 | Ctrl or Command K opens the command search palette                            | US1-AC3, FR-003 FR-015, TDD-US1-003        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U11 | Escape dismisses search and restores trigger focus                            | US1-AC3, FR-003 FR-015, TDD-US1-003        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U12 | Text editing is unaffected by navigation shortcuts                            | US1-AC3, FR-003 FR-015, TDD-US1-003        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U13 | Choosing a search destination navigates to that permitted page                | US1-AC3, FR-003 FR-015, TDD-US1-003        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U14 | Search displays an empty state for no matching results                        | US1-AC3, FR-003 FR-015, TDD-US1-003        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U15 | Search preserves its query after a failed lookup                              | US1-AC3, FR-003 FR-015, TDD-US1-003        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U16 | Mobile drawer finishes closing before search becomes modal                    | US1-AC3, FR-003 FR-015, TDD-US1-003        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U17 | Ctrl or Command B toggles navigation outside editable fields                  | US1-AC3, FR-003 FR-015, TDD-US1-003        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U18 | Collapsed icons retain accessible names and tooltips                          | US1-AC3, FR-003 FR-015, TDD-US1-003        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U19 | Context navigation groups start expanded                                      | US1-AC3, FR-003 FR-015, TDD-US1-003        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U20 | The mobile drawer remains scrollable after viewport and keyboard changes      | US1-AC3, FR-003 FR-015, TDD-US1-003        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |
| U21 | Breadcrumb ancestor links navigate to their existing list or creator page     | US1-AC3, FR-003 FR-015, TDD-US1-003        | example | PENDING | `test/app/components/dashboardShell.test.tsx` |

### `src/app/components/dashboardNavbar.tsx`

| id   | behavior                                                                                               | traces                              | kind             | state    | test                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------ | ----------------------------------- | ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| U22  | Changing account uses the existing authorized organization switch (duplicate retired; covered by U171) | US1-AC2, FR-001 EC-010, TDD-US1-004 | example          | DROPPED  | `test/app/components/dashboardShell.test.tsx`                                                                                     |
| U23  | Theme selection keeps the current Clipify theme behavior (duplicate retired; covered by U169)          | US1-AC2, FR-001 EC-010, TDD-US1-004 | example          | DROPPED  | `test/app/components/dashboardShell.test.tsx`                                                                                     |
| U24  | An existing upgrade action opens the existing upgrade destination (duplicate retired; covered by U170) | US1-AC2, FR-001 EC-010, TDD-US1-004 | example          | DROPPED  | `test/app/components/dashboardShell.test.tsx`                                                                                     |
| U25  | Exiting admin view returns to the signed-in admin context (duplicate retired; covered by U173)         | US1-AC2, FR-001 EC-010, TDD-US1-004 | example          | DROPPED  | `test/app/components/dashboardShell.test.tsx`                                                                                     |
| U26  | Editor navigation retains the existing unsaved-change guard                                            | US1-AC2, FR-001 EC-010, TDD-US1-004 | example          | PENDING  | `test/app/components/dashboardShell.test.tsx`                                                                                     |
| U27  | Existing tour anchors still identify their supported controls                                          | US1-AC2, FR-001 EC-010, TDD-US1-004 | example          | PENDING  | `test/app/components/dashboardShell.test.tsx`                                                                                     |
| U28  | Help and logout retain their existing destinations (duplicate retired; covered by U172)                | US1-AC2, FR-001 EC-010, TDD-US1-004 | example          | DROPPED  | `test/app/components/dashboardShell.test.tsx`                                                                                     |
| U169 | Legacy theme toggling remains characterized                                                            | US1-AC2, FR-001 EC-010, TDD-US1-004 | characterization | BASELINE | `test/app/components/dashboardNavbar.test.tsx::renders correctly and toggles theme`                                               |
| U170 | The existing Free-plan upgrade entry remains characterized                                             | US1-AC2, FR-001 EC-010, TDD-US1-004 | characterization | BASELINE | `test/app/components/dashboardNavbar.test.tsx::shows upgrade link for free users`                                                 |
| U171 | The existing organization switch remains characterized                                                 | US1-AC2, FR-001 EC-010, TDD-US1-004 | characterization | BASELINE | `test/app/components/dashboardNavbar.test.tsx::shows the active account in a compact context selector and switches organizations` |
| U172 | The existing profile navigation remains characterized                                                  | US1-AC2, FR-001 EC-010, TDD-US1-004 | characterization | BASELINE | `test/app/components/dashboardNavbar.test.tsx::navigates to various pages from dropdown`                                          |
| U173 | The existing admin-view switch and exit remain characterized                                           | US1-AC2, FR-001 EC-010, TDD-US1-004 | characterization | BASELINE | `test/app/components/dashboardNavbar.test.tsx::shows impersonation switch bar and allows switching + exit`                        |

### `src/server/creator-library.ts`

| id   | behavior                                                                                     | traces                                     | kind    | state   | test                                   |
| ---- | -------------------------------------------------------------------------------------------- | ------------------------------------------ | ------- | ------- | -------------------------------------- |
| U29  | The creation window starts at local midnight twenty-nine days before today                   | US2-AC1, FR-004 EC-004, TDD-US2-001        | example | PENDING | `test/server/creator-overview.test.ts` |
| U30  | The creation window ends at exclusive next local midnight                                    | US2-AC1, FR-004 EC-004, TDD-US2-001        | example | PENDING | `test/server/creator-overview.test.ts` |
| U31  | DST spring change preserves local calendar-day membership                                    | US2-AC1, FR-004 EC-004, TDD-US2-001        | example | PENDING | `test/server/creator-overview.test.ts` |
| U32  | DST fall change preserves local calendar-day membership                                      | US2-AC1, FR-004 EC-004, TDD-US2-001        | example | PENDING | `test/server/creator-overview.test.ts` |
| U33  | An absent saved timezone uses the validated browser timezone                                 | US2-AC1, FR-004 EC-004, TDD-US2-001        | example | PENDING | `test/server/creator-overview.test.ts` |
| U34  | Only clips within the creation window contribute to the known count                          | US2-AC1, FR-004 SC-002, TDD-US2-002        | example | PENDING | `test/server/creator-overview.test.ts` |
| U35  | The total sums latest known lifetime views of included clips                                 | US2-AC1, FR-004 SC-002, TDD-US2-002        | example | PENDING | `test/server/creator-overview.test.ts` |
| U36  | Top clips are limited to the five highest current view counts                                | US2-AC1, FR-004 SC-002, TDD-US2-002        | example | PENDING | `test/server/creator-overview.test.ts` |
| U37  | Equal view counts use the stable clip ID tie-break                                           | US2-AC1, FR-004 SC-002, TDD-US2-002        | example | PENDING | `test/server/creator-overview.test.ts` |
| U38  | An empty known window produces zero count and zero views                                     | US2-AC1, FR-004 SC-002, TDD-US2-002        | example | PENDING | `test/server/creator-overview.test.ts` |
| U39  | Only archive broadcasts enter the past-stream list                                           | US2-AC2, FR-005 EC-002, TDD-US2-003        | example | PENDING | `test/server/creator-overview.test.ts` |
| U40  | Available broadcasts with no clips remain listed                                             | US2-AC2, FR-005 EC-002, TDD-US2-003        | example | PENDING | `test/server/creator-overview.test.ts` |
| U41  | Broadcast pages are ordered newest first                                                     | US2-AC2, FR-005 EC-002, TDD-US2-003        | example | PENDING | `test/server/creator-overview.test.ts` |
| U42  | Broadcast cursors cannot be reused for a foreign creator                                     | US2-AC2, FR-005 EC-002, TDD-US2-003        | example | PENDING | `test/server/creator-overview.test.ts` |
| U43  | Broadcast cache entries younger than five minutes are fresh                                  | US2-AC2, FR-005 EC-002, TDD-US2-003        | example | PENDING | `test/server/creator-overview.test.ts` |
| U44  | An expired cache entry is labeled stale when provider refresh fails                          | US2-AC2, FR-005 EC-002, TDD-US2-003        | example | PENDING | `test/server/creator-overview.test.ts` |
| U45  | A matching provider VOD ID assigns a clip to its stream                                      | US2-AC2, FR-006 EC-003, TDD-US2-004        | example | PENDING | `test/server/creator-overview.test.ts` |
| U46  | A clip created later from that VOD still belongs to the same stream                          | US2-AC2, FR-006 EC-003, TDD-US2-004        | example | PENDING | `test/server/creator-overview.test.ts` |
| U47  | A missing VOD ID leaves a clip unassigned                                                    | US2-AC2, FR-006 EC-003, TDD-US2-004        | example | PENDING | `test/server/creator-overview.test.ts` |
| U48  | An expired VOD does not remove its known clips from inventory                                | US2-AC2, FR-006 EC-003, TDD-US2-004        | example | PENDING | `test/server/creator-overview.test.ts` |
| U49  | Incomplete crawler sync is exposed as incomplete clip coverage                               | US2-AC3, FR-004 FR-016 EC-002, TDD-US2-005 | example | PENDING | `test/server/creator-overview.test.ts` |
| U50  | A failed broadcast section leaves successful clip metrics available                          | US2-AC3, FR-004 FR-016 EC-002, TDD-US2-005 | example | PENDING | `test/server/creator-overview.test.ts` |
| U51  | A failed clip section leaves cached broadcast data available                                 | US2-AC3, FR-004 FR-016 EC-002, TDD-US2-005 | example | PENDING | `test/server/creator-overview.test.ts` |
| U52  | Opening Home does not start a historical clip crawl                                          | US2-AC3, FR-004 FR-016 EC-002, TDD-US2-005 | example | PENDING | `test/server/creator-overview.test.ts` |
| U53  | An unauthorized creator request is denied before broadcast cache access                      | US2-AC2, FR-005 FR-013 EC-001, TDD-US2-006 | example | PENDING | `test/server/creator-overview.test.ts` |
| U54  | A foreign provider broadcast ID returns no protected metadata                                | US2-AC2, FR-005 FR-013 EC-001, TDD-US2-006 | example | PENDING | `test/server/creator-overview.test.ts` |
| U55  | An expired session receives an authentication-required result                                | US2-AC2, FR-005 FR-013 EC-001, TDD-US2-006 | example | PENDING | `test/server/creator-overview.test.ts` |
| U56  | An omitted query uses newest sorting and page size twenty-five                               | US3-AC1, FR-008 EC-004, TDD-US3-001        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U57  | A negative minimum view count returns local field validation                                 | US3-AC1, FR-008 EC-004, TDD-US3-001        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U58  | A nonfinite or negative duration returns local field validation                              | US3-AC1, FR-008 EC-004, TDD-US3-001        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U59  | Reversed duration bounds return local field validation                                       | US3-AC1, FR-008 EC-004, TDD-US3-001        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U60  | Reversed or malformed date bounds return local field validation                              | US3-AC1, FR-008 EC-004, TDD-US3-001        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U61  | An invalid IANA timezone returns local field validation                                      | US3-AC1, FR-008 EC-004, TDD-US3-001        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U62  | Page size fifty is accepted                                                                  | US3-AC1, FR-008 EC-004, TDD-US3-001        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U63  | Page size fifty-one is rejected                                                              | US3-AC1, FR-008 EC-004, TDD-US3-001        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U64  | Title search matches a case-insensitive substring                                            | US3-AC1, FR-008 SC-003, TDD-US3-002        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U65  | Category filtering returns only the requested category                                       | US3-AC1, FR-008 SC-003, TDD-US3-002        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U66  | The start timestamp includes clips at its boundary                                           | US3-AC1, FR-008 SC-003, TDD-US3-002        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U67  | The end timestamp excludes clips at its boundary                                             | US3-AC1, FR-008 SC-003, TDD-US3-002        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U68  | Minimum views includes clips exactly at the threshold                                        | US3-AC1, FR-008 SC-003, TDD-US3-002        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U69  | Minimum duration includes clips exactly at the threshold                                     | US3-AC1, FR-008 SC-003, TDD-US3-002        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U70  | Maximum duration includes clips exactly at the threshold                                     | US3-AC1, FR-008 SC-003, TDD-US3-002        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U71  | Combined filters return their intersection                                                   | US3-AC1, FR-008 SC-003, TDD-US3-002        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U72  | Newest sort breaks equal creation instants by clip ID                                        | US3-AC1, FR-008 SC-003, TDD-US3-002        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U73  | Most-viewed sort breaks equal view counts by clip ID                                         | US3-AC1, FR-008 SC-003, TDD-US3-002        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U74  | Pagination counts use the same predicates as returned rows                                   | US3-AC1, FR-008 SC-003, TDD-US3-002        | example | DONE    | `test/server/creator-clips.test.ts`    |
| U75  | Public clip projection excludes provider credentials and signed media sources                | US3-AC4, FR-007 EC-003, TDD-US3-003        | example | PENDING | `test/server/creator-clips.test.ts`    |
| U76  | A missing thumbnail produces no invented image URL                                           | US3-AC4, FR-007 EC-003, TDD-US3-003        | example | PENDING | `test/server/creator-clips.test.ts`    |
| U77  | Missing category and VOD metadata remain nullable                                            | US3-AC4, FR-007 EC-003, TDD-US3-003        | example | PENDING | `test/server/creator-clips.test.ts`    |
| U78  | Preview reuses a currently authorized existing playback context                              | US3-AC4, FR-007 EC-003, TDD-US3-003        | example | PENDING | `test/server/creator-clips.test.ts`    |
| U87  | The owner may read their own creator inventory                                               | US3-AC1, FR-013 EC-001, TDD-US3-005        | example | PENDING | `test/server/creator-clips.test.ts`    |
| U88  | A currently permitted direct Pro member may read inventory                                   | US3-AC1, FR-013 EC-001, TDD-US3-005        | example | PENDING | `test/server/creator-clips.test.ts`    |
| U89  | A direct member without the required creator entitlement is denied                           | US3-AC1, FR-013 EC-001, TDD-US3-005        | example | PENDING | `test/server/creator-clips.test.ts`    |
| U90  | A permitted agency access path may read its linked creator inventory                         | US3-AC1, FR-013 EC-001, TDD-US3-005        | example | PENDING | `test/server/creator-clips.test.ts`    |
| U91  | A revoked grant or suspended creator is denied inventory data                                | US3-AC1, FR-013 EC-001, TDD-US3-005        | example | PENDING | `test/server/creator-clips.test.ts`    |
| U92  | A foreign creator request never reads that creator cache                                     | US3-AC1, FR-013 EC-001, TDD-US3-005        | example | PENDING | `test/server/creator-clips.test.ts`    |
| U96  | A warm ten-thousand-clip fixture returns the correct twenty-five-row page within two seconds | US3-AC1, FR-008 SC-006, TDD-US3-007        | example | PENDING | `test/server/creator-clips.test.ts`    |
| U179 | A cache database failure returns SERVICE_UNAVAILABLE instead of a successful empty inventory | US3-AC3, FR-007 FR-016 EC-002, TDD-US3-008 | example | PENDING | `test/server/creator-clips.test.ts`    |

### `src/app/components/creator/clipInventory.tsx`

| id  | behavior                                                                    | traces                              | kind    | state   | test                                         |
| --- | --------------------------------------------------------------------------- | ----------------------------------- | ------- | ------- | -------------------------------------------- |
| U79 | Selecting a row adds its explicit clip ID once                              | US3-AC2, FR-009 EC-005, TDD-US3-004 | example | PENDING | `test/app/components/clipInventory.test.tsx` |
| U80 | Deselecting a row removes only that ID                                      | US3-AC2, FR-009 EC-005, TDD-US3-004 | example | PENDING | `test/app/components/clipInventory.test.tsx` |
| U81 | Select page adds only visible-page IDs                                      | US3-AC2, FR-009 EC-005, TDD-US3-004 | example | PENDING | `test/app/components/clipInventory.test.tsx` |
| U82 | Changing result page retains the explicit selected IDs                      | US3-AC2, FR-009 EC-005, TDD-US3-004 | example | PENDING | `test/app/components/clipInventory.test.tsx` |
| U83 | A fifty-first unique selected ID is rejected with local feedback            | US3-AC2, FR-009 EC-005, TDD-US3-004 | example | PENDING | `test/app/components/clipInventory.test.tsx` |
| U84 | Changing filters clears selection with local feedback                       | US3-AC2, FR-009 EC-005, TDD-US3-004 | example | PENDING | `test/app/components/clipInventory.test.tsx` |
| U85 | Changing stream or creator clears selection                                 | US3-AC2, FR-009 EC-005, TDD-US3-004 | example | PENDING | `test/app/components/clipInventory.test.tsx` |
| U86 | A failed unchanged request preserves the valid selection                    | US3-AC2, FR-009 EC-005, TDD-US3-004 | example | PENDING | `test/app/components/clipInventory.test.tsx` |
| U93 | A refresh cooldown produces existing retry timing without resetting filters | US3-AC3, FR-016 EC-002, TDD-US3-006 | example | PENDING | `test/app/components/clipInventory.test.tsx` |
| U94 | An older inventory response cannot overwrite a newer scope                  | US3-AC3, FR-016 EC-002, TDD-US3-006 | example | PENDING | `test/app/components/clipInventory.test.tsx` |
| U95 | A permitted refresh preserves the existing crawler rules                    | US3-AC3, FR-016 EC-002, TDD-US3-006 | example | PENDING | `test/app/components/clipInventory.test.tsx` |

### `src/auth/permissions.ts`

| id   | behavior                                                                   | traces                              | kind    | state   | test                              |
| ---- | -------------------------------------------------------------------------- | ----------------------------------- | ------- | ------- | --------------------------------- |
| U97  | The owner has the explicit clip-export permission                          | US4-AC2, FR-013 EC-001, TDD-US4-001 | example | PENDING | `test/server/clip-export.test.ts` |
| U98  | Operations retain read-plus-clip-export authority                          | US4-AC2, FR-013 EC-001, TDD-US4-001 | example | PENDING | `test/server/clip-export.test.ts` |
| U99  | Content managers receive creator read plus explicit clip-export permission | US4-AC2, FR-013 EC-001, TDD-US4-001 | example | PENDING | `test/server/clip-export.test.ts` |
| U100 | Analyst and billing-manager roles do not gain clip-export authority        | US4-AC2, FR-013 EC-001, TDD-US4-001 | example | PENDING | `test/server/clip-export.test.ts` |
| U101 | A custom role without clip-export permission cannot export                 | US4-AC2, FR-013 EC-001, TDD-US4-001 | example | PENDING | `test/server/clip-export.test.ts` |
| U102 | A custom role with current read-plus-export permission may export          | US4-AC2, FR-013 EC-001, TDD-US4-001 | example | PENDING | `test/server/clip-export.test.ts` |
| U103 | Existing direct-member and agency entitlement rules still gate export      | US4-AC2, FR-013 EC-001, TDD-US4-001 | example | PENDING | `test/server/clip-export.test.ts` |

### `src/server/clip-export.ts`

| id   | behavior                                                                                 | traces                              | kind    | state   | test                              |
| ---- | ---------------------------------------------------------------------------------------- | ----------------------------------- | ------- | ------- | --------------------------------- |
| U104 | A body over sixty-four KiB is rejected before parsing                                    | US4-AC2, FR-011 EC-007, TDD-US4-002 | example | PENDING | `test/server/clip-export.test.ts` |
| U105 | An empty ID array is rejected before provider calls                                      | US4-AC2, FR-011 EC-007, TDD-US4-002 | example | PENDING | `test/server/clip-export.test.ts` |
| U106 | Malformed IDs are rejected before provider calls                                         | US4-AC2, FR-011 EC-007, TDD-US4-002 | example | PENDING | `test/server/clip-export.test.ts` |
| U107 | Duplicate IDs are deduplicated before export                                             | US4-AC2, FR-011 EC-007, TDD-US4-002 | example | PENDING | `test/server/clip-export.test.ts` |
| U108 | Fifty unique selected IDs are accepted                                                   | US4-AC2, FR-011 EC-007, TDD-US4-002 | example | PENDING | `test/server/clip-export.test.ts` |
| U109 | Fifty-one unique selected IDs are rejected                                               | US4-AC2, FR-011 EC-007, TDD-US4-002 | example | PENDING | `test/server/clip-export.test.ts` |
| U110 | A foreign clip among owned IDs rejects the entire request                                | US4-AC2, FR-011 EC-007, TDD-US4-002 | example | PENDING | `test/server/clip-export.test.ts` |
| U111 | A cross-origin export request is rejected                                                | US4-AC2, FR-011 EC-007, TDD-US4-002 | example | PENDING | `test/server/clip-export.test.ts` |
| U112 | Only an exact requested clip-ID download response can be used                            | US4-AC1, FR-010 EC-006, TDD-US4-003 | example | PENDING | `test/server/clip-export.test.ts` |
| U113 | Landscape is chosen when both provider variants exist                                    | US4-AC1, FR-010 EC-006, TDD-US4-003 | example | PENDING | `test/server/clip-export.test.ts` |
| U114 | Portrait is chosen when landscape is unavailable                                         | US4-AC1, FR-010 EC-006, TDD-US4-003 | example | PENDING | `test/server/clip-export.test.ts` |
| U115 | No provider variant produces an unavailable result                                       | US4-AC1, FR-010 EC-006, TDD-US4-003 | example | PENDING | `test/server/clip-export.test.ts` |
| U116 | Missing download scope returns reconnect-required without playback fallback              | US4-AC1, FR-010 EC-006, TDD-US4-003 | example | PENDING | `test/server/clip-export.test.ts` |
| U117 | Revoked provider credentials return reconnect-required without exposing upstream secrets | US4-AC1, FR-010 EC-006, TDD-US4-003 | example | PENDING | `test/server/clip-export.test.ts` |
| U118 | A non-HTTPS media source is rejected before connecting                                   | US4-AC2, FR-014 EC-008, TDD-US4-004 | example | PENDING | `test/server/clip-export.test.ts` |
| U119 | A media source with userinfo or a nonstandard port is rejected                           | US4-AC2, FR-014 EC-008, TDD-US4-004 | example | PENDING | `test/server/clip-export.test.ts` |
| U120 | An untrusted provider hostname is rejected before connecting                             | US4-AC2, FR-014 EC-008, TDD-US4-004 | example | PENDING | `test/server/clip-export.test.ts` |
| U121 | Every redirect target is validated before following                                      | US4-AC2, FR-014 EC-008, TDD-US4-004 | example | PENDING | `test/server/clip-export.test.ts` |
| U122 | A redirect to private or loopback space is rejected                                      | US4-AC2, FR-014 EC-008, TDD-US4-004 | example | PENDING | `test/server/clip-export.test.ts` |
| U123 | A redirect chain beyond the existing bounded policy is rejected                          | US4-AC2, FR-014 EC-008, TDD-US4-004 | example | PENDING | `test/server/clip-export.test.ts` |
| U124 | Media downloads never receive provider API authorization headers                         | US4-AC2, FR-014 EC-008, TDD-US4-004 | example | PENDING | `test/server/clip-export.test.ts` |
| U125 | A complete media file exactly thirty-two MiB is eligible                                 | US4-AC3, FR-011 EC-007, TDD-US4-005 | example | PENDING | `test/server/clip-export.test.ts` |
| U126 | A media file exceeding thirty-two MiB by one byte is skipped                             | US4-AC3, FR-011 EC-007, TDD-US4-005 | example | PENDING | `test/server/clip-export.test.ts` |
| U127 | Aggregate media exactly one hundred twenty-eight MiB is eligible                         | US4-AC3, FR-011 EC-007, TDD-US4-005 | example | PENDING | `test/server/clip-export.test.ts` |
| U128 | Aggregate media above its byte cap cannot enter the package                              | US4-AC3, FR-011 EC-007, TDD-US4-005 | example | PENDING | `test/server/clip-export.test.ts` |
| U129 | Absent Content-Length still enforces actual received byte caps                           | US4-AC3, FR-011 EC-007, TDD-US4-005 | example | PENDING | `test/server/clip-export.test.ts` |
| U130 | Underreported Content-Length cannot bypass actual byte caps                              | US4-AC3, FR-011 EC-007, TDD-US4-005 | example | PENDING | `test/server/clip-export.test.ts` |
| U131 | Original selection order decides inclusion when concurrent files finish out of order     | US4-AC3, FR-011 EC-007, TDD-US4-005 | example | PENDING | `test/server/clip-export.test.ts` |
| U132 | An oversized manifest or final archive is rejected within its declared cap               | US4-AC3, FR-011 EC-007, TDD-US4-005 | example | PENDING | `test/server/clip-export.test.ts` |
| U133 | An HTML success-status body is rejected as invalid media                                 | US4-AC1, FR-014 EC-008, TDD-US4-006 | example | PENDING | `test/server/clip-export.test.ts` |
| U134 | An empty body is rejected as invalid media                                               | US4-AC1, FR-014 EC-008, TDD-US4-006 | example | PENDING | `test/server/clip-export.test.ts` |
| U135 | A truncated MP4 is rejected before ZIP inclusion                                         | US4-AC1, FR-014 EC-008, TDD-US4-006 | example | PENDING | `test/server/clip-export.test.ts` |
| U136 | Path separators and traversal cannot escape the archive root                             | US4-AC1, FR-014 EC-008, TDD-US4-006 | example | PENDING | `test/server/clip-export.test.ts` |
| U137 | Platform-reserved names become safe filenames                                            | US4-AC1, FR-014 EC-008, TDD-US4-006 | example | PENDING | `test/server/clip-export.test.ts` |
| U138 | Long Unicode titles retain a bounded safe filename                                       | US4-AC1, FR-014 EC-008, TDD-US4-006 | example | PENDING | `test/server/clip-export.test.ts` |
| U139 | Colliding titles produce distinct deterministic entry names                              | US4-AC1, FR-014 EC-008, TDD-US4-006 | example | PENDING | `test/server/clip-export.test.ts` |
| U140 | A successful ZIP contains exactly the selected complete media entries                    | US4-AC1, FR-010 SC-004, TDD-US4-007 | example | PENDING | `test/server/clip-export.test.ts` |
| U141 | The manifest records every requested clip ID once                                        | US4-AC1, FR-010 SC-004, TDD-US4-007 | example | PENDING | `test/server/clip-export.test.ts` |
| U142 | The manifest records the actual provider variant and byte count                          | US4-AC1, FR-010 SC-004, TDD-US4-007 | example | PENDING | `test/server/clip-export.test.ts` |
| U143 | The bounded summary header contains only request-position indices and reason codes       | US4-AC1, FR-010 SC-004, TDD-US4-007 | example | PENDING | `test/server/clip-export.test.ts` |
| U144 | Signed source URLs and credentials are absent from manifest headers and logs             | US4-AC1, FR-010 SC-004, TDD-US4-007 | example | PENDING | `test/server/clip-export.test.ts` |
| U145 | Invalid summary positions are rejected before mapping results to submitted clips         | US4-AC1, FR-010 SC-004, TDD-US4-007 | example | PENDING | `test/server/clip-export.test.ts` |
| U146 | Provider throttling preserves its reset time in local retry feedback                     | US4-AC2, FR-012 EC-006, TDD-US4-008 | example | PENDING | `test/server/clip-export.test.ts` |
| U147 | Provider server failures become typed retryable results                                  | US4-AC2, FR-012 EC-006, TDD-US4-008 | example | PENDING | `test/server/clip-export.test.ts` |
| U148 | No more than two media fetches run concurrently                                          | US4-AC2, FR-012 EC-006, TDD-US4-008 | example | PENDING | `test/server/clip-export.test.ts` |
| U149 | A fourth export start within one minute is rate limited for the actor and creator        | US4-AC2, FR-012 EC-006, TDD-US4-008 | example | PENDING | `test/server/clip-export.test.ts` |
| U150 | At least one complete success produces an explicitly partial ZIP when other items fail   | US4-AC3, FR-012 EC-009, TDD-US4-009 | example | PENDING | `test/server/clip-export.test.ts` |
| U151 | All failed items produce typed JSON instead of a successful empty ZIP                    | US4-AC3, FR-012 EC-009, TDD-US4-009 | example | PENDING | `test/server/clip-export.test.ts` |
| U152 | Retryable failures exclude unavailable scope and size-limit failures                     | US4-AC3, FR-012 EC-009, TDD-US4-009 | example | PENDING | `test/server/clip-export.test.ts` |
| U153 | Failed-only retry excludes IDs that already succeeded                                    | US4-AC3, FR-012 EC-009, TDD-US4-009 | example | PENDING | `test/server/clip-export.test.ts` |
| U154 | A media read exceeding thirty seconds is aborted                                         | US4-AC4, FR-012 EC-009, TDD-US4-010 | example | PENDING | `test/server/clip-export.test.ts` |
| U155 | The whole export exceeding one hundred twenty seconds is aborted                         | US4-AC4, FR-012 EC-009, TDD-US4-010 | example | PENDING | `test/server/clip-export.test.ts` |
| U156 | User cancellation aborts outstanding provider work                                       | US4-AC4, FR-012 EC-009, TDD-US4-010 | example | PENDING | `test/server/clip-export.test.ts` |
| U157 | A request disconnect aborts outstanding provider work                                    | US4-AC4, FR-012 EC-009, TDD-US4-010 | example | PENDING | `test/server/clip-export.test.ts` |
| U158 | Completion or cancellation releases request-owned media buffers                          | US4-AC4, FR-012 EC-009, TDD-US4-010 | example | PENDING | `test/server/clip-export.test.ts` |
| U159 | Current creator authority is rechecked before each bounded media batch                   | US4-AC2, FR-013 EC-001, TDD-US4-011 | example | PENDING | `test/server/clip-export.test.ts` |
| U160 | Revocation during preparation withholds all already-buffered media                       | US4-AC2, FR-013 EC-001, TDD-US4-011 | example | PENDING | `test/server/clip-export.test.ts` |
| U161 | Current authority is checked immediately before emitting the finished archive            | US4-AC2, FR-013 EC-001, TDD-US4-011 | example | PENDING | `test/server/clip-export.test.ts` |
| U178 | Fifty clip IDs resolve through five official URL batches of at most ten IDs              | US4-AC1, FR-010 EC-006, TDD-US4-003 | example | PENDING | `test/server/clip-export.test.ts` |

### `src/app/components/creator/clipExport.tsx`

| id   | behavior                                                                     | traces                              | kind    | state   | test                                      |
| ---- | ---------------------------------------------------------------------------- | ----------------------------------- | ------- | ------- | ----------------------------------------- |
| U162 | The client rejects a response exceeding one hundred thirty MiB while reading | US4-AC4, FR-012 FR-015, TDD-US4-012 | example | PENDING | `test/app/components/clipExport.test.tsx` |
| U163 | Download completion revokes the request-owned Blob URL                       | US4-AC4, FR-012 FR-015, TDD-US4-012 | example | PENDING | `test/app/components/clipExport.test.tsx` |
| U164 | Partial feedback reports the exact included and skipped counts               | US4-AC4, FR-012 FR-015, TDD-US4-012 | example | PENDING | `test/app/components/clipExport.test.tsx` |
| U165 | Reconnect feedback preserves valid selected IDs                              | US4-AC4, FR-012 FR-015, TDD-US4-012 | example | PENDING | `test/app/components/clipExport.test.tsx` |
| U166 | A browser read or save-initiation error never claims disk-save success       | US4-AC4, FR-012 FR-015, TDD-US4-012 | example | PENDING | `test/app/components/clipExport.test.tsx` |
| U167 | A creator switch discards the pending export response                        | US4-AC4, FR-012 FR-015, TDD-US4-012 | example | PENDING | `test/app/components/clipExport.test.tsx` |
| U168 | Cancel leaves the selection available for a later retry                      | US4-AC4, FR-012 FR-015, TDD-US4-012 | example | PENDING | `test/app/components/clipExport.test.tsx` |

### `src/app/actions/twitch.ts`

| id   | behavior                                                                                           | traces                                     | kind    | state   | test                                       |
| ---- | -------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------- | ------- | ------------------------------------------ |
| U174 | An authorized inventory preview works while the public creator page is disabled                    | US3-AC4, FR-007 FR-013 EC-001, TDD-US3-003 | example | PENDING | `test/app/actions/twitch.playback.test.ts` |
| U175 | A foreign clip is denied by the inventory playback context                                         | US3-AC4, FR-007 FR-013 EC-001, TDD-US3-003 | example | PENDING | `test/app/actions/twitch.playback.test.ts` |
| U176 | An expired session cannot reuse a cached playback URL through inventory preview                    | US3-AC4, FR-007 FR-013 EC-001, TDD-US3-003 | example | PENDING | `test/app/actions/twitch.playback.test.ts` |
| U177 | Legacy overlay demo gallery and public-creator playback keep their existing authorization behavior | US3-AC4, FR-007 FR-013 EC-001, TDD-US3-003 | example | PENDING | `test/app/actions/twitch.playback.test.ts` |

## Invariants and edge cases still to place

None unplaced. Boundary/negative behaviors include creator isolation, current-grant recheck, exact provider-ID mapping, interval endpoints, actual-byte limits and ZIP/result privacy. Arbitrary-order input and malicious filenames should use the existing fast-check capability where it adds confidence, while each promised boundary still has concrete examples. No blanket property claim is substituted for the required cases.

## Out of scope

- Discord/YouTube/TikTok automation, bot/reactions and Pro scheduling: future feature.
- Permanent broadcast history and historical view-delta/24-hour decisions: unavailable in v1 data model.
- Native Runner runtime/process/update behavior: no production Runner change planned. Existing native workflows remain part of full root baseline ownership.
- Building new wrappers, dependencies, storage or an export queue: not required for bounded request-local ZIPs.

## Verification commands

Copied verbatim from the refreshed stack profile; apply the documented environment before each shell.

- Single Jest test: `null`; verified zero-match runs exit0.
- Whole file: `bun run test --runInBand --runTestsByPath {file} --coverage=false`.
- Full suite: `bun run test:coverage`.
- Coverage: `bun run test:coverage` (same complete owner; execute once for both roles).
- Browser acceptance: `bun run test:acceptance`.
- Browser acceptance file: `bunx playwright test --project=acceptance-chromium {file} --workers=1`.
- Browser BDD file: `bunx bddgen && bunx playwright test --project=bdd-chromium {file} --workers=1` (generated clip-library file, after the guarded build).
- Mutation: `null`; deliberate-mutant spot checks are mandatory after implementation.

## Task execution order

US3 inventory -> US4 manual export -> US2 overview/streams -> US1 final shared shell. Pages initially reuse DashboardNavbar; US2 preserves the existing overlay list at /dashboard/overlays before replacing Home. US1 composes only real working routes and reuses the completed authorized inventory search service. No forward dependency or placeholder destination.

## Baseline and assumptions

The complete existing coverage owner passed at9f6107a3:6331 Jest tests and434 native workflows, with unchanged thresholds. All27 existing browser acceptance tests and isolated acceptance/BDD file selectors passed. Baseline evidence is in tdd/cycle-log.md and the refreshed profile; it is not evidence that this feature works. All feature A/U states are PENDING except five existing characterization rows. All-plan manual export and available-broadcast history are explicit v1 defaults, not user-confirmation claims.

## ID scope

Always scope browser execution to `.features-gen/bdd/clip-library/us<n>.feature.spec.js` before filtering a scenario ID. Core story/scenario labels are feature-local and overlap existing project features; an unscoped grep is not isolated evidence.

## Clean-master execution boundary

The branch is features/clip-export at base b6c8e591. Existing full baseline evidence at9f6107a3 is historical and does not qualify the changed master inputs. Current owning whole-file cache/playback/navigation/permission checks are repeated before code, and complete final coverage/browser/static gates must pass on the implemented branch before push. The user has now authorized implementation, commit, push and a draft PR; no additional permission gate remains.

## November 4 follow-up behaviors

These extend the original planned matrix; they do not retroactively establish test-first ordering for the older rows.

| ID  | Acceptance behavior                                                                       | Executable owner                                                                                                 | Evidence                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| FU1 | Sidebar Settings sections retain drafts, URL/back semantics and leave/reload guards       | settings.page.test.tsx; clip-library-recovery.spec.ts Mobile Settings; user-tour.steps.ts discovery cases        | Whole-file Settings 56/56; real mobile draft/guide case passed                                                             |
| FU2 | Search, footer, desktop collapse and signed-in/live avatar use consistent shared controls | dashboardShell.test.tsx; dashboardUserAvatar.test.tsx; dashboardPresence.test.ts; clip-library-layout.spec.ts    | Eight responsive/theme layout cases passed; presence failure caught and corrected through expired-session browser recovery |
| FU3 | Owned clip details expose normalized metadata and valid individual MP4                    | creator-clip-detail.test.ts; creatorLibrary.test.ts; clips-export.test.ts; clip-library-recovery.spec.ts details | Unit authorization/corrupt-cache cases and real MP4 download passed                                                        |
| FU4 | ZIP/MP4 and official playback URL requests share creator-account budgets                  | clip-download-limit.test.ts; clip-export.test.ts; clip-library-recovery.spec.ts details                          | Real MP4 plus ZIP jobs reached the same HTTP429 budget; no provider call after capacity denial                             |
| FU5 | Export errors use readable result dialogs without moving selection                        | clipExport.test.tsx; clip-library-recovery.spec.ts failure dialog                                                | Geometry and selection browser case passed; provider failure paths retain whole-file regression checks                     |
| FU6 | Sentry respects app theme, exposes a named dialog and does not shift content              | SentryFeedbackWidget.test.tsx; clip-library-recovery.spec.ts Real Sentry                                         | Intended theme/name Red then Green; actual SDK geometry check passed                                                       |
| FU7 | Tools sidebar URLs and browser history preserve player options                            | dashboard-sidebar-destinations.spec.ts                                                                           | Final local browser checkpoint recorded in test-summary.md                                                                 |

Operational refresh failures preserve successful inventory data; typed access revocation clears visible metadata. Both have whole-file component coverage, including an observed access-revocation Red. Full exact-head CI and published preview status remain separately tracked in PR546.
