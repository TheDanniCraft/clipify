# Public pages and HeroUI review — 29 October 2026

## Direction

The review viewport is a phone in portrait orientation. Keep Clipify's purple
identity, the playback-first hero and the three setup steps. Replace the old
`appSkew.webp` presentation with current product views, give each feature its own
visual, and use fewer repeated cards. Keep the pricing comparison table.

Marketing pages explain what the product does. The Help Center remains the home
for full instructions and troubleshooting. Existing `/guides/*` URLs remain
available with their metadata and links to the relevant Help Center article;
they are not removed or redirected into unrelated content.

## Library inventory

The official unified HeroUI catalog reports 73 OSS and 66 Pro components.
Registry checks on this date found `@heroui/react` and `@heroui/styles` **3.2.7**,
and `@heroui-pro/react` **1.0.0-beta.10**. Update the two OSS packages to the matching
patch; Pro was already current. There is no reason to upgrade unrelated packages.

| Component                       | Decision                                                       | Reason                                                                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pro Timeline                    | Use for releases and roadmap                                   | Semantic ordered milestones, decorative rails, current-state semantics; avoids custom timeline geometry and oversized nested cards.                                                                            |
| OSS Tabs                        | Omit from the roadmap                                          | One continuous timeline keeps upcoming work and shipped history visible without switching views.                                                                                                               |
| OSS Link                        | Use for secondary gallery navigation and help links            | Navigation should read as navigation, with a visible focus target.                                                                                                                                             |
| Pro Hover Card                  | Good for optional creator previews                             | It supplements an existing focusable link. It must not make essential content hover-only on phones.                                                                                                            |
| Pro Holo Card                   | Closest match for the current Member Card's foil/tilt behavior | Hover Card is a preview container; Holo Card is the card treatment. A future replacement must retain the existing export/share rendering, identity and badge data, reduced-motion behavior and touch handling. |
| Pro Carousel                    | Retain where already useful in galleries                       | Do not add an auto-advancing screenshot carousel to the homepage. It would hide product explanations and add unnecessary runtime work.                                                                         |
| Pro Floating TOC                | Consider only if feature documentation grows substantially     | The current six feature anchors are sufficient and simpler on a phone.                                                                                                                                         |
| Pro Kanban                      | Do not use for the public roadmap                              | Horizontal board lanes would make portrait reading harder; milestones are read-only history, not draggable work items.                                                                                         |
| Pro Item Card / Item Card Group | Available for resource collections                             | No need to replace clear feature stories with another inventory of cards.                                                                                                                                      |
| Pro Stepper                     | Do not use for release history                                 | Steps describe a user's sequence; published releases are chronology.                                                                                                                                           |

Primary references:
[Timeline](https://heroui.pro/docs/react/components/timeline),
[Hover Card](https://heroui.pro/docs/react/components/hover-card),
[Holo Card](https://heroui.pro/docs/react/components/holo-card),
[Carousel](https://heroui.pro/docs/react/components/carousel),
[Tabs](https://heroui.com/docs/react/components/tabs).
Installed declarations and CSS were checked before composition.

## Product imagery and performance

The website serves optimized static WebP assets, not an embedded dashboard.
The playlist and Theme Studio images capture the actual current local app using
a disposable account. The overlay image captures public demo output. Controller
images use the installed controller and real local WebSocket transport with a
controlled example player state; they do not claim a measured broadcast outcome.
Public demo clips are examples, not creator endorsements or testimonials.

Portrait-specific playlist, Theme Studio and controller crops keep controls
readable instead of shrinking the complete desktop interface. Native picture
sources select a single crop. Below-fold images remain lazy-loaded with explicit
intrinsic dimensions. No carousel, dashboard hydration, autoplay, timers or API
requests are introduced for these product images.

The temporary capture account, credentials and private streaming-source URLs are
not published. Captures were inspected for private URLs, consent banners and
floating support controls before use. Image versions correspond to this branch's
current app, not to the previous dashboard design.

Three matched fresh Chromium runs at 390 × 844, with no interaction, measured:

| Initial resource     |        Before |         After |
| -------------------- | ------------: | ------------: |
| JavaScript transfer  | 640,522 bytes | 639,932 bytes |
| Image transfer       |  10,278 bytes |  14,970 bytes |
| Requests             |            40 |            40 |
| Video/media requests |             0 |             0 |

Local median LCP was 276 → 236 ms and summed blocking portions of long tasks
31 → 5 ms. These are unthrottled local samples, not Lighthouse scores, field data
or evidence of a conversion lift. The small image increase comes from the updated
product capture; no dashboard runtime is loaded for it.

## Content boundaries

Collaboration enquiries now link to the existing
[collaboration overview](https://help.clipify.us/hc/clipify/articles/1756597294-collaborations)
before asking someone to email. This does not independently verify the affiliate
program's operational status.

The public roadmap still uses published CMS records. The auth-system rewrite's
future scope/status needs editorial confirmation against the work already shipped;
a presentation change must not silently invent that decision. The continuous timeline shows upcoming work first, followed by shipped records in
reverse published order, without tabs or an accordion.

The Help Center's older Getting Started article and chat-command terminology need
an external editorial pass. Existing repository drafts remain available for that
publication work. This change does not overwrite external articles or manufacture
a reviewed date.

The existing code graph was used to locate related surfaces, then checked against
current source because the graph predates this public-page revision. A complete
graph rebuild was not necessary for these bounded changes.

## Validation of preceding revision (`5be6c495`)

Rebased on master `5801b671`. Eight affected whole-file Jest suites passed
74 tests, including account-export/onboarding conflict coverage. The browser build
and its TypeScript check passed. New release-summary, footer-destination and roadmap
filter expectations were first observed failing, then passed after implementation.

Assert-based browser review covered 20 route/viewport/theme combinations using
installed components: portrait product-image decoding/aspect ratios, populated
roadmap filters and arrow-key operation, WCAG A/AA diagnostics, no horizontal
overflow, no page errors, and screenshots inspected in both themes. Local roadmap
records were controlled disposable fixtures; deployed CMS content remains a
separate preview check.

The complete landing-page acceptance file passed all 33 real Chromium checks,
without retries, including demo playback/recovery, pricing, consent, gallery
focus restoration, metadata and 320/390/1440px light/dark layouts.

The deployed preview also passed eight portrait route/theme checks with its real
release and roadmap records, including status filtering and image loading.
The final follow-up restores explicit Runner inclusion wording; its existing
commercial contract test retains all offer and hardware assertions.

Complete coverage and the final merge gate remain CI responsibilities under the
current repository validation strategy. This is a draft PR, not merge approval.

## Homepage review follow-up

The homepage's “Your best moments” section now shows actual player output in a
static purple BRB scene. It does not imitate Twitch/OBS application chrome, add
fake audience data, autoplay media or mount the dashboard. Playlist editor imagery
remains on Features and the playlist guide, where it explains selection.

The community link has its own two-line portrait layout and extra space before
the setup section. The shared teaser still caps visible avatars at five and
calculates the remaining count from the directory total; it never hard-codes “+5”.
Other public pages retain the compact footer teaser; they do not share the old
homepage's crowded community-to-setup transition.

Release summaries strip emojis only for website presentation. Updated AGENTS.md
requires future release notes to be written from squash-merged PR outcomes and
verified final diffs, with multiple distinct outcomes per PR where useful. Commit
subjects/PR titles retain Gitmoji. Existing published GitHub notes are unchanged.

Public routes changed in the preceding refinement: `/`, `/features`, `/pricing`,
`/gallery`, `/changelog`, `/roadmap`, `/guides/twitch-clips-in-obs`,
`/guides/twitch-clip-playlists`, `/guides/control-twitch-clip-playback`, and shared
footer navigation. The remote controller route and behavior were not changed;
its image was captured for the Features page. This follow-up changes Home and
Roadmap plus repository release-note guidance.

Follow-up checks: three affected whole-file suites / eight tests passed, including
reverse shipped ordering, immutable inputs, and the five-avatar/remaining-count
contract. The ordering expectations were first observed failing before the change.
Twelve real-browser route/layout/theme checks passed for Home and populated
Roadmap at 320/390/1440px, with WCAG A/AA diagnostics and screenshots reviewed.
All six existing homepage interaction scenarios passed without retries. The final
browser build/TypeScript and changed-file lint/format checks passed. The previous
33-scenario result above is historical; unchanged scenarios were not rerun.

## Image, navigation and timeline revision

Features now uses consistently framed 4:3 captures. Desktop UI assets are
1800×1350 from native 3× browser rendering, with phone-specific crops where useful.
The full controller panel is retained on phones. The homepage uses a fresh native
1920×1080 playback capture without a surrounding BRB frame or heading. Source video
resolution was verified before capture; no low-resolution frame was enlarged.
Static WebP files are served directly to preserve text detail, with intrinsic
sizes, phone sources and lazy loading. The previous small crops are replaced with
eight current files, totaling under 800 KiB; only the requested page's imagery loads.

The Theme Studio fields/canvas screenshot is removed. The section explains styling
without a poor or fabricated preview. The OBS guide uses a source-settings reference,
the playback guide has a command reference, and the playlist guide has its own
selected-clips image. Decorative repeated guide hero images and captions are gone.

Features no longer has a link inventory or “Clipify, up close” heading. Navigation
is part of the relevant explanation. Generic Explore Clipify links are removed
from Gallery/guides and replaced with contextual links on Home. Gallery's actual
interactive example is part of the page layout, after its introduction and action.
Help links, including the dashboard and tour support links, target specific articles.

Roadmap follows the official HeroUI Centered Milestones example: alternating
milestone cards on desktop and one compact rail on phones. Changelog keeps a
compact version-history rail and shows all creator-facing release lines without
a duplicate raw-notes accordion. Version titles remain direct GitHub links.

At the owner's explicit request, leading Gitmoji were removed from all 94 existing
published GitHub release bodies. A before/after comparison verified every body
against the backed-up original, preserving all other text and line endings. Tags,
assets and release targets were not changed. This external publication edit is
separate from this branch's code.

Current verification: 11 affected whole-file suites / 116 tests passed; the footer
owner's five tests passed again after the initial-animation correction. Twenty-four
real Chromium route/layout/theme checks passed, including 4:3 geometry, decoded
source images, specific Help Center article URLs, populated milestone history,
WCAG A/AA diagnostics and screenshots reviewed in light/dark. The browser build
and TypeScript check passed.

Three fresh unthrottled local 390×844 runs measured 639,958 bytes of initial JS
and 190,865 bytes of images, with no video, demo iframe or dashboard requests.
Compared with the preceding 639,932/14,970-byte sample, JS is essentially unchanged
and initial image transfer increases by about 172 KiB to retain native HD playback
detail. All current product assets together remain below 800 KiB and are lazy-loaded.
These samples are not Lighthouse scores, field performance or conversion evidence.

All 33 current public-page acceptance scenarios passed without retries, including
real installed pricing/demo/gallery controls, recovery, consent, keyboard focus,
article references, mobile comparisons and signup contrast. Changed-file lint and
format checks passed. No production OAuth, purchase or newsletter email was used
as a test fixture. Full merged coverage and platform gates remain CI-owned.

## Consistency review, 29 October

The public-page branch was checked as one site rather than as independent page
compositions. The homepage keeps its purple playback hero; feature, gallery,
pricing, release-history and roadmap introductions now use the same
`PublicPageHeader`, container width, heading scale, description treatment and
bottom divider. Decorative update/roadmap eyebrows and the full-width Features
banner have been removed. Community keeps its existing creator/avatar hero and
uses factual public-profile wording without an analytics disclaimer in the page.

| Surface      | Correction                                                                                                                                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home         | Two different cached highlights replace the low-view screenshot material: Minecraft in the demo cover, Counter-Strike in the supporting player image. The existing layout and copy remain.                                                                                                               |
| Features     | Two equal, shrinkable desktop columns and wrapping headings prevent the OBS title from clipping. Images preserve their native proportions. The overlay settings now use complete desktop and narrow captures rather than a forced 4:3 crop. Setup links go straight to the relevant Help Center article. |
| Gallery      | Uses the same introductory layout as the other information pages. Removes the separate plan-limit paragraph and demo-loading gate; renders up to 12 authorized public-demo clips immediately. Gallery playback, recovery and the installed modal remain.                                                 |
| Pricing      | Uses the shared introduction and gutters, preserving the monthly/yearly control and Free/Pro table on desktop and phones.                                                                                                                                                                                |
| Changelog    | Keeps the compact release-history timeline and complete release subjects. Version headings are plain text; the page no longer adds GitHub links.                                                                                                                                                         |
| Roadmap      | Keeps one continuous milestone timeline, upcoming first. Restores each published CMS icon and color on its timeline marker, while status remains separately visible. Icon resolution stays on the server.                                                                                                |
| Setup guides | The three existing guide routes return permanent redirects to exact Help Center articles. Their duplicate article bodies and sitemap entries are removed. No second publishing system or runtime HTML ingestion is introduced.                                                                           |
| Demo player  | Explicit route-level `noindex, nofollow` survives deployment to production, where the preview-wide indexing block does not apply.                                                                                                                                                                        |

### Screenshot selection and fidelity

`marketing-clip-pool.json` records six candidates selected from the connected,
approved creator's cached collection, sorted by views and varied by category.
The search scanned 172 clips and reported a complete cached collection; this is
not a claim about every Clipify creator or every clip on Twitch. Footage was
inspected before choosing frames. Counter-Strike has 111 cached views and
Minecraft has 33 at capture time. The source frames are 1664×936 and 1920×1080.

Player images use the real rendered Clipify scene with a reviewed native video
frame frozen into its browser snapshot. They are static product illustrations,
not a claim that audience behavior or a playback timestamp was measured. The
playlist and control captures use real matching clip titles, thumbnails and view
counts in a disposable local account. Theme Studio shows the actual installed
color-picker controls at browser zoom; no fictional editor controls are added.
The floating support-chat control is excluded from that product crop.

No production creator settings, playlists or media were changed. No video or
live dashboard is loaded just to show these static images. The screenshot pool
is editorial source data, not a client bundle or a new automated Twitch fetch.

### SEO evidence and remaining external checks

The authenticated CrawlSEO connection was verified and its latest existing
production crawl and Search Console aggregates were read. Direct production /
preview responses confirm that route-specific canonicals, social URLs and
changelog/roadmap titles are corrected on the branch. Static sitemap dates are
no longer fabricated from request time. Preview `noindex` protection is expected.
Guide redirects now consolidate setup content in the Help Center.

CrawlSEO's existing crawl still describes production, not the unreleased preview.
Its reported creator URL failure and weakly connected public profiles were subsequently investigated and fixed; see the creator discovery section below. Profile privacy settings are preserved. Its
performance reports cannot establish a preview performance improvement, and
Search Console cannot establish a ranking effect before release and recrawling.
The MCP inventory reads existing crawls; it does not provide a tool to start a
fresh preview crawl. Google-selected canonicals require URL Inspection after
release. Existing Help Center content and screenshots still need their publisher's
update; redirects do not silently rewrite external articles.

### Validation for the consistency corrections

- Final browser build and TypeScript passed. Changed-file ESLint and Prettier passed.
- Twelve affected coverage suites passed: 98 tests, 93.26% statements, 88.44% branches, 94.44% functions and 94.58% lines. Existing global and stricter gallery thresholds were retained. This is affected Jest coverage, not the complete native/MCP merge gate.
- Demo image-import and icon fallback checks passed after the final source edit. The separately affected community and demo whole-file checks passed too.
- All 42 assert-based route / width / theme checks passed across Home, Features, Gallery, Pricing, Changelog, Roadmap and Community at 320/390/1440px in light/dark. Checks included installed controls, decoded matching image proportions, heading bounds, CMS milestone icons/colors, direct article destinations and WCAG A/AA diagnostics. All guide routes returned 308 to their exact Help Center article; the standalone demo emitted noindex.
- Asset checks verify all eight feature desktop/mobile images are exactly 4:3 and at least 1080px wide. Native playback captures are 1664×936 and 1920×1080. Ten product WebP files total 684,966 bytes; the source hero PNG is 791,896 bytes and uses a content-hashed optimized URL. No matched Lighthouse or field-performance improvement is claimed for this slice.
- All 27 current public-page Chromium acceptance scenarios passed without retries. Former guide-page contrast checks were replaced by exact redirect checks; marketing canonical checks cover retained indexable pages. Gallery playback/retry/focus, signup contrast, demo lifecycle, pricing, consent and mobile keyboard behavior remain covered.
- The PR remains draft. The complete required CI gate still belongs to ready-for-review before merge.

### Live-data and standalone-compiler follow-up

The first pushed CI run exposed a PNG import declaration missing from a standalone
`tsc --noEmit` run before Next generates `next-env.d.ts`. Removing that generated
file locally reproduced TS2307. `src/next-image.d.ts` references Next's installed
image declarations; the same standalone command then passed with the generated
file still absent. No compiler setting or threshold was relaxed.

The first live portrait review also exposed an avatar fallback with an accessible
name on a generic element. All three public Avatar uses now explicitly use the
image role, preserving the creator/status name when a portrait fails. The
regression tests failed before the correction and passed afterward. Six disposable
public profiles with unavailable portraits exercised eleven real installed avatar
fallbacks, the five-avatar cap and +1 count, in both themes without A/AA findings.
Populating the directory also exposed a homepage community-row overflow at 200%
zoom; its existing flex layout now wraps within the available width.

The avatar follow-up coverage: 13 suites / 103 tests pass with the unchanged thresholds
(93.26% statements, 88.35% branches, 94.53% functions, 94.55% lines). Homepage and
avatar whole-file checks also pass. The production browser build passes with the
explicit declarations. All 27 browser scenarios passed again with the populated fixture, including
200% reflow. The dedicated 640px / 200% zoom check measured 640px document
width and no overflowing elements.

### Roadmap first-response correction

Two fresh preview deployments initially served the cached “Roadmap unavailable”
build-time fallback, then showed all fourteen published milestones after
revalidation. The roadmap now awaits Next's `connection()` before reading the
existing cached CMS loader, matching the request-boundary pattern already used
in the application. Milestone ordering, content, icons and colors are unchanged.

A request-boundary regression failed before the change and passed afterward. A
browser build with CMS credentials deliberately absent completed successfully and
classified `/roadmap` as dynamic. Supplying the local CMS credentials only at
runtime produced an immediate 200 response with its four controlled milestones
and `private, no-cache, no-store` headers. All 27 browser scenarios passed again
with the populated directory. Affected coverage is now 14 suites / 104 tests,
93.14% statements, 88.22% branches, 94.16% functions and 94.51% lines, with
all existing thresholds retained. Changed-file lint and formatting passed.

### Portrait review follow-up

Login now uses the normal theme background, compact branding and one full-width
primary Twitch action. Existing checkout continuation, signed OAuth parameters,
retry handling, legal links and email-default wording are preserved. Login and
Runner enrollment have distinct metadata and explicit utility-page noindex rules.

Community avatar groups reserve space for their rings; the inner hero no longer
clips those rings. Roadmap icons now identify the timeline steps themselves.
The pricing control centers its two plain labels independently of the annual
savings note. The Runner link describes the setup guide rather than introducing
Runner like a person.

Gallery metadata is loaded on the server and passed to the existing renderer.
The public source authorizes the same demo clips as before, now requesting up to
12 rather than three. Videos still load only on clip selection. An unavailable
source retains local retry; closing the player cancels stale results and restores
keyboard focus. Phone layouts use two columns and larger screens use three.

The overlay screenshots were freshly captured from the actual editor, including
the selected playlist and the complete controls through Customize Overlay Style.
Desktop is 2028×1512 and narrow is 1416×1560, captured at native 3× resolution;
neither is stretched or forced into 4:3. These supersede the earlier asset-size
and 4:3 checkpoint above. Other product images retain their native dimensions.
No editor is mounted on the public Features page.

Affected coverage passes with unchanged thresholds: 19 suites, 135 tests;
92.55% statements, 87.41% branches, 93.38% functions and 93.84% lines across the
selected sources. The strict gallery owner thresholds pass separately within that
run. Build/TypeScript and changed-file ESLint pass. Final browser and pushed CI
results belong to the PR's current head.

[CrawlSEO reconciliation and acceptance criteria](landing-page-audit-closeout.md#crawlseo-reconciliation--29-october-2026)
separates implemented branch corrections from profile-data checks and production
recrawl/performance verification. It does not claim ranking improvements.

### Creator discovery and localized routes

The remaining CrawlSEO profile findings were investigated against public HTTP
responses and the connected read-only database. The reported localized account
is enabled/discoverable; its existing URL returned 404 because content lookup
received a percent-encoded name while metadata lookup received the decoded name.
A disposable account reproduced that mismatch. Both route lookups now decode the
parameter consistently, returning 200 and the correct encoded canonical.

The community snapshot's overlay join excluded 35 of 127 discoverable profiles
at investigation time. Removing that requirement aligns directory coverage with
sitemap eligibility. Creator names now link to their saved Clipify path; their
current Twitch login remains separate. Fresh visibility filtering excludes
unlisted, unpublished and disabled profiles even when an older snapshot remains.
Unlisted profiles remain accessible by direct link and emit noindex/nofollow.
No production account or profile settings were changed.

Validation: 25 affected suites / 165 tests passed with unchanged thresholds
(89.97% statements, 83.33% branches, 93.5% functions, 92.34% lines across selected
sources; strict gallery owners pass). Production browser build/TypeScript and
changed-file lint passed. Four real Chromium scenarios passed without retries:
phone/desktop in light/dark, actual keyboard profile navigation, a Unicode name,
a creator without an overlay, correct canonical/sitemap inclusion, and subsequent
unlisted/unpublished/disabled removal with cached snapshot data retained.

## Final screenshot canvas correction — 29 October 2026

This supersedes the earlier 4:3 crop and asset-size entries above. Product assets now retain complete native component bounds, rather than a common aspect ratio. Actual installed editors were captured from disposable local fixtures at 3× device scale:

| Image                                 | Desktop pixels | Narrow pixels |
| ------------------------------------- | -------------- | ------------- |
| Playlist workspace                    | 2208 × 2007    | 1428 × 2103   |
| Overlay settings                      | 2196 × 1488    | 1416 × 1560   |
| Theme typography and full color popup | 2112 × 2487    | 1380 × 2511   |
| Playback control card                 | 2202 × 576     | 1446 × 588    |

The complete Theme Studio picker includes its hue, RGB, opacity and reset controls. An open popup naturally overlaps fields beneath it; neither its bounds nor the typography card is cropped. Narrow images are selected below 480 CSS pixels; wider layouts use the higher-resolution desktop captures. Static imports provide actual dimensions and content-hashed filenames. Images use natural height rather than object-cover framing; no live editor or new animation workload is mounted.

The unchanged native playback image is 1664 × 936. The retained selection asset is 1800 × 1350 and is not currently used. All ten WebPs, including the unused retained asset, total 1,027,896 bytes. This is an image-quality correction, not a claim of improved Lighthouse performance. Offscreen images remain lazy-loaded.
