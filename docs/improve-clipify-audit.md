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
and username search, existing membership/live groups as tabs, and consistent
creator cards. All creators appears once per account; group membership and
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
creator fixtures at desktop/mobile widths in both themes: deduplication, group
tabs, case-insensitive search, empty/reset recovery with focus, profile/Twitch
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
