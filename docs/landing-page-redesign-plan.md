# Landing page redesign implementation plan

Current closeout and owner-only checklist: [landing-page-audit-closeout.md](landing-page-audit-closeout.md). Earlier sections below retain the implementation history.

Make Clipify immediately understandable as a Twitch clip player for OBS break scenes, demonstrate real playback early, and explain why saved curation, styling, and controls justify an account. Preserve the purple identity, existing product capabilities, and permanent Free plan.

Prepared on 27 October 2026 for `feat/redesign-landing-page`. The implementation uses this brief; delivery evidence and remaining work are recorded in `landing-page-redesign-validation.md`.

## Scope and evidence

The supplied audit text describes an inspection on 25 October 2026. The findings below were compared with the current checkout through the existing graphify graph and direct source inspection. The complete 23-page PDF was subsequently extracted and read, including the competitor observations, source evidence register, proposed copy, four-week sequence, and acceptance backlog. Its page references are traced in the delivery record. Production behavior, analytics figures, screenshots, prices, and Lighthouse scores have not been remeasured.

This branch should cover the homepage composition, its demo, homepage copy and metadata, navigation anchors, responsive assets, and acceptance coverage. Touch shared components only where the redesign needs them, checking their other consumers. Preserve campaign links and offers, runtime billing prices, authentication destinations, and community visibility filtering.

The implementation also includes the directly related public canonical/sitemap repairs, signup orientation, traffic classification, and pricing contrast/fallback fixes. Separate follow-up work includes verified activation/payment tracking, deeper onboarding and pricing redesign, external help content, roadmap content reorganization, creator studies, and search-intent articles. Those are valuable but should not expand this redesign into a public-site rewrite. Reliable business measurement remains a dependency for attributing conversion improvements.

## Audit findings against current code

| Finding                                         | Current evidence                                                                                                                                                                                   | Planning consequence                                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Hero leaves the category implicit               | `src/app/HomePageClient.tsx` uses “Let your clips talk,” generic “Get Started,” and `/appSkew.webp`. Twitch and OBS are absent from the hero copy.                                                 | Replace copy and make stream output the main visual.                                                                                   |
| Strongest explanation appears late              | Homepage order is hero → features → pricing → demo → FAQ. There are now 13 feature cards, including two Runner cards, rather than the audit's 12.                                                  | Reorder the story and consolidate repeated capabilities.                                                                               |
| Content visibility depends on entrances         | Hero text, buttons, proof, and screenshot begin blurred and nearly transparent. Hero also uses viewport height and overflow clipping.                                                              | Make primary content visible immediately; remove forced height and test short mobile viewports.                                        |
| Demo starts work before intent                  | `DemoPlayer/index.tsx` immediately mounts `/demoPlayer` and starts a viewer interval. `FakeTwitchChat.tsx` schedules messages; `StreamingSoftwareMock.tsx` runs an elapsed-time interval.          | One explicit playback entry point; no player or simulation work before activation.                                                     |
| Retention comparison is illustrative            | `nextDemoViewerCount` starts at 128 and applies negative BRB steps. Simulated-viewer wording is an accessible label, while visible UI shows LIVE. Tests explicitly require the declining audience. | Remove the audience comparison and update its tests; show playback functionality instead.                                              |
| Creator participation exists                    | Homepage fetches `getPublicCommunityTeaserAction`; `CommunityTeaser` renders avatars and a remaining count.                                                                                        | Reuse filtered data with accurate directory wording; never equate listing, live status, or Pro access with active or paying customers. |
| Community opt-in wording needs caution          | `src/server/creator-onboarding.ts` initializes community visibility and discoverability as enabled.                                                                                                | Avoid categorical “opt-in community” language until the whole journey is verified separately.                                          |
| Runner add-on account is outdated               | `Pricing/pricing-catalog.ts` says “Included with Free and Pro.” `ProSetupModal.tsx` now contains Pro only and its billing total. Homepage introduction still says “add self-hosted Runners.”       | Do not restore a paid Runner add-on or its old prices. Align homepage language with current inclusion and own-hardware requirements.   |
| Pricing is runtime data                         | `src/app/page.tsx` resolves the billing catalog and passes Pro prices to `TiersComponent`.                                                                                                         | Keep that source of truth; do not hard-code the audit's €2/€20 offer or savings.                                                       |
| Popularity badge is configured                  | Pro has `mostPopular: true` and displays “Most Popular”; inspected code supplies no popularity calculation.                                                                                        | Replace with a capability-based recommendation or remove the badge, reviewing shared pricing consumers.                                |
| Seven-day access exists in source               | `entitlements.ts` sets seven days, grants only to Free users, and prevents a second reverse-trial grant. New creator onboarding calls it; the grant path itself creates no paid subscription.      | Qualified trial wording needs a complete signup/expiry check before publication; it must never imply Free expires.                     |
| Homepage tests are narrow                       | `test/app/HomePageClient.test.ts` checks campaign URL construction only. Demo tests assert the simulation.                                                                                         | Add behavioral coverage for the redesigned journey rather than preserving old implementation assertions.                               |
| Metadata and measurement issues remain adjacent | Root layout owns homepage-style metadata and canonical plus a global Plausible wrapper. The pricing modal emits `checkout_start` on a click.                                                       | Add homepage-specific metadata; track broader canonical and outcome-event repair separately. A click is not activation or payment.     |

## Proposed page structure

| Order | Section                       | Content and next action                                                                                                                                                                                              |
| ----- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Hero with playback preview    | Explicit Twitch/OBS category, BRB benefit, Free CTA, and a recognizable stream-output poster with a play action.                                                                                                     |
| 2     | Creator participation         | Existing public creator avatars and a link to the community. Use neutral wording such as “Explore the Clipify creator community.”                                                                                    |
| 3     | Three setup steps             | Connect Twitch → choose clips and save an overlay → add its browser-source URL to OBS. A small dashboard detail can support these steps.                                                                             |
| 4     | Three benefit groups          | Choose what plays; make it fit your stream; stay in control. Give concrete examples and mark Pro capabilities accurately.                                                                                            |
| 5     | Creator setups when available | Two or three permission-based scenes and specific quotes. Omit at launch if unavailable; do not invent endorsements or leave empty cards.                                                                            |
| 6     | Free and Pro                  | Explain the first useful Free outcome and the reason to upgrade, retain runtime prices and billing choice, and link to the full comparison. Runner is a secondary included capability requiring the user's computer. |
| 7     | Focused FAQ and final CTA     | Resolve Twitch connection, browser-source setup, Free limits, Pro access, playback control, and optional Runner requirements. End with the same primary action as the hero.                                          |

Use one demo instance. The hero's “Watch the demo” action and the navbar demo anchor should reach the same preview, rather than loading a hero video and a second full demo lower down. Keep `#features`, `#pricing`, `#demo`, and `#faq` destinations working; use real section IDs and a valid home destination.

### Proposed hero copy

- Eyebrow: **TWITCH CLIP PLAYER FOR OBS**
- Headline: **Take a break. Let your Twitch clips play.**
- Supporting copy: **Turn your Twitch highlights into a BRB or Starting Soon screen. Choose your clips, save your overlay, and add it as a browser source in OBS.**
- Primary action: **Start free with Twitch**, using the existing login route.
- Secondary action: **Watch the demo**, opening the single playback preview.
- Reassurance: **A permanent Free plan. Upgrade when you need more control.**

Do not promise setup time, retention gains, continuous playlist imports, or particular Twitch permissions without verification. The primary CTA must accurately lead through login rather than pretending that its click completes account creation.

## Prioritized implementation slices

### P0 — Establish the content and asset contract

Before layout work, read the installed Next.js guides relevant to images, metadata, and client loading, and the installed HeroUI/HeroUI Pro APIs and official examples for the controls used. Inspect the existing homepage in desktop/mobile and both themes after following `docs/local-testing.md` and matching the owning CI environment.

Choose an authorized real playback scene for the poster/demo. Use an actual stream-output capture, not a generated representation presented as product evidence. Verify the demo overlay is available in the browser test fixture. Record a baseline for initial requests, media bytes, main-thread work, and the primary interactions. Historical Lighthouse numbers are context, not a comparable local baseline.

Confirm the setup steps against the actual overlay creation flow and prepare a small Free/Pro capability map from current entitlements and pricing definitions. Verify first-time and returning-creator trial behavior and expiry without payment before adding the trial sentence. If that verification is unavailable, ship permanent-Free reassurance and defer trial promotion.

Acceptance: approved copy, one usable playback asset, a reproducible browser baseline, and no outdated Runner pricing in proposed content. Creator examples do not block the core redesign.

### P1 — Deliver the new hero and honest demo together

Rewrite the hero and add a lightweight, responsive stream-output poster. Start the real demo only when a visitor activates it. Keep its dimensions reserved to prevent layout movement. Remove headline/button blur and delayed visibility; keep any decorative motion optional and respect reduced motion.

Refocus the OBS-like demo on actual clip playback, browser-source placement, and controls that really work. Remove scripted viewer counts and the retention-comparison prompt. Remove unnecessary fake chat; if illustrative chat or LIVE decoration remains, visibly identify it as a demo beside the presentation.

Account for all work across the iframe, chat, and mock elapsed timer. On leaving the viewport or hiding the tab, stop playback and timers using the smallest reliable lifecycle. If unmounting is the chosen mechanism, explain resume behavior and provide an explicit resume action; do not assume hiding an iframe pauses media. Avoid altering the production overlay player unless necessary for correct demo behavior.

Provide keyboard access, a clear loading state, unavailable/error feedback, and a retry route. The existing `/demoPlayer` depends on `DEMO_OVERLAY_ID` and can return missing/paused content: a mounted iframe alone does not prove playable output. Do not rely solely on iframe `onLoad` to report success.

Likely files: `HomePageClient.tsx`, `components/DemoPlayer/*`, `components/LandingPage/basicNavbar.tsx`, and authorized assets under `public/`. Inspect `demoPlayer/page.tsx` and `overlayPlayer.tsx` for integration, minimizing shared runtime changes.

Acceptance: category, outcome, primary CTA, and preview are immediately understandable on mobile and desktop; no clip media request occurs before demo activation; real clips play afterward; offscreen/hidden-tab work stops; no simulated retention claim remains; failures leave signup and the rest of the page usable.

### P2 — Replace the feature inventory with the buying journey

Add the three setup steps and three benefit groups using existing Clipify surfaces and HeroUI components. Explain the account's value through saved selection, reusable setup, styling, and permitted collaboration. Remove duplicate Runner messaging and generic cards that repeat the hero.

Reuse `CommunityTeaser` and the existing visibility-filtered query. Do not introduce hard-coded creator counts, subscriber claims, or unapproved quotes. Preserve a stable layout when community data is absent or fails. Size avatar delivery to its rendered dimensions through supported image handling; verify remote-image behavior before rewriting Twitch URLs.

Keep optional real creator setups after benefits when permissions/assets exist. Rewrite the FAQ around purchase and setup objections, replacing duplicate Theme Studio questions and moving advanced website/gallery detail to existing destinations. Add a final Free CTA.

Likely files: `HomePageClient.tsx`, `LandingPage/faqs.ts`, `LandingPage/communityTeaser.tsx`. Reuse `featureCard.tsx` if it fits; do not add a general-purpose marketing component framework.

Acceptance: a visitor can explain what Clipify does, how to connect it to OBS, and why to save a managed setup; Free and Pro examples are correctly qualified; community errors and long content do not break mobile layout.

### P3 — Simplify the homepage offer and align metadata

Keep the current runtime-priced Free/Pro cards and full-comparison link. Prioritize the break-scene workflow in summary copy; clarify that an unlimited clip library and a 50-clip Free playlist describe different limits. Describe imports as an action that creates or refreshes a playlist, not a continuous schedule.

Correct homepage Runner wording to match current inclusion and the requirement for the user's hardware to stay online. Remove or substantiate the popularity badge. Keep campaign promotions and existing Free/Pro destinations intact. Avoid rebuilding checkout in this slice; the audited Runner upsell has already disappeared from the inspected modal.

Add explicit homepage title, description, and matching social metadata in `src/app/page.tsx`, using “Twitch Clip Player for OBS Break Screens | Clipify” as the proposed title. Check the rendered metadata, including inherited fields. Include the audited route-specific canonical repairs and verify representative legal and creator routes while preserving visibility rules.

Likely files: `HomePageClient.tsx`, `page.tsx`, and narrowly scoped changes to `Pricing/index.tsx` / `pricing-catalog.ts` where needed. First enumerate all shared pricing consumers, including dashboard surfaces, to prevent unintended copy or behavior changes.

Acceptance: visible prices use the billing catalog, frequency and promotional states work, Free remains permanent, Runner has no invented fee, unavailable pricing has clear feedback, and homepage metadata matches the new positioning. Trial copy appears only after P0 verification.

### P4 — Complete acceptance and compare performance

Extend existing whole-file tests for campaign preservation and demo lifecycle. Replace simulation assertions with user-visible playback/loading/retry behavior and media deferral checks. Cover timer cleanup, visibility changes, repeated activation, and resume without relying on real Twitch in unit tests. Cover shared pricing consumers if those files change.

Add one browser-owned homepage journey under `test/acceptance/` with real installed controls. Cover the initial Free CTA and login handoff, demo success/failure/retry, anchors and mobile menu, keyboard/focus, community-empty behavior, and relevant plan links. Check desktop/mobile in light/dark themes and reduced motion. Inspect screenshots against the existing Clipify design; screenshots and no-overflow assertions alone are insufficient.

Use disposable loopback fixtures and a job-owned `MCP_TEST_TEMPLATE_ID` as documented. Seed a test-owned demo overlay/media fixture through the existing test setup; do not borrow production overlay IDs or hide missing configuration with local-only values. Compare the owning CI build/runtime settings before diagnosing failures.

During development run changed whole-file tests without coverage. At each completed slice run affected suites and real browser scenarios. Before pushing run affected coverage at existing thresholds and the relevant browser journeys. Before merge complete mandatory coverage, lint, formatting, types, build, and the full ready-for-review CI gate. New PRs remain drafts until the final review checkpoint.

Compare repeated performance runs under the same device/network/build configuration. Report initial media requests/bytes, main-thread work, LCP, CLS, and demo interaction separately. The hard acceptance condition is no unrequested demo-media transfer and no offscreen demo timers/playback, with no material regression in matched loading results. Do not promise a Lighthouse score or conversion uplift from this work alone.

## Follow-up priorities outside the redesign

1. Inspect selected canonicals in Search Console after deployment and recrawl; the code-level canonical and sitemap corrections are included here.
2. Use the new traffic classification to isolate production marketing reports and establish verified authentication, new-creator, activation, repeat-use, and payment outcomes. Preserve the distinction between intent events and completed outcomes.
3. Align login and dedicated pricing with the verified Free/trial lifecycle and current Runner offer; measure checkout friction before broad checkout changes.
4. Obtain consented creator scenes and quotes, refresh setup help, and conduct small rounds of streamer usability sessions. Use these to refine the page before expanding acquisition content.

The redesign can be accepted on comprehension, truthful presentation, working interactions, accessibility, and measured loading behavior. Business-impact claims require the separate measurement work and sufficient observation.

## Revision scope after preview review

Complete the owned-site recommendations alongside the visual correction: restore product imagery and composition, separate benefits from plan comparison, restore the billing pill's appearance with runtime savings, provide a real features destination, publish the three distinct task guides, present a continuous mobile plan comparison, lead roadmap with Now/Next, and expose readable release subjects before full notes. Verify trial creation, expiry and returning-user behavior before qualified promotion.

Use the existing audit-event store for deduplicated product outcomes, preserving existing transaction and webhook boundaries. Add creator-cohort reporting, preview/deployment separation, and export/purge handling. Verify failure/retry behavior without replacing Stripe fulfillment or claiming anonymous visitor attribution. No new schema is required. Keep consented proof, external CMS edits, Search Console, production observation and human studies explicitly dependent on their real evidence/access rather than treating a code change as completion.

## Future Plausible → Umami migration (29 October 2026)

This is a follow-up plan, not part of this redesign's implementation. Keep Plausible running until the replacement has demonstrated equivalent eligible traffic collection. Research is pinned to [Umami v3.4.1](https://github.com/umami-software/umami/releases/tag/v3.4.1); current documentation also describes unreleased v3.5 settings, which must not be assumed available.

### Capabilities and limits

| Need                         | Verified capability                                                                                | Proposed use                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Basic analytics              | Pageviews, visitors, referrers, devices, geography, real-time activity, comparisons and breakdowns | Production marketing dashboard, with a documented baseline collection policy         |
| Events and goals             | Named events and structured properties                                                             | CTA, authentication, activation and purchase milestones                              |
| Funnels and journeys         | Ordered page/event exploration                                                                     | Same-session marketing and setup paths; validate OAuth continuity                    |
| Sessions and identification  | Session timelines; optional distinct IDs link sessions                                             | Consented product analysis with pseudonymous creator identifiers                     |
| Retention, segments, cohorts | Available in self-hosted v3; Cloud plan availability varies                                        | Supplement existing creator-cohort SQL, rather than replace its business definitions |
| UTM and attribution          | Campaign reports and attribution                                                                   | Allowlisted campaign fields, with sensitive query strings removed                    |
| Revenue                      | Revenue events with amount and currency                                                            | Verified payments, reconciled against the billing ledger                             |
| Heatmaps                     | Separate click/scroll recording; self-hosted v3.2+, Cloud Business/Enterprise                      | Optional consented public-page studies                                               |
| Real-user performance        | LCP, INP, CLS, FCP and TTFB distributions since v3.1                                               | Optional measurement alongside Sentry, with matched collection windows               |
| Replay and error reporting   | Available, but unnecessary here                                                                    | Keep disabled; Sentry remains the owner                                              |

Sources: [product availability](https://umami.is/product-analytics), [insights](https://docs.umami.is/docs/insights), [performance](https://docs.umami.is/docs/performance), [heatmaps](https://docs.umami.is/docs/heatmaps), [revenue](https://docs.umami.is/docs/revenue).

Two limits matter for the requested business funnel:

- The pinned PostgreSQL [funnel implementation](https://github.com/umami-software/umami/blob/v3.4.1/src/queries/sql/funnels/getFunnel.ts) joins steps by `session_id`. Its [retention implementation](https://github.com/umami-software/umami/blob/v3.4.1/src/queries/sql/retention/getRetention.ts) also groups by session, within a selected month. Calling `identify` does not turn these into account-level, cross-device conversion or D7/D30 reports. Keep `docs/marketing-outcome-report.sql` authoritative for creator retention and verified lifecycle outcomes.
- Anonymous session identifiers use website, IP, user agent and rotating salt. Rotation defaults to monthly. IP processing still occurs even though the raw IP is not retained as an analytics field. A distinct ID links sessions rather than merging them; neither anonymous-to-login attribution nor webhook-to-browser continuity can be assumed. See [metric definitions](https://docs.umami.is/docs/metric-definitions) and [distinct IDs](https://docs.umami.is/docs/distinct-ids).

### Preserve consent semantics explicitly

Today `PlausibleClient.tsx` supplies an always-on aggregate baseline. `consentProjection.ts` discloses this separately from optional measurement. The c15t measurement category currently covers Sentry performance and masked replay; functionality separately controls Chatwoot. A replacement must preserve that distinction or explicitly change the policy and acknowledge the reporting discontinuity.

Recommended rollout: retain Plausible baseline while testing Umami's advanced tracking only after measurement consent. Before replacing the baseline, approve either a separately configured Umami baseline with reviewed identifier lifetime and processing, or consent-gate all Umami and accept reduced coverage. “Cookieless” alone does not resolve this choice. A global salt setting may require separate instances if baseline and product retention need different lifetimes.

Update measurement-purpose copy, the legal service disclosures, registry, policy version and re-consent behavior before enabling identities, heatmaps or revenue attribution. Reuse `browserMeasurement.ts`, `cleanup.ts`, reload/backend/retention handlers and the existing preference dialog. Rejection, expiration and withdrawal must stop collection and remove permitted local state. Do not retroactively collect a page load that occurred before consent. The local support launcher remains independent; real Chatwoot continues to require functionality consent.

### Implementation order

1. **Deployment and collection boundaries.** Prefer self-hosting within the existing operating model, with a separate analytics database, backups, retention/erasure policy and patched stable version. Confirm hosting/domain and operating ownership before provisioning anything. Use separate marketing and product website IDs. Exclude preview hosts, player/embed/overlay routes, Runner heartbeats, admin and impersonation traffic at collection, rather than relying only on report tags.
2. **Fixed first-party proxy.** Proxy script and ingest routes to fixed trusted upstreams, with request size/rate limits. Never proxy arbitrary URLs or expose analytics administration. Do not forward application cookies or authorization headers. Preserve legitimate client IP/user agent through trusted infrastructure so every visitor does not become the proxy; verify spoofed forwarded headers are rejected. In v3.4.1 use the supported client-IP configuration; `TRUSTED_PROXIES` in current docs is marked v3.5. A proxy does not bypass consent or browser privacy choices.
3. **Tracking adapter and route inventory.** Inventory every `usePlausible` consumer, including checkout, login, paywalls, tours and editors. Replace through the existing analytics boundary, avoiding simultaneous duplicate emitters. Send one pageview per eligible SPA navigation; sanitize URL, title and referrer before sending. Remove OAuth codes, signatures, private resource IDs and secret-bearing query strings. Allowlist UTM source/medium/campaign fields. Use `data-auto-pageview=false` for manual pageviews; `data-auto-track=false` also disables performance initialization, so these are not interchangeable. See [tracker configuration](https://docs.umami.is/docs/tracker-configuration).
4. **Consented identification.** Use a server-derived HMAC pseudonym, never email or raw Twitch IDs. A base64url SHA-256 HMAC fits the documented 50-character ID limit. Clear identity on logout, agency switch and consent withdrawal. Test anonymous visit → real OAuth return → identified creator, shared devices and cross-session return. Label funnels according to the continuity actually demonstrated.
5. **Verified outcomes.** Reuse `src/server/product-outcomes.ts`: creator creation, trial grant, created checkout, first playback, playback days, verified payment, failed payment and refund. A trial is not a purchase; a Continue click is not a checkout session. Export server outcomes only with a valid consent context and timestamp. Keep the internal deduplicated ledger authoritative. Use bounded retries and reconciliation; the public ingest API does not establish exactly-once event delivery. Its payload `id` identifies a person, not a deduplication key. Validate ISO currency and major-unit revenue; never silently default an unknown currency. See [sending stats](https://docs.umami.is/docs/api/sending-stats).
6. **Heatmaps and performance.** Enable heatmaps separately from replay, only after measurement consent and initially only on public home/features/pricing pages. Do not record private dashboards, login inputs or secret-bearing pages. The pinned recorder has independent heatmap/replay flags; keep replay false. Validate the deployed version's preview mechanism and any narrowly required framing policy before changing CSP; never relax authenticated-page protections globally. Establish sampling and payload budgets appropriate to low traffic. Add optional consented RUM only after comparing Sentry's collection window; retain Sentry errors and replay.
7. **Reporting and cutover.** Build marketing, activation, purchase/retention and performance dashboards with explicit hostname, consent, session and cohort definitions. Compare the same eligible audiences during a bounded shadow period. Preserve Plausible history/export separately; aggregate history cannot reconstruct missing sessions. Remove its provider, event hooks and obsolete configuration only after verified cutover. Keep a rollback that restores one provider without duplicating pageviews. Read-only Umami MCP access can follow separately; it is not required for ingestion.

### Acceptance before migration ships

- Unset, rejected, expired and withdrawn measurement consent produce no advanced analytics requests, identifiers or recorder activity. Existing functionality consent remains independent.
- Production marketing, preview and playback traffic remain separated. Private URLs, OAuth credentials and personal data never appear in payloads.
- SPA navigation emits once; blocked analytics never breaks login, checkout or playback. Real OAuth return and logout/agency switching have demonstrated identity behavior.
- Native same-session funnels are labelled accurately; creator D7/D30 and payment reporting reconcile against the internal ledger. Trials, returning logins and checkout intent remain distinct.
- Signed webhook retries do not duplicate internal outcomes; analytics export failures and uncertain upstream delivery have bounded recovery and reconciliation.
- Revenue preserves currency; refunds have an explicit report definition. Do not promise that a revenue chart is an accounting ledger.
- Heatmaps operate with replay disabled and respect consent, screen sizes and private-page exclusions. Performance tracking adds no unconsented retrospective page-load data.
- Deletion, export, expiry, backups, trusted proxy headers, rate limits and failure recovery are tested. Compare loading cost and useful event volume before enabling broader sampling.

Owner decisions needed for that future work: hosting and domain; approved baseline-versus-optional collection policy and updated consent wording; identifier/data retention; and operational access. These are not blockers for the current public-page redesign.

### Guide redirects and search ownership

The three `/guides/...` routes were introduced on this unreleased branch; they are not established production guides being removed. Their permanent 308 redirects lead to the exact maintained Help Center articles, avoiding duplicate publishing. A permanent redirect tells Google to prefer the destination as canonical; it does not describe a product-feature relationship or automatically transfer value to the homepage. Commercial feature content and route-specific canonicals remain on clipify.us. See [Google's redirect guidance](https://developers.google.com/search/docs/crawling-indexing/301-redirects) and [canonical consolidation guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

If ranking guides on the main domain becomes a priority, render the Help Center's single content source at a chosen main-domain URL with one intentional canonical. That requires CMS/API and canonical control, not duplicate manual articles. Validate Google's selected canonicals and indexing after deployment; no ranking improvement is established by code checks alone.
