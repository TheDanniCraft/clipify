# Landing page redesign delivery record

This change implements the landing-page buying journey from the 25 October 2026 audit, including the detailed 23-page PDF. It preserves Clipify's purple identity and existing product workflows. It also corrects the closely related public metadata, signup orientation, avatar delivery, and plan presentation issues.

## Audit traceability

| Report pages | Recommendation                                                            | Implementation and acceptance                                                                                                                                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4–6          | Make Twitch/OBS explicit, show output early, explain the managed workflow | Clear hero and Free CTA, compact scene preview, three setup steps, three benefit groups, Free/Pro distinction, focused FAQ, final CTA. Browser journeys cover 320px, 390px, and desktop in both themes.                                                                                                                                       |
| 6–7, 11      | Avoid eager media and simulated retention evidence                        | One click-to-play real player, loading/error/retry states, skip and pause controls. The old fake chat, audience counter, mixer animation, and supporting code are removed. Scrolling offscreen or hiding the tab unmounts the iframe; resumption requires another action.                                                                     |
| 7, 14        | Describe community evidence accurately                                    | Existing visibility-filtered teaser data is preserved; no hard-coded user/payment counts or fabricated testimonials. Community copy directs people to actual visibility settings without claiming opt-in defaults.                                                                                                                            |
| 8–9          | Explain Free/Pro, imports, requirements, and signup                       | Free clip-library versus playlist limits are explicit. Imports are described as requested actions. Runner uses current included-with-Free/Pro terms, rather than obsolete add-on pricing. Existing runtime prices and checkout paths are preserved. Login explains saved setup and retains paid intent.                                       |
| 8, 11        | Substantiate popularity and improve CTA contrast                          | “Most Popular” becomes “More control.” Free actions use foreground text on secondary controls. Missing Pro prices disable the paid action and expose recovery on both pricing surfaces. Unsupported popularity and fixed savings claims are removed. Billing frequency uses one shared accessible single-selection control.                   |
| 10–11        | Reduce initial work and right-size assets                                 | Hero blur/opacity entrances and simulation timers are removed; the share image matches the new hero. The preview has responsive image sizes. Shared small avatars request a verified 70×70 Twitch CDN variant and load lazily.                                                                                                                |
| 12, 21       | Correct canonical inheritance and sitemap freshness                       | Homepage owns its category metadata. Pricing, community, changelog, roadmap, legal routes, and creator metadata identify their own canonical/social URLs. The root no longer supplies a homepage canonical to unrelated pages. Creator indexing restrictions remain intact. Request-time sitemap dates are removed and community is included. |
| 14           | Improve release date readability                                          | Changelog timestamps use the shared browser-localized date component; the footer calls the destination “Changelog.” No published release notes are rewritten.                                                                                                                                                                                 |
| 16–17        | Distinguish eligible acquisition traffic and deliberate intent            | Plausible receives a self-contained `traffic_scope` property; intentional homepage signup clicks and demo requests have separate events. Homepage pricing intent is distinguishable from dedicated pricing-page intent. Existing runtime events remain available.                                                                             |

The competitor observations on page 4 inform the emphasis on saved curation, styling, controls, and collaboration. The page does not claim those individual capabilities are exclusive or that Clipify outperforms competitors on retention or conversion.

## Measurement definitions

For acquisition reporting, filter **`traffic_scope=marketing`**. The code assigns:

- `marketing`: exact hostname `clipify.us`, top-level frame, and `/`, `/pricing`, `/community`, `/changelog`, or `/roadmap` (with optional trailing slash).
- `runtime`: other production routes, including dashboard/player/embed activity, or any iframe context.
- `nonproduction`: preview, beta, localized subdomains, and localhost.

This is an additive classification, not deletion of runtime reporting or a repair of historical data. Unfiltered all-route totals remain unsuitable acquisition denominators. A saved Plausible acquisition report must apply the property filter; production ingestion should be checked after deployment.

`marketing_cta_click` records the hero/final Free-start action and placement. `demo_requested` records an explicit start, retry, or resume action, not a successful activation. Pricing's `source=homepage` distinguishes it from the default `pricing_page` source. The pre-existing `checkout_start` event still means a Continue click; it is not proof that a processor session or payment exists.

## Validation evidence

The public UI acceptance includes automated WCAG A/AA diagnostics for the homepage at three widths in both themes, and for the dedicated pricing controls in both themes. These checks supplement manual screenshot and keyboard review; they are not a full accessibility certification.

Local prerequisites use Node 24.21.0, Bun 1.4.2, PostgreSQL 18 on disposable loopback port 54419, job-owned schema templates, and Chromium with OS dependencies. Browser data lives in a unique disposable database. No production/shared development data is used as a test fixture.

- Initial affected-test baseline: 2 suites / 6 tests passed.
- Latest focused unit/component checkpoint: 10 suites / 45 tests passed.
- Final production browser build, standalone deployment build, and their TypeScript checks passed.
- All 12 landing/login browser checks passed without scenario retries, including automated main-content WCAG A/AA diagnostics at 320px, 390px, and desktop in both themes, plus dedicated pricing in both themes.
- Full lint completed with no errors and five existing image warnings outside this change.
- Final browser, accessibility, production build, coverage, and PR/preview results are recorded in the PR. Keeping this document fixed allows those checks to share the same source fingerprint.

The browser demo-shell success test uses an existing repository MP4 fixture at the media boundary with real Chromium video, iframe behavior, and installed HeroUI controls. It checks actual playback progression and parent-to-player skip delivery. It does not substitute for testing live Twitch/network availability. A separate browser case exercises the real unavailable-demo route and recovery. The existing production public demo was inspected independently and played successfully.

## Work requiring separate evidence or delivery

- Consented creator scenes/quotes and streamer comprehension studies (pages 7, 14, 19). No endorsements or user-study results are invented.
- Trial promotion (pages 8–9). Source confirms a guarded seven-day grant, but a complete first-time/returning signup and expiry journey has not been verified for this release. Permanent-Free copy is published without a trial promise.
- Idempotent new-creator, first-real-playback, repeat-use, checkout-created, and verified-payment measurement (pages 17–18). These cross authenticated/backend/billing boundaries and are not represented as completed by browser click events.
- External help/affiliate content changes and verification, roadmap editorial reorganization, and rewriting published releases (pages 13–15). This branch does not modify external accounts or publish unverified program claims.
- Search-intent pages, Search Console selected-canonical checks, field performance, and mature retention/conversion cohorts (pages 12–13, 19–20).

The PR is for preview and review. No production release, price change, schema change, or merge is authorized by this delivery.
