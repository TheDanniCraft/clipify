# Clipify audit closeout

This is the current delivery checklist for the 25 October 2026 written feedback
and 23-page audit. The original plan and delivery record include historical
checkpoints; this document distinguishes repository delivery from evidence that
requires people, external publishing, or a production release.

## Repository delivery

| Audit pages | Recommendation                                                | Delivery                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4–6         | Explain Twitch/OBS and the saved workflow immediately         | Clear hero, output preview, setup steps, three benefit groups, actual dashboard image, features destination and final CTA                                                    |
| 6–7         | Demonstrate functionality without invented retention evidence | Real click-to-play video, retry/skip/pause, offscreen cleanup; scripted counters and chat removed                                                                            |
| 7, 14       | Use accurate community evidence                               | Visibility-filtered teaser retained; shorter directory hero; explicit explanation that Pro access and Twitch status do not establish payment or active product usage         |
| 8–9         | Clarify limits, imports, pricing and signup                   | Library/playlist distinction, requested imports, runtime billing/savings, readable mobile comparison, qualified trial wording and checkout continuity                        |
| 8           | Runner and Pro-only purchase route                            | Current code includes optional self-hosted Runner with Free/Pro; no obsolete add-on price restored; selected Pro total remains clear                                         |
| 9           | Verify eligible trial creation, expiry and returning users    | Disposable-account integration checks; live OAuth transport remains a production acceptance check                                                                            |
| 10–11       | Remove eager media and unnecessary initial work               | Intent-loaded demo, smaller avatars/responsive images, immediate hero, interaction-loaded Turnstile without removing verification                                            |
| 11          | Contrast, keyboard, ARIA and reflow                           | Free CTA contrast, radio/table semantics, menu and dialog keyboard behavior, newsletter inert/focus fix, public consent/chrome and 200% CSS-zoom reflow checks               |
| 12, 21      | Canonicals, titles, social metadata and sitemap               | Route-specific metadata including creator/legal routes, no request-time marketing lastmod, creator visibility restrictions preserved                                         |
| 13          | Publish focused search-intent content                         | Three distinct task guides with requirements, setup, limits, troubleshooting and relevant actions                                                                            |
| 14          | Changelog and roadmap presentation                            | Localized release dates, readable subjects and expandable original notes; Now/Next before collapsed Shipped                                                                  |
| 15          | Demonstrate a gallery before signup                           | Existing gallery renderer with intent-loaded public demo clips, real video in a HeroUI modal, playback retry and Twitch fallback; no private gallery or invented endorsement |
| 16–17       | Separate acquisition traffic from runtime/preview             | Production top-level route classification; explicit CTA/demo/auth-start intent; checkout creation distinct from Continue clicks                                              |
| 17          | Record completed creator outcomes                             | Transactional signup/trial, first playback/daily return, created checkout and signed positive paid invoices; deterministic deduplication and account export/purge handling   |
| 17, 19–20   | Activation timing and retention reporting                     | Read-only cohort SQL with median time to first playback, mature D7/D30 return windows, denominators and numerator counts                                                     |
| 17          | Billing guardrails                                            | Current subscription cancellation/payment-problem counts; signed failed-invoice and succeeded-refund records, deduplicated refund identity and currency-separated reporting  |

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
  gallery and the three owned guides. Preview/iframe activity remains separately
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
      edits; the new owned guides do not overwrite them.
- [ ] Confirm whether the affiliate program is active, paused or discontinued,
      and its correct destination if active. The owned footer offers contact;
      external articles and any legacy redirect must match the confirmed status.
- [ ] Choose whether new creator community/profile visibility should remain
      public/discoverable by default or require an explicit onboarding choice.
      This delivery corrects wording and preserves current defaults.
- [ ] Confirm the scope/status of the future authentication roadmap item so it
      can be distinguished from shipped work and genuinely marked reviewed.
- [ ] Provide Search Console access or selected-canonical/query inspection exports.
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
