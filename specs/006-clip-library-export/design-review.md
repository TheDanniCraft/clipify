# Dashboard design review

## Scope and reference evidence

The user rejected the initial dashboard and authorized applying the complete Mobbin audit. Preserve Clipify branding, installed HeroUI/HeroUI Pro, permissions, existing editors and manual export. Automated publishing remains outside this feature.

Authenticated Mobbin web searches returned these screens; their images were retrieved and inspected. They inform layout and interaction patterns, not copied branding:

- [Basedash](https://mobbin.com/screens/4d9c42f0-01f4-4fb5-98d6-6de335ec0d15): search belongs with persistent navigation.
- [Better Stack](https://mobbin.com/screens/612a14fd-8951-4043-ae81-836d97b21d92), [Confluence](https://mobbin.com/screens/011a7330-6662-4621-9729-cb0e1b65be41), and [Plane](https://mobbin.com/screens/1d036d2f-b8a3-4d4f-89af-150ec4e7e8ab): coherent sidebar/content surfaces and restrained utility headers.
- [Vimeo](https://mobbin.com/screens/8382f888-4477-4759-9a74-a27cb1270baa): compact media-library controls, with content receiving the available space.
- [Frame.io](https://mobbin.com/screens/369e8532-ecbb-439e-9e41-75ffa5bf387e): utilities belong in navigation rather than covering media.
- [Zoom](https://mobbin.com/screens/8ac631df-2124-44da-8199-2346d67375ac): media metadata stays readable in compact layouts.
- [Synthesia](https://mobbin.com/screens/c91d40b6-1010-4a41-90fb-7e2f9b65bd5e): secondary filtering is disclosed on demand.

Payload Bay PR13 remains pinned at `1560be1e9ac0339ebeebc774b19f57c4d4fe80ff`. Reinspection of its `dashboard-shell.tsx` confirmed that `NavigationSearch` is rendered inside navigation. The earlier decision to move Clipify search into the desktop content header was incorrect.

## Applied corrections

| Finding                                      | Correction                                                                                                                                       | Acceptance owner                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Search detached from sidebar                 | Brand and search in Sidebar.Header; collapsed icon, keyboard shortcut and mobile drawer handoff retained                                         | clip-library-layout; dashboardShell           |
| Purple navbar competing with sidebar         | Neutral content header using existing theme tokens; shared gutters                                                                               | clip-library-layout; dashboardNavbar          |
| Filters consume the first screen             | Title search stays visible; HeroUI Disclosure contains secondary filters and sorting                                                             | clip-library-layout; clipInventory            |
| Floating utilities cover content             | Guide, feedback and chat launchers use the sidebar footer on desktop and document footer on mobile; the expanded guide portals beside navigation | guide BDD; widget units; layout review        |
| Mobile table requires horizontal scrolling   | Clip rows retain views, date, category, duration and stream link in a compact metadata block                                                     | clip-library-layout; clipInventory            |
| Nested width limits and large gaps           | Remove the duplicate navbar/content width constraints                                                                                            | layout and editor acceptance                  |
| Selection area dominates the page            | Compact action row; contextual clear-selection and export limits                                                                                 | recovery acceptance; clipInventory/clipExport |
| Home repeats resource navigation             | Canonical sidebar navigation; mobile guide shortcuts only during an active guide                                                                 | guide BDD; creatorOverview                    |
| Two unexplained refresh actions              | One Refresh library action reads current results and requests synchronization; accepted requests expose a contextual check action                | recovery acceptance; clipInventory            |
| Stream breadcrumb says Editor                | Stream-specific breadcrumb                                                                                                                       | layout acceptance; dashboardShell             |
| Search opens a title query instead of a clip | Shared authorized preview opens the selected clip ID and restores focus                                                                          | layout acceptance; dashboardShell/clipPreview |
| Earlier visual acceptance was insufficient   | Inspect actual screenshots and exercise real components, filters, preview, focus, exports, guide and editor recovery                             | test-summary.md                               |

## Evidence boundaries

The previous four screenshots and successful no-overflow assertions did not establish acceptable UX. The audit HTML in ignored `test-results/dashboard-audit/audit.html` records that rejected baseline and the eight inspected references. Current acceptance captures Home, Inventory, expanded filters, Streams and a stream detail at390px,820px,1024px and1440px in both themes. Only completed runs and inspected artifacts are credited in test-summary.md; no mock-component test substitutes for browser acceptance.

## Batch export modal

Reviewed Mobbin Proton transfer panel (https://mobbin.com/screens/12f6528d-e78a-4540-9087-784c0baa9172) and Teachable bulk upload (https://mobbin.com/screens/c81d368e-2376-414b-8fa8-c24983c6bd9c). Adopt named per-file progress, a reopening launcher and compact completed history, using installed HeroUI Modal/Spinner/Disclosure/Button and Clipify tokens. Preserve the accepted clip inventory table and portrait editor. No invented percentage while the server is processing.
