# Clipify audit closeout

This is the current delivery checklist for the 25 October 2026 written feedback
and 23-page audit. The original plan and delivery record include historical
checkpoints; this document distinguishes repository delivery from evidence that
requires people, external publishing, or a production release.

## Repository delivery

| Audit pages | Recommendation                                                | Delivery                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4–6         | Explain Twitch/OBS and the saved workflow immediately         | Clear hero, output preview, setup steps, three benefit groups, actual dashboard image, features destination and final CTA                                                                                                |
| 6–7         | Demonstrate functionality without invented retention evidence | Real click-to-play video, retry/skip/pause, offscreen cleanup; scripted counters and chat removed                                                                                                                        |
| 7, 14       | Use accurate community evidence                               | Visibility-filtered teaser retained; shorter directory hero; factual public-profile wording without claims about paying subscribers or active usage                                                                      |
| 8–9         | Clarify limits, imports, pricing and signup                   | Library/playlist distinction, requested imports, runtime billing/savings, readable mobile comparison, qualified trial wording and checkout continuity                                                                    |
| 8           | Runner and Pro-only purchase route                            | Current code includes optional self-hosted Runner with Free/Pro; no obsolete add-on price restored; selected Pro total remains clear                                                                                     |
| 9           | Verify eligible trial creation, expiry and returning users    | Disposable-account integration checks; live OAuth transport remains a production acceptance check                                                                                                                        |
| 10–11       | Remove eager media and unnecessary initial work               | Intent-loaded demo, smaller avatars/responsive images, immediate hero, interaction-loaded Turnstile without removing verification                                                                                        |
| 11          | Contrast, keyboard, ARIA and reflow                           | Free CTA contrast, radio/table semantics, menu and dialog keyboard behavior, newsletter inert/focus fix, public consent/chrome and 200% CSS-zoom reflow checks                                                           |
| 12, 21      | Canonicals, titles, social metadata and sitemap               | Route-specific metadata including creator/legal routes, no request-time marketing lastmod, creator visibility restrictions preserved                                                                                     |
| 13          | Publish focused search-intent content                         | Features explain the user jobs; setup links go directly to maintained Help Center articles. Existing guide URLs permanently redirect to those articles, avoiding duplicate content ownership                             |
| 14          | Changelog and roadmap presentation                            | Localized release dates and complete readable release subjects without GitHub links; one continuous roadmap, upcoming first, with original CMS icons and colors                                                          |
| 15          | Demonstrate a gallery before signup                           | Existing gallery renderer with an immediately rendered public demo collection (up to 12 clips), selection-loaded video in a HeroUI modal, playback retry and Twitch fallback; no private gallery or invented endorsement |
| 16–17       | Separate acquisition traffic from runtime/preview             | Production top-level route classification; explicit CTA/demo/auth-start intent; checkout creation distinct from Continue clicks                                                                                          |
| 17          | Record completed creator outcomes                             | Transactional signup/trial, first playback/daily return, created checkout and signed positive paid invoices; deterministic deduplication and account export/purge handling                                               |
| 17, 19–20   | Activation timing and retention reporting                     | Read-only cohort SQL with median time to first playback, mature D7/D30 return windows, denominators and numerator counts                                                                                                 |
| 17          | Billing guardrails                                            | Current subscription cancellation/payment-problem counts; signed failed-invoice and succeeded-refund records, deduplicated refund identity and currency-separated reporting                                              |

The competitor comparisons informed category clarity, early output, saved setup
and practical operational explanations. They do not justify claims of exclusive
features, better competitor conversion, or measured retention lift. Prices were
not changed.

### Measurement definitions and operational notes

- `auth_started` means pressing Twitch connection, not completed authentication.
  Its coarse `source` distinguishes login, checkout and OAuth authorization.
  Signed return URLs, email addresses and creator identifiers are not sent.
- `traffic_scope=marketing` must be applied in Plausible acquisition reports.
  Eligible routes include home, pricing, community, changelog, roadmap, features,
  gallery. Legacy guide routes redirect to the Help Center. Preview/iframe activity remains separately
  classified. Existing unfiltered reports and historical contamination are not
  repaired by adding this property.
- First playback means observed video progression in an authorized top-level
  creator player. It does not prove OBS broadcast reception. Demo, iframe and
  Runner-presentation activity is excluded. Reports may be lost before persistence.
- Retention D7 means a recorded return 7–13 elapsed days after activation, with
  only creators activated at least 14 days ago eligible. D30 uses days 30–36 and
  a 37-day observation period. Numerators and mature denominators are reported
  separately; young cohorts are not silently counted as failures.
- Basic multiple-UTC-day use is a different measure from those return windows.
  The activation timing/retention report covers recorded new-creator cohorts.
  It does not reconstruct historical signups or add anonymous visitor attribution.
- Checkout cadence is derived from the products actually sent to the processor,
  including explicitly monthly selections passed through a yearly-default caller.
  Mixed selections are labeled `mixed`; prices and billing behavior are unchanged.
- `invoice.payment_failed` records signed failed attempts by event identity.
  Current billing state provides cancellation and overdue/unpaid guardrails.
- `refund.created` and `refund.updated` record positive succeeded refunds by refund
  identity, only when the charge customer maps to exactly one known creator.
  Pending/failed refunds and ambiguous ownership do not count as returned money.
  These records do not alter fulfillment, entitlements or cancellation behavior.
- Refund guardrails can concern older or other creator charges. They are separate
  from gross positive Pro invoices and must not be subtracted to claim net revenue.
- The release operator must verify that the existing Stripe endpoint delivers
  `refund.created` and `refund.updated` alongside its existing billing events.
  No Stripe endpoint configuration or production setting was changed here.

The cohort and billing queries are in [marketing-outcome-report.sql](marketing-outcome-report.sql).
Run against the intended environment with read-only access. Account deletion
removes product records, so aggregates are not an immutable accounting ledger.

## Only input or access still needed from the owner

- [ ] Provide two or three creators' scene examples and concrete quotes, with
      permission to publish their attribution and assets. Public directory
      visibility is not testimonial permission.
- [ ] Provide help-center editing access or identify its publisher. The existing
      Getting Started screenshots and overlapping growth articles require external
      edits. The website now links or redirects to those articles as the sole maintained setup guides.
- [ ] Confirm whether the affiliate program is active, paused or discontinued,
      and its correct destination if active. The owned footer offers contact;
      external articles and any legacy redirect must match the confirmed status.
- [ ] Choose whether new creator community/profile visibility should remain
      public/discoverable by default or require an explicit onboarding choice.
      This delivery corrects wording and preserves current defaults.
- [ ] Confirm the scope/status of the future authentication roadmap item so it
      can be distinguished from shipped work and genuinely marked reviewed.
- [ ] Inspect Google-selected canonicals after release using Search Console URL Inspection. Aggregate query/page evidence is now available through the connected CrawlSEO server.
- [ ] Supply willing unfamiliar streamers for a small comprehension/setup round
      and a creator who can validate OBS audio, scene transitions and moderation
      in their own streaming setup. Recruitment/contact requires owner involvement.
- [ ] Review the preview and approve a production release when satisfied.
      The PR remains draft until its final review/full-CI checkpoint.

No new Plausible connection, price decision, migration permission, or permission
to write more repository code is required for this delivery.

## Checks we own after a release

These are follow-through work, not additional questions for the owner: verify
production traffic properties and saved reporting filters using the existing
Plausible connection; verify actual OAuth, trial, checkout, payment/refund delivery
and cohort persistence in an appropriate controlled journey; recheck live public
metadata; inspect Search Console after recrawl once access exists; observe field
performance and mature cohorts. Do not promise a conversion uplift before those
observations exist. Real purchases, external messages and production configuration
changes are not silently performed by a preview implementation.

The original audit's full numerical retention simulation was intentionally
replaced with actual playback. No need remains to disclose removed fake counts.
Broad structured-data expansion and price experimentation were optional later
ideas, not prerequisites for closing this repository work.

## Validation

Final local test, browser, build and CI results are recorded in the PR against its
pushed commit. The browser gallery success case controls the external media result
with a real MP4 while retaining installed controls, renderer, real server-action
transport, video progression, Escape/focus restoration and failure recovery.
The 200% reflow check uses CSS zoom in Chromium; it is not a claim of a full manual
screen-reader or all-device accessibility certification. The underlying clip may
require its creator's captions; the demo does not invent a transcript.

## CrawlSEO reconciliation — 29 October 2026

The connected server's latest **production** crawl (08:53 UTC) contains 109 pages
and 181 findings. The redesign is still a draft PR: fixes visible in its preview
are not yet production fixes. The crawl's health score is not a ranking or a
measurement of this unreleased redesign's effect.

| Finding                                                              | Current delivery / next action                                                                                                                                                                                                                                                                                                                                                           | Acceptance and owner                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distinct pages declaring the homepage canonical                      | Fixed in the branch: pricing, community, changelog, roadmap, features, gallery, legal and eligible creator routes declare their own URLs and social URLs.                                                                                                                                                                                                                                | Engineering: verify live HTML after release; owner: inspect Google's selected canonical in URL Inspection after recrawl.                                                                                                                                       |
| Repeated homepage titles on changelog, roadmap and account utilities | Branch gives changelog/roadmap distinct titles. Login and Runner enrollment now have distinct titles, route URLs and explicit noindex rules; login has a visible H1.                                                                                                                                                                                                                     | Engineering: fresh production crawl should stop reporting these utility pages as indexable homepage-title duplicates.                                                                                                                                          |
| Orphan creator profiles                                              | Fixed in the branch: discoverable creator names link to their saved Clipify profile paths. Removing the snapshot's overlay join includes public profiles without overlays. Fresh visibility checks also exclude disabled accounts while cached metadata is reused. The tool's `MISSING_CANONICAL` label described missing internal links, a separate issue from canonical inheritance.   | Engineering: browser checks cover profiles without overlays, keyboard navigation, Unicode names, unlisted/noindex, unpublished and disabled states. Verify production link coverage after release and allow the existing two-minute snapshot cache to refresh. |
| Encoded creator URL `/creators/%E5%AE%B6%E5%A7%90` reported as 404   | Investigated and fixed: read-only production data confirms this saved creator name is enabled/discoverable. A real browser confirms 404. The exact failure reproduced with a disposable Unicode account: the page received an encoded parameter while metadata received the decoded name. Both paths now decode consistently; the same local URL returns 200 with the correct canonical. | Engineering: verify the original encoded URL on production after release. The profile keeps its saved name; no account data was changed. The current Twitch login is separate from Clipify's saved profile path.                                               |
| Guide pages weakly connected / duplicate content ownership           | Legacy website guides now permanently redirect to specific maintained Help Center articles and are removed from the website sitemap. Features link directly to the relevant articles.                                                                                                                                                                                                    | Engineering: all three redirects return 308 with exact article destinations; publisher: update the articles and their outdated screenshots using the prepared handoff.                                                                                         |
| Request-time sitemap dates and standalone demo indexing              | Removed invented marketing last-modified dates; preserved creator visibility filtering; demo player explicitly noindex/nofollow.                                                                                                                                                                                                                                                         | Engineering: inspect production sitemap and demo metadata after release.                                                                                                                                                                                       |
| Performance / mobile vitals                                          | Intent-loaded video, responsive assets and offscreen cleanup are implemented. Gallery thumbnails render on the server; video remains selection-loaded. Static product captures do not mount live editors on marketing pages.                                                                                                                                                             | Engineering after deployment: repeat comparable mobile/desktop Lighthouse runs and inspect URL-specific field data where available. The MCP's 51 score / 7.22s LCP result does not identify enough URL/test context to attribute it to the current homepage.   |

The MCP tools can read existing crawls but cannot initiate a fresh crawl. After
release, request a recrawl through the CrawlSEO service's normal interface and
compare the same production URLs. Its domain-wide Search Console totals include
other surfaces (including Help Center); they are not a marketing-only conversion
baseline and do not establish a redesign uplift. Post-release verification
is engineering follow-through, not a new request for owner permission.

### Creator discovery investigation

Read-only production checks on 29 October found 127 discoverable profiles,
including 35 with no overlay. The former snapshot query excluded those 35,
although the sitemap included them. Directory names also had no internal profile
links. The shared snapshot now includes creators without an overlay; public
outputs still apply the existing explicit/legacy discoverability rules. A fresh
join excludes suspended/disabled accounts even while their old snapshot survives.

Profile URLs come from the stored Clipify username. Twitch's current login is
retained for its external channel URL and display names remain presentation text.
This avoids broken internal links after a Twitch rename or localized display name.
A cached snapshot from the previous deployment can omit the new URL field until
its normal 120-second refresh; the UI leaves that name as text until then.

The reported localized profile is a confirmed route-encoding defect, reproduced
before the fix and returning 200 afterward with a disposable account. Unit tests
prove the encoded input regression and literal-percent fallback. Real browser
acceptance covers publication, no-overlay discovery, keyboard navigation, correct
canonical, unlisted/noindex and removal of disabled/unpublished profiles from the
directory and sitemap. No production records or settings were changed.
