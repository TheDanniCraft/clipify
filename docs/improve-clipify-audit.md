# Public pages, conversion and measurement audit

Reviewed 14 November 2026 using production Umami, Stripe, Clipify DB, Grafana,
public browser screens and repository code. Implementation branch:
`feat/improve-clipify`. The evidence below predates this implementation.

## Evidence and limits

The production cohort created 31 October–13 November contained 27 creators.
Five reached recorded first playback, four played on multiple UTC days, and none
created a checkout or made a verified payment by the cutoff. Of ten expired
seven-day trials, one had recorded playback before expiry. This is a small,
partially mature cohort; it does not establish why individual creators left.
Playback is not proof of OBS broadcast reception.

Stripe's last successful positive new-subscription charge was 12 October; its
last checkout session was 14 October. A €2 payment succeeded on 5 November after
two failed attempts. This places the recent sales gap before checkout, but does
not prove that all current upgrade paths work.

Umami recorded nine signup outcomes for the same period. Its consent-dependent
exports are not total signups. Anonymous browser events and identified server
outcomes do not necessarily share a session. The database ledger and Stripe
remain authoritative for their respective outcomes.

Grafana's checked snapshot had fresh scrapes, a 1 ms database ping and no overdue
email backlog. It contained 35 saved guide records among 170 accounts; guide
completion is not an all-account conversion rate. Historical incidents were not
excluded by this healthy snapshot. The connector could not expose alert rules,
so existing alert coverage remains unverified.

## Changes

| Gap                                                  | Implementation                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Generic public presentation and repeated slogans     | Neutral theme-aware navigation, a large product preview, actual playlist/editor screenshots and concrete Pro examples                                        |
| Sparse signup screen                                 | Branded sign-in card with a heading, next steps, Free/trial terms, saved checkout context and existing signed OAuth continuation                             |
| Setup action hidden for creators with existing clips | A resumable next-step card independent of the clip-performance empty state                                                                                   |
| Failed checkout loses its intent                     | Retain the signed selection and nonce on failure/cancellation, provide local recovery and retry, clear on completed checkout or already-owned result         |
| Mixed consent boundaries                             | Restore native cookieless pageviews; gate all custom events, identity, engagement, performance and heatmaps behind consent; disclose the baseline separately |
| Missing diagnostic steps                             | Safe auth-start failure reasons, consented auth-session completion, guide save/control failures, upgrade opening/dismissal and checkout return events        |
| Missing Grafana presentation                         | v7 dashboard extends v6 with cohort outcomes, mature first-week activation, delivery, checkout, subscription and processing panels                           |
| Missing service telemetry                            | Fixed aggregate checkout, auth-session, webhook and consent-exclusion process counters; current billing-state counts                                         |

Public CTA measurements distinguish placements. Gallery signup preserves its
intended dashboard destination. Prices, trials, promotions and payment fulfillment
retain their existing rules. No generated migrations or schema changes are needed.

The theme editor and playback controls use separate feature rows that accommodate
their different proportions. Product views use rounded clipping without extra
gray screenshot wrappers. The public support launcher stays under Clipify's
control before and after functionality consent, with the vendor's duplicate
launcher hidden. It moves above the privacy banner only when their horizontal
bounds overlap.

The community page now places browsing below a compact introduction, with name
and username search and small outlined avatars with profile previews. Each
creator appears once; membership status and
existing profile/Twitch link rules remain intact. Unlisted profiles are filtered
on the server before the browser receives directory data. Search has a reset
action that returns focus to the field, and an empty directory has an explicit
state. The directory uses the existing HeroUI components and Clipify themes.

## Design evidence

The structural references reviewed on Mobbin were:

- [VEED](https://mobbin.com/sites/sections/b8cc9a0e-0fde-47d8-a726-a2a42e863c5a): concrete product output beside an explicit action.
- [Twenty](https://mobbin.com/sites/sections/abe261e4-d901-42f1-bea3-0a806e2d0669): a prominent application view below a concise introduction.
- [Aside](https://mobbin.com/sites/sections/de9e1a65-59c9-41f0-8c73-01df009482e1): short plan descriptions tied to differences in use.
- [Delphi discovery](https://mobbin.com/screens/b29eb123-cbd6-4146-8e8f-e0a53cc71d3d): search and categories above people, with names on their profiles.
- [Base44 directory](https://mobbin.com/screens/a02b2613-3fdb-4284-80c2-9b51840ef360): browsing controls above a grid of people and their actions. This supplies directory structure from another domain.

These inform structure, not copied branding, assets or claims of conversion lift.
Clipify keeps its own installed controls, screenshots, colors and typography.

## Privacy and reporting boundaries

Custom product events, engagement, analytics account linking, heatmaps and performance require current
measurement consent. Basic native pageviews load independently of the optional
measurement choice after policy hydration. Existing URL filtering preserves paths,
public creator/gallery URLs, UTM campaigns and referrer domains while grouping
private editor IDs and removing sensitive query values. This is the existing
Umami site and native tracker, not a separate counter or second analytics service.
Native visitor/session counts, realtime traffic and page-based funnels/journeys
remain available; click events and behavioral diagnostics need consent. No custom
pre-consent events are buffered for later replay. Umami's native identification
may associate an earlier anonymous session with the account after consent. It is
cookieless pseudonymous measurement, not a guarantee of irreversible anonymity.
Withdrawal blocks the identified client immediately and reloads without sending
its account identifier; the baseline resumes. Existing server-side session links
and historical records are not erased by withdrawal. The deployment's retention,
salt rotation and legal basis remain operator responsibilities; this patch does
not certify a consent exemption for every jurisdiction or Umami configuration.
Necessary c15t account identification still links rejected choices to the verified
account; it does not identify the account to Umami. The
server rechecks authoritative consent, including before retry. Consent exclusion
is expected and is not a service error. Existing deduplicated operational outcome
records are aggregated before export to Grafana; individual IDs are not exported
in these new fields. Aggregation is not a new legal basis for collecting more data.

New diagnostic events use fixed reasons and coarse properties, without raw
exceptions, OAuth parameters, emails or user-entered content. Actual Umami
retention configuration and analytics data-rights handling still require an
operator-verified review; this change does not certify the entire deployment.

Distinct IDs link sessions; they do not turn every native funnel into an account
cohort report. Use Umami for consented journeys, the ledger for mature creator
cohorts, Stripe for money, and Grafana for service reliability.

## Rollout and acceptance

Run the affected whole-file tests and real browser journeys. Inspect light/dark
screens at desktop and narrow widths, first-visit consent, keyboard/focus,
playback failure/retry, signup continuation, upgrade/cancellation and setup with
existing clips. Full CI validation remains required before squash merge.

The v7 dashboard must execute against disposable Grafana/Influx fixtures before
import. New production fields arrive only after the app release is scraped.
Do not interpret absent fields as healthy zeros, or deploy alerts that expect
fields before that release. Verify existing alert rules before adding thresholds.

After release compare cohorts with equal observation windows: signup, first
playback within seven days, checkout creators and paid creators. Keep young
cohorts outside mature denominators and report counts alongside rates. Exclude
preview/runtime traffic from acquisition reports. A copied source URL, guide
checkbox, trial or checkout click is not a completed broadcast or purchase.

## Validation record

The affected whole-file checks passed for analytics sanitization and consent,
Umami loading and account linking, server consent enforcement and delivery,
login continuation and failure recovery, setup guidance with existing clips,
checkout intent and retry, pricing, public-page links, billing webhooks, auth
callbacks, instance health and the admin health fixture. The conversion cohort
and webhook backlog query also passed against disposable PostgreSQL 18, including
preview exclusion, distinct creators, mature observation windows and stale leases.

The final v7 resource imported into disposable Grafana 13.2.3 with Infinity 4.1.1
and InfluxDB 2.9.1. All 93 panels and 475 Flux queries passed across normal,
counter reset, replica, zero-activity and missing-scrape fixtures. Database gauges
did not double with replicas; process counter increases respected resets. The
report was produced on November 14, 2026 at 18:09 UTC.

Changed product files passed focused ESLint checks, and checked TypeScript/TSX
files passed formatting checks. No generated migrations, schema changes or live
Grafana configuration changes were made.

HeroUI Pro authentication and installation subsequently succeeded. Type checking
and the isolated production-mode browser build passed with the licensed
components. Browser acceptance found and corrected a server-component compound
export on the login card, dark-theme accent contrast, and mobile setup-action
spacing.

The affected public and consent browser inventory passed: landing and login at
320, 390 and 1440 pixels in both themes, keyboard navigation and FAQ, first-visit
consent and reflow, demo failure/retry and controlled real media, signup failure
and retry with the saved destination, expired checkout recovery, pricing, public
gallery playback and focus, and the privacy inventory with injected drift.
Authenticated checks passed for setup start/pause/reload/resume despite existing
clips in four width/theme combinations, support-consent rejection/enable/revoke,
guide recovery and keyboard focus, unavailable Pro customization, upgrade intent,
admin health, Pro setup and retired checkout links. The guide analytics journey
explicitly verified zero calls after rejection, then allowlisted event properties
after statistics opt-in. E2E tracker transport stays disabled; this establishes
the application event consent boundary, not third-party ingestion or retention.

The community directory was also checked with isolated public and unlisted
creator fixtures at desktop/mobile widths in both themes: deduplication,
directory navigation, case-insensitive search, empty/reset recovery with focus, profile/Twitch
link rules, visibility exclusion and accessibility. Public support checks verify
the same launcher bounds before and after functionality opt-in, the hidden vendor
launcher, chat opening and placement beside a wide-screen privacy banner.

Desktop and mobile screenshots were inspected in light and dark themes,
including the first-visit privacy banner, login card and setup entry. Runtime
price metadata was deliberately unavailable in the isolated environment; the Pro
dialog journey supplied only an external catalog fixture. No real purchase or
Twitch authorization was made. Complete CI is still required before merge. The
redesign and new health fields have not been deployed, and the v7 dashboard has
not been imported into production.

## Native traffic restoration and privacy access

Restored the basic Umami tracker while keeping custom events, account identity,
engagement, browser performance and public heatmaps consented. The permanent
Privacy preferences entry sits in the dashboard avatar/account menu, including
the collapsed sidebar and mobile navigation. It reopens the existing c15t dialog
and preserves choices without adding another dashboard utility row. Public profile
menus expose the same action. Clearing browser storage is not the withdrawal UI:
account consent records are maintained by the consent service.

The privacy and cookie policies describe the baseline and optional scope briefly;
technical session-linking limitations are recorded here rather than in UI copy.

The dashboard preference journey passed at 390px and 1440px in both themes,
including keyboard opening, collapsed account access, saved statistics choices,
functionality preservation and withdrawal. Focused analytics/consent and navigation
whole-file tests passed. The previous CI failures exposed stale policy metadata
assertions and invalid checkout-intent cleanup: rejected/retired selections now
clear at the continuation route, while valid selections remain available for retry.

## Follow-up visual and feature coverage audit

The initial visual review missed the separation between the Pro heading and its
far-right comparison button. The corrected action is a text link immediately
below the heading, using the same treatment as feature links. Feature text starts
at the top of its screenshot rather than halfway down a tall image. The scope
keeps Clipify's theme, screenshots and installed components. [Cohere](https://mobbin.com/sites/sections/34577db3-2a65-4847-9f63-07b6a95d5d31)
and [Figma](https://mobbin.com/sites/sections/09bac752-13b5-4d35-9f6b-7c99c8959ec8)
references informed grouping links with the content they describe; exact spacing
and Clipify copy are implementation judgments.

The landing and feature pages omitted manual clip exports and reusable layouts,
although the pricing catalog already included them. They now cover the clip
inventory/past-stream entry points, Original/Desktop/Mobile outputs, saved layouts,
manual sharing, and Free branding versus Pro watermark removal. The export visual
is captured from the installed interface using a disposable local creator. Exports
have their own section outside Pro-only features. The FAQ, page descriptions,
llms.txt and llms-full.txt describe the same availability; the full reference also
covers shared account-brand settings and export recovery. Generated plan details
remain sourced from the existing pricing catalog. Marketing video compositions in
packages/video are not advertised as an end-user trailer creation feature, and
social upload/scheduling is not claimed.

The browser review covers 320, 390, 1440 and 2000 pixel widths in both themes,
comparison-link grouping, export discovery, the served LLM documents and layout
reflow. Matching before/after section captures reapply the original source classes
to the live target for the baseline; the after captures show the applied source.

Final checks: ten focused unit/LLM-route cases passed; the browser build and
scoped lint/format checks passed. Fourteen focused public browser journeys passed,
including eight feature/export cases across the four widths and both themes,
keyboard pricing navigation, preserved clip-inventory sign-in destination, and
served LLM content. The existing landing inventory also passed, with screenshots
reviewed separately from its accessibility and interaction assertions. Production
and live Grafana configuration remain unchanged; required CI still owns the final
gate before merge.

## Account context, login and full-reference follow-up

The dashboard avatar menu introduced earlier in this PR is removed. The account
selector and identity row have a clear gap, and Privacy preferences is a labeled
button in Settings → Account. Public footer/Cookie Policy access remains. The
existing c15t dialog still owns saves, revocation and reloads.

With no explicit workspace, the selector now shows the creator account already
used by the authenticated backend. Current creator metadata resolves immediately;
legacy metadata uses a read-only authenticated action to resolve the implicit
context. It does not choose the first collaborator, change session context, select
an unavailable account, override an explicit route/selection, or interfere with
Admin View. Failed lookup leaves manual account selection available.

Login uses a plain sign-in layout with one Twitch action, account-creation copy
and required notices. The marketing card, trial pitch and redundant back link are
removed. Checkout and signed MCP authorization continuations keep their existing
behavior. Structural references: [Modal](https://mobbin.com/screens/eac946fc-7909-478d-926e-02b07cc840be)
and [Mixpanel](https://mobbin.com/screens/80d98293-0bc4-48be-a191-96880a9596da);
Clipify's own controls, colors and authentication remain.

The LLM review covered the route inventory and owning product/permission modules,
not only the newly added export section:

| Area                                   | Sources checked                                                                              | Reference correction                                                                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard and account context          | Dashboard routes, navigation, auth/session, creator onboarding                               | Own default, explicit selection, role/agency boundaries, setup and clip performance                                                             |
| Clips, streams and layouts             | Clip/stream pages, export settings/queue/presets, composition and brand modules              | Cached discovery, backfill/refresh, output formats, saved layouts, branding, retry and manual publishing                                        |
| Overlays, playlists and live control   | Resource actions, focused schemas, feature access                                            | Source/filter/playback rules, Pro on-demand imports, Viewer Queue and named live actions                                                        |
| Galleries, Creator Pages and community | Public/dashboard routes, gallery resources and discovery settings                            | Elements versus iframe rules, visibility, plan limits, analytics and directory behavior                                                         |
| Runner                                 | Runner settings/resources, scheduling/provider metadata and pricing                          | Included manual broadcasting, Pro limits, local device responsibility, destinations and recovery                                                |
| Team and agencies                      | Permissions, invitations, agency account/link/allocation actions                             | Accepted relationships, permission ceilings and creator seats; no retired Runner-seat purchase                                                  |
| Security and lifecycle                 | Settings/security/linked accounts, lifecycle service and recovery                            | Verified email/passkeys, provider unlinking, recent verification, data export and 30-day deletion recovery                                      |
| MCP                                    | Public schemas, consent permissions, tools and prompt registry                               | Replace stale 66-tool/six-prompt claims with generated 76-tool/seven-prompt data and public tool names; remove obsolete control recommendations |
| Pricing and recognition                | Seven comparison sections, all 42 comparison features, live catalog usage and badge registry | Keep plans/badges generated, surface exports in Free's summary, avoid static price claims and trial/revenue confusion                           |
| Privacy and support                    | Consent policy/registry, optional collection boundaries and settings UI                      | Settings → Account entry point and basic-versus-optional measurement scope                                                                      |

Both LLM templates are rewritten around current workflows. Tool counts, public
tool names and prompt suggestions now render from their registries; full plan and
badge details retain their existing generators. A test renders the actual source
templates against those registries/catalogs to catch unresolved or missing output.
No secrets, live account data, private URLs or static checkout prices are included.

Validation: focused account, login, settings, pricing, LLM and service-classification
whole-file checks passed. The browser build passed. Real browser checks covered
personal default selection with legacy metadata, explicit switching and recovery,
restored avatar spacing/menu removal, settings privacy reopening/withdrawal, and
login in desktop/mobile and both themes. The previous CI service-classification
assertion was corrected to test basic traffic separately from optional product
analytics. Required CI remains the merge gate; no production changes were made.

## Merge readiness and directory scale

The failed merge gate on November 15 was a real pricing-page coverage gap:
checkout recovery branches had 66.66% coverage against the existing 85% floor.
The zero-total `branchesTrue` counter was not the failure. Server-page tests now
cover cancelled/unavailable returns with and without a surviving checkout intent,
plus unknown and repeated query values. All nine pricing-page branches are covered;
no gate, inventory or threshold was changed.

Community uses a tightly packed grid of 32 px circular avatars with visible
outlines and 44 px interaction targets. Category tabs and the duplicate group
heading are removed. The grid adapts to its available width instead of stretching
a small number of avatars across fixed columns. Hover, click/tap or keyboard activation opens a HeroUI profile
popover with identity, membership, live status and profile links. Pro/partner
creators retain a direct Twitch link. Search,
ordering, membership labels and server-side discovery permissions
remain. Browser acceptance includes 170 synthetic discoverable creators, one
unlisted creator, a long display name, and finding the final creator by username.
The avatar-grid structural references are [HBO Max](https://mobbin.com/screens/56db06b2-a421-412c-a9a4-e768acafaa7b)
and [Portrait](https://mobbin.com/screens/315d7b24-0fe2-4cfe-8418-6d881297729a).
The profile card follows the user's [HeroUI interactive-content reference](https://heroui.com/en/docs/react/components/popover#interactive-content).
Clipify's components and themes remain.

Clip counts load only when a popover opens. The query counts this creator's
available, unexpired public clip cache, and rechecks enabled/discoverable status
in the same query. It excludes neighboring creator keys, expired and unavailable
clips. It reports a missing/failed lookup as unavailable with retry, preserving
a real zero as zero. These are clips on Clipify, not all-time Twitch totals;
no stream count, followers or other unverified statistics are invented.

The live Grafana dashboard remains v6 (version 22, last updated October 31).
Prepared v7 already adds rolling creator outcomes, mature first-week activation,
Umami delivery, checkout operations, subscription states and webhook processing.
Import it after its app fields are released and scraped. Adding more charts before
that would not improve the evidence available today.

Recommended next measurements, requiring their own implementation and validation:

- Return within seven days and time to first successful playback, with mature
  signup cohorts and explicit counts beside rates.
- First successful clip export and repeat export use, to compare export value
  with overlay activation. Existing first-playback events cannot answer this.
- Payment completion, failed payment and cancellation cohorts alongside actual
  Stripe revenue. Stored Pro access, trials and grants must remain separate.
- Scrape freshness and missing-field visibility for these panels; absent data
  must not display as zero conversions or a healthy service.

Keep creator-level journeys in consented analytics, operational aggregates in
Grafana and money reporting in Stripe. No live dashboard or alert was changed
in this follow-up.

The full CI gate passed after the pricing coverage fix. Pricing-page coverage is
100% for statements, branches, functions and lines, with unchanged thresholds.
The avatar-profile follow-up passed 35 affected whole-file tests and the
production-mode build/typecheck. The final compact layout passed all eight
community/discovery browser journeys at 390/1440 px in light/dark, including real
touch, one-creator and 170-creator fixtures, 32 px photos with 44 px targets,
focus-preserving hover, hover-to-click focus, Escape restoration, lazy clip
counts, failed-count retry, link permissions, empty recovery and accessibility.
Unicode Creator Page navigation, canonical URLs, sitemap inclusion and
unlisted/disabled exclusions also passed through the actual popover flow.
The original coverage blocker is fixed; the final CI remains the merge gate.
