# Dashboard editor layout audit — 2026-10-19

Scope: survey dashboard route chrome and inspect the shared resource-editor implementations. Compare Runner against Overlay, Gallery and Playlist; inspect Tools and the surrounding settings/agency navigation patterns. This is a layout audit, not a claim that every Clipify workflow has been browser-tested.

| Area | Finding | Correction |
| --- | --- | --- |
| Runner | Back/status/unlink sit outside the card, resource name replaces the generic page heading, and a separate padded wrapper changes the gutters. | Use generic Runner Settings page chrome; move Back/name/status/unlink into the primary card header; use the shared editor layout. Mobile gives the resource heading a full row. |
| Runner first setup | A separate setup card appears before the editor navigation. | Keep setup guidance inside the primary editor content, after its navigation/header. |
| Tools | Large responsive horizontal padding is nested inside the dashboard's existing width constraint. | Use the same editor layout and gutters as the reference editors; keep the purposeful configuration/preview columns. |
| Playlist | The name field forces a 260px minimum beside Back, crowding mobile. The Back button and name input lack explicit accessible names. | Let the secondary name field fill the available header width and label both controls. |
| Overlay | Resource ID remains visible in the narrow header, unlike Gallery; Back lacks an explicit accessible name. | Match Gallery's small-screen ID visibility and label Back. The browser comparison additionally exposed a reward input keeping its intrinsic minimum width and extending the page to 413px on a 390px viewport; allow that installed input to shrink within its field. |
| Gallery | Existing card-contained navigation and width provide the reference pattern. | Reuse that geometry through the shared layout without changing its editor controls. |

Overlay, Gallery, Playlist, Tools and Runner now render the same `DashboardEditorLayout`. The shared wrapper owns width/gutters; each editor retains its appropriate content and actions. AGENTS.md records this rule for future resource editors.

Settings/team/agency/account pages are multi-section workspaces with their own navigation and status sections; their existing section navigation is not treated as a resource-editor toolbar. Overlay Theme Studio is a canvas workspace. Public/embed playback and legal/marketing pages are different surfaces and are not forced into a dashboard editor card.

Validation: affected whole-file unit152/152; real five-editor comparison1/1; complete Runner owner3/3. Final production build/types and affected lint/formatting pass. Fresh full PR CI remains required before merge. The browser comparison checks card-contained Back controls, consistent workspace bounds, keyboard Back navigation, light/dark desktop/mobile rendering, a long Runner name, first setup and absence of horizontal page/header overflow. Screenshot inspection complements the geometry checks.
