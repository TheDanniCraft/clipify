# Landing page redesign implementation plan

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
