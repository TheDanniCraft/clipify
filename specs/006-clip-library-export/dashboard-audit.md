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
- Older mobile acceptance fixtures attempted to use hidden footer controls without opening the drawer. They now follow the visible mobile navigation path while retaining the export and draft-preservation assertions.

## Evidence rules

A route screenshot is visual review evidence, not proof that every action or state on that route works. Existing behavior owners remain required. The browser audit checks one main landmark, menu readiness and position, page containment, settings ID containment, keyboard tab selection, account menus, account switching, theme contrast and an empty page-error list. Resource captures wait for their seeded rows rather than crediting loading screens.

Rejected or interrupted runs remain failures in the defect log. The initial menu assertion used a label overridden by React Aria's trigger association; it was corrected to the actual accessible name. The later light-mode hydration failure was a product defect and was not filtered from page errors.

Local fixtures use disposable loopback PostgreSQL18 and test provider responses. CI owns PostgreSQL16 browser validation and the complete merged coverage gate. Live Twitch/Discord/YouTube/TikTok publishing and native Runner platform validation are outside this manual-export web feature. No migration or schema synchronization is part of this correction.

## Final local checkpoint

Affected coverage:23 suites / 578 tests, unchanged thresholds. Production build/typecheck, affected lint and formatting passed. Complete affected production-browser checkpoint:75/75, including 84 creator-route captures, axe checks on all audited routes, four agency layout/account cases, exact clip preview, consent/support and complete export recovery. Guide and authentication regression owners and the required published full CI are tracked separately in test-summary.md. The reviewed standalone actual before/after boards are preserved in `test-results/dashboard-audit/system-review/before-after-dark.html` and `before-after-light.html`.
