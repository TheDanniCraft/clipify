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
