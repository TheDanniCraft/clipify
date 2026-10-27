# Landing page redesign delivery record

Current closeout and owner-only checklist: [landing-page-audit-closeout.md](landing-page-audit-closeout.md). Earlier sections below retain the implementation history.

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
- Trial verification and qualified promotion were completed in the revision below. Live production OAuth transport remains outside local fixture evidence.
- Durable creator, playback-day, checkout and paid-invoice outcomes were completed in the revision below. Production reporting and anonymous acquisition attribution still require verification.
- External help/affiliate content changes and verification, roadmap editorial reorganization, and rewriting published releases (pages 13–15). This branch does not modify external accounts or publish unverified program claims.
- Search-intent guides were completed in the revision below. Search Console selected-canonical checks, field performance, and mature retention/conversion cohorts require deployment evidence (pages 12–13, 19–20).

The PR is for preview and review. No production release, price change, schema change, or merge is authorized by this delivery.

## Revision after preview review

The initial delivery met functional checks but did not preserve enough of the product's visual character. The second pass restores the real dashboard image, varies the setup/benefit composition, removes repeated Free/Pro labels before pricing and removes redundant hero/demo explanations. The reassurance strip uses one column on narrow screens. A larger pill selector retains radio semantics and a moving visual indicator; savings are calculated from matching runtime currencies and suppressed for unresolved or promotional prices. Mobile pricing uses a continuous feature/Free/Pro comparison with a sticky column heading rather than nested accordions.

The `/features` destination explains capabilities, requirements and plan availability. It links to three distinct, substantive guides: `/guides/twitch-clips-in-obs`, `/guides/twitch-clip-playlists`, and `/guides/control-twitch-clip-playback`. Each covers requirements, ordered setup, limits, troubleshooting and a relevant next action. All four pages have their own titles, descriptions, canonicals and social URLs, appear in the sitemap and production marketing classification, and are connected through the homepage and footer. The guides describe requested imports accurately and do not promise retention gains.

Roadmap presentation now leads with Now and Next and collapses Shipped history. It preserves the CMS's actual statuses and content; it does not invent a reviewed date or new commitments. Changelog presentation highlights up to three published subjects without common internal-maintenance terms, shows a localized date beside the release, and keeps every published note available in expandable detail. This display heuristic does not replace human editing of future release subjects.

### Completed outcomes and trial verification

The existing audit-event store records `product:creator_created`, `product:trial_granted`, `product:checkout_created`, `product:first_playback`, `product:playback_day`, and `product:payment_verified`. A deterministic UUID includes deployment, outcome, creator and occurrence identity. Database conflict handling deduplicates transaction retries, concurrent reports and repeated invoice delivery. No schema or generated migration changes are required.

- Creator completion and trial records commit in the onboarding transaction. A returning login does not create a new creator or another new-creator trial.
- Checkout creation is recorded only after Stripe returns a session, separately from the existing Continue-click event. A persistence failure propagates to the caller so the existing idempotent checkout path can retry.
- Positive paid Pro invoices are recorded in the signed webhook handler, keyed by invoice ID. Checkout completion alone, unpaid invoices, zero-value invoices and trial grants are not payments. Invoice records include currency, amount in minor units and billing reason; renewals remain distinguishable.
- Activation is defined as a browser-reported active video progressing past the existing playback-confirmation threshold in a top-level, non-demo, non-embed, non-Runner-presentation player. The server validates the existing overlay capability and current runtime access, excludes the demo overlay, and derives creator identity itself. It is evidence of player use, not proof that OBS is transmitting to viewers. Browser reports can still be lost if a player closes before persistence succeeds.
- One record per creator per UTC day supports repeat-use cohorts. Client failures permit a later attempt with a one-minute cooldown. The server writes activation and the day record in one transaction. Dashboard iframe previews do not produce these reports.
- Product records are included in the creator's account export and deleted by the existing account-purge transaction. No third-party analytics request carries creator identifiers or private browser-source URLs.

`docs/marketing-outcome-report.sql` provides a read-only production-filtered creator cohort report and currency-separated invoice totals. Plausible still supplies eligible marketing traffic and intent. These two datasets are not represented as an individually attributed anonymous-visitor funnel, and historic outcomes cannot be reconstructed from the new records.

Disposable-account checks exercise the real onboarding hooks and entitlement resolution: a new Free creator receives seven-day Pro access without a billing subscription; expired access resolves to Free; concurrent returning-user retries preserve the single original grant. Qualified trial wording now appears in login and FAQs rather than repeatedly in the hero. Live Twitch authorization transport and production settings are separate deployment checks.

### Acceptance and external dependencies

Whole-file tests cover runtime savings, outcome persistence failures, invoice status, concurrent database deduplication, transaction rollback, creator exports/deletion, onboarding and trial expiry. Browser acceptance covers the revised features/guides and mobile comparison in both themes in addition to the original landing/login checks. The final build, coverage, visual review, preview smoke results and any lab measurements are recorded in the PR against the final commit.

Remaining audit work depends on access or evidence beyond repository implementation: permission-based creator scenes/quotes, external help-center consolidation and affiliate-program confirmation, Search Console selected-canonical inspection, production ingestion/report verification, real-streamer comprehension studies and mature retention/conversion cohorts. The new local guides address the setup/content gap but do not silently rewrite externally hosted articles. Current roadmap descriptions still need editorial ownership where shipped authentication work overlaps a broader future rewrite. No fabricated testimonials, study results, reviewed dates, affiliate availability or conversion improvements are published.

The externally hosted collaboration article was rechecked: it still promotes an affiliate registration destination that could not be fetched successfully (502 during review). This is not evidence of the program's commercial status. The owned footer now links directly to collaboration enquiries at the existing Clipify contact address, without promising affiliate availability. The external article needs its publisher's correction or confirmation.

The final loading trace identified an eager newsletter Turnstile challenge. Verification now mounts only after newsletter-form focus, uses its supported compact size on narrow screens, and still gates every submission on a valid token. The local regression test failed with the eager widget and passed after deferral; it also exercises expiry, optional-name submission, server errors and retry without sending real email. Footer coverage is now included in the normal coverage owner instead of its previous exclusion. Matched Lighthouse samples before and after the revision are reported in the PR, rather than compared directly with the audit's different lab environment.

Deployment labels use the existing `resolveBaseUrl()` runtime policy, including Coolify preview overrides, rather than assuming the public build URL always names the running environment. Paid-invoice dates use the signed Stripe event timestamp. The mobile comparison provides table, row, column-header and cell semantics. Root Twitter metadata keeps the card type but allows route-specific title/description fallback instead of inheriting the old homepage headline.

The final real-browser keyboard review found that the newsletter's opacity-hidden name step remained in the tab order. Both inactive step containers are now inert. Advancing focuses the name field, and Back restores email focus; confirmation-dialog focus stays owned by HeroUI. A dedicated browser case checks that Tab skips the inactive name field, and whole-file tests cover the handoff and return without sending email.
