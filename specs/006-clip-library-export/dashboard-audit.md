# Dashboard consistency audit

Updated 2026-11-04. Scope: the entire dashboard shell and all dashboard route families affected by PR546. Preserve Clipify branding, installed HeroUI/HeroUI Pro, permissions, drafts, existing resource workflows and manual export.

## Guidance and reference evidence

The official HeroUI React, Pro React and Design Taste skills were missing and have been installed in the persistent user skill directory. Installed component source, the HeroUI Pro MCP component documentation (Sidebar, Command, Card, Sheet, Table, EmptyState and Tabs), and theme variables were checked before composing changes. Pro guidance remains local rather than redistributing its licensed package in this repository.

Authenticated Mobbin searches were performed through the configured MCP connection. All returned images were retrieved and inspected. [Dropbox Dash](https://mobbin.com/screens/a5fe8b20-5bff-48bc-8b94-5b4702128bfd) and [Searchable](https://mobbin.com/screens/5ea33d90-7444-4d71-98be-35546c7fc0b4) place account identity at the bottom of navigation. That precedent informs the account placement. The user-requested sidebar search remains based on Payload Bay PR13 and the previously inspected navigation references in [design-review.md](design-review.md).

Descript's learning library and VEED, Riverside and Vimeo editing screens were also inspected. They were not used as dashboard-library layout evidence. Width, spacing, contrast and responsive corrections follow Clipify's shared layouts and the installed HeroUI guidance; they are implementation judgments, not claimed Mobbin research results.

## Route inventory

| Route family                                                 | Review and verification owner                                                                                                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                                                         | Empty/populated metrics, retry/reconnect, exact selected clip preview, local dates; creatorOverview whole-file tests, layout and consistency browser owners                               |
| Streams and stream detail                                    | Empty/error/pagination, stream navigation, mobile metadata and scoped inventory; creator-library pages, layout and recovery owners                                                        |
| Clip Inventory                                               | Filters, sort, pagination, selection, preview, export/retry/reconnect/cancel, authorization; existing inventory/export suites, layout and recovery browser owners                         |
| Overlays, playlists, galleries, Runner lists                 | Shared OverlayTable padding, loading/empty/populated/actions; whole-file table suites, consistency browser captures and existing resource workflows                                       |
| Overlay, playlist, gallery, Runner editors                   | Existing DashboardEditorLayout and card headers, widths, long names, back/keyboard navigation and unsaved-draft protection; editor browser owner and resource suites                      |
| Overlay style editor                                         | Shared editor layout, grouped back/heading/actions, responsive wrapping, one narrow-layout explanation; theme whole-file tests and consistency captures                                   |
| Tools                                                        | Existing embed configurator, shared editor dimensions and keyboard back; editor and consistency browser owners                                                                            |
| Settings: Settings, Connections, Creator Page, Billing, Team | Shared navigation, keyboard selection, ID containment, fields and account actions; settings whole-file tests, account browser owner and consistency captures                              |
| Settings team and agencies                                   | Shared shell/context, headings, panels and mobile width; consistency captures plus existing auth/team workflows                                                                           |
| Agency and allocations                                       | Account context, navigation, forms and surface contrast; agency consistency browser owner plus existing authorization workflows                                                           |
| Member card                                                  | Single main landmark, shared gutters, card/actions and badge empty state; member-card whole-file tests and consistency captures                                                           |
| Legacy embed/security/roles                                  | Source-inspected redirects to canonical tools/settings/team; existing redirect tests                                                                                                      |
| Account recovery                                             | Source-inspected protected recovery layout and actions; existing account/auth workflows. Its suspended-account state is not represented by the ordinary active-creator screenshot fixture |
| Gallery embedded clip preview                                | Source-inspected embedded-route bypass; existing gallery public/frame/player tests. The shell must not be added to embedded playback                                                      |

## Findings corrected at shared sources

- Dark secondary and tertiary foreground tokens incorrectly equaled their background tokens. Both now use the theme foreground; the browser measures contrast in both themes.
- A stale route could restore the previous account after a user switched workspaces. Route context is now applied once per requested organization, and the browser checks the actual displayed selected value after switching.
- Cold-load gallery edits could precede React handlers and revert during hydration. The shared resource-editor boundary now marks controls busy and disabled until hydration; a real blocked-chunk browser regression checks the first editable draft.
- Account context/profile controls competed with page content in the top bar. They now use the existing sidebar utility portal. Account dropdowns stay open while used; route navigation closes the mobile drawer.
- The inherited flex order moved the menu button to the right after the header change. Menu order is restored and its position is checked against the theme action.
- The first light-mode render selected a different icon than server rendering. Theme-dependent markup now waits for hydration, preserving one initial render and an enabled-state contract.
- Shared main content had no comfortable maximum width; resource lists added a second set of horizontal gutters. Width and horizontal padding now have one shared owner, including DashboardEditorLayout. Compact resource tables keep names/actions in view; their wide-column picker is desktop-only.
- Member cards introduced a nested main landmark. They now use a labeled section inside the shell's main.
- Overlay style used a different outer layout and omitted a resource heading beside Back. It now uses DashboardEditorLayout and a wrapping card header; duplicate narrow-drag guidance was removed.
- Settings' fixed tab-list width and wrapping labels fought HeroUI's built-in overflow controls. The library owns scrolling; labels stay on one line, the active section is brought into view, and real Tabs.Panel content supplies the selected tab’s accessible association. Tools and typography use the same compound-panel pattern.
- A long settings account ID pushed its row left of the card. Every flex level can now shrink, while the full value remains available to copy.
- Home's top clips opened a title search, which could select the wrong clip when titles repeat. The existing authorized preview opens the exact clip ID.
- Home showed redundant zero stat/empty cards and offered generic retry for missing authorization. Empty Home now offers the inventory action; missing authorization links to Connections.
- Gallery and Runner actions were raw SVG click targets. They now use the same named HeroUI Edit/Delete buttons as overlays and playlists, with real keyboard entry checks.
- Muted light-theme copy, status labels and destructive-button colors failed measured contrast. Shared tokens and semantic foreground classes now distinguish text from bright status backgrounds.
- Code snippets with horizontal overflow were unreachable by keyboard; their existing preformatted regions now receive focus. The empty playlist uses a proper list item.
- The gallery preview used a separate hard-coded canvas palette and unreadable empty text on a transparent background. The canvas now uses Clipify surface/foreground tokens; empty gallery content uses its configured card surface.
- Stream tables forced mobile horizontal browsing. Compact stream metadata stays with its title while wide columns remain available on desktop.
- Consent choices now use equal-width HeroUI actions on mobile, retaining compact desktop actions.
- The consent portal could mount after the support widget's one-time measurement. The widget now discovers and observes the actual banner after mount or drawer relocation; listeners and observers are cleaned up. A failing regression preceded the fix.
- Agency request and approval forms omitted the interactive Checkbox compound parts, leaving permission labels without controls. Both now use the installed Content/Control/Indicator parts and readable permission labels. Real keyboard tests verify request selection and narrowed approved permissions.
- Older mobile acceptance fixtures attempted to use hidden footer controls without opening the drawer. They now follow the visible mobile navigation path while retaining the export and draft-preservation assertions.

## Evidence rules

A route screenshot is visual review evidence, not proof that every action or state on that route works. Existing behavior owners remain required. The browser audit checks one main landmark, menu readiness and position, page containment, settings ID containment, keyboard tab selection, account menus, account switching, theme contrast and an empty page-error list. Resource captures wait for their seeded rows rather than crediting loading screens.

Rejected or interrupted runs remain failures in the defect log. The initial menu assertion used a label overridden by React Aria's trigger association; it was corrected to the actual accessible name. The later light-mode hydration failure was a product defect and was not filtered from page errors.

Local fixtures use disposable loopback PostgreSQL18 and test provider responses. CI owns PostgreSQL16 browser validation and the complete merged coverage gate. Live Twitch/Discord/YouTube/TikTok publishing and native Runner platform validation are outside this manual-export web feature. No migration or schema synchronization is part of this correction.

## Final local checkpoint

Affected coverage:23 suites / 578 tests, unchanged thresholds. Production build/typecheck, affected lint and formatting passed. Complete affected production-browser checkpoint:75/75, including 84 creator-route captures, axe checks on all audited routes, four agency layout/account cases, exact clip preview, consent/support and complete export recovery. Guide and authentication regression owners and the required published full CI are tracked separately in test-summary.md. The reviewed standalone actual before/after boards are preserved in `test-results/dashboard-audit/system-review/before-after-dark.html` and `before-after-light.html`.

Permission follow-up UI-033: the production build/typecheck and affected lint/format passed. Affected coverage passed23 suites/578 tests including both agency pages and the client boundary (85.01% statements,79.64% branches,83.22% functions,87.31% lines; unchanged floors). Four agency viewport/theme keyboard and accessibility cases and the complete22-case authentication owner passed against the rebuilt source. Earlier75-case and61-case checkpoints remain evidence for unchanged source paths; the final complete published CI is required for the combined tree.

Cold-load follow-up UI-034: the complete editor/consistency browser owners passed12/12 after the readiness fix, including all84 creator-route captures, all four agency matrix cases and the real first-edit blocked-chunk regression. Build/typecheck, affected lint/format and23-suite/578-test coverage passed. The prior published source passed full CI41769143667; the final follow-up requires its own exact-head gate.

## November 4 follow-up: navigation and download recovery

Settings categories and the two Tools destinations move into the existing HeroUI Pro sidebar. The inspected web references are [incident.io settings](https://mobbin.com/screens/f12f3e02-0c13-47da-8369-65164d7c8bc6), [Plain configuration](https://mobbin.com/screens/4d19fd1b-6159-4cbb-a36d-fa4c3a5fdd77), [LangSmith search/collapse](https://mobbin.com/screens/6a57382d-e087-4a8e-a985-463d655be513), and [Attio command navigation](https://mobbin.com/screens/fa567c5a-616d-4991-88fc-e2a047b5fcfd). These support grouped navigation, muted search and keyboard hints; Clipify retains its own HeroUI components, typography and purple accent. Tools grouping is our product decision, not a Mobbin requirement.

The clip detail route uses the existing resource-editor layout, a stable player, metadata and a primary MP4 download action. [Recraft media details](https://mobbin.com/screens/158afcb4-6f2b-44fe-8a3d-b0c1960a7d3a) was inspected for the relationship between preview, metadata and export, not copied as a new visual system. WeTransfer's returned result is a collection and was not used as proof of an individual clip detail pattern.

The customer's failed clip examples resolve to the exact Twitch CDN `d1ndex63qxojbr.cloudfront.net`. The urgent correction permits that verified hostname in addition to the current Twitch asset host, without accepting arbitrary CloudFront destinations. Commit 3f90936d passed complete CI run 41824905129. Real customer authorization/download is still a preview smoke check; automated tests use isolated accounts and fixture media.

Both ZIP and MP4 jobs share persistent creator-account budgets across members and instances. Playback URL resolution also reserves from the official provider request budget. [Twitch's official Get Clips Download reference](https://dev.twitch.tv/docs/api/reference/#get-clips-download) documents 100 requests/minute and at most 10 clip IDs/request. Manual jobs retain the existing three-jobs/minute safety bound, now stored in the existing database counters. No schema or generated migration changes are needed.

Operational export failures appear in a result dialog with toast feedback and readable clip titles. Refresh transport failures use toasts and retain the existing inventory and filter draft. Form filter validation remains local. Stable document scrollbar gutters address Sentry's body scroll lock; browser measurement must verify the actual SDK dialog. Initial page loading/unavailable states remain within their owning content surface rather than disguising missing data as success.

Published-checkpoint follow-up: root scrollbar stabilization is limited to desktop dashboard documents after real Runner360px and mobile editor390px failures. The final correction passed12 owning BDD scenarios, five acceptance scenarios (including real Sentry dialogs at both widths) and four account/subscription ATDD scenarios. Preview error assertions now verify toast/retry recovery, while navigation assertions use the actual expandable sidebar destinations. See the cycle log for failed and passing evidence; complete exact-head CI remains required.
