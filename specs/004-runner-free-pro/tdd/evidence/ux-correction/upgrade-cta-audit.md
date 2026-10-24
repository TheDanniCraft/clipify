# Contextual upgrade CTA review, 2026-10-19

User request: lead with the feature a user tried, retain generic account upgrades, use a quieter comparison button and avoid em dashes.

Stripe's freemium guidance recommends contextual upgrade prompts at the point a user hits a limit: https://stripe.com/resources/more/freemium-pricing-explained. Exact copy and presentation are Clipify design choices; no conversion increase is asserted.

| Entry | Review and correction |
| --- | --- |
| Runner scheduling selector and explicit Schedule action | Lead with scheduling and its outcome; preserve the unavailable selection and existing upgrade flow. |
| Overlay advanced playback/filter controls | Lead with clip selection and playback control. |
| Overlay and Playlist automatic import | Preserve import context, close the preceding locked dialog and show the playlist-import benefit. Playlist no longer lands on generic settings without opening Upgrade. |
| Theme Studio | Correct the feature from advanced filters to Theme Studio and lead with overlay design. |
| Gallery advanced filters | Route to a contextual upgrade instead of generic pricing; action says Upgrade gallery filters. |
| Overlay, Playlist and Gallery creation limits | Retain the relevant resource context and explain the resulting extra collections. |
| Reverse-trial banner | Preserve trial context instead of using whichever resource tab is selected; clear the trial override when closed. |
| Creator Page analytics and social preview | Preserve the specific attempted feature instead of generic account copy. |
| Account menu, general pricing and campaign navigation | Keep generic account/plan presentation; these have no specific attempted locked feature. Existing active campaign terms remain conditional on the configured offer. |
| Pricing cards/comparison and Pro setup | Retain selected-cycle routes, plan choice and existing checkout flow. No fabricated countdown, discount or additional step introduced. |
| Billing product changes | Keep explicit subscription review with selected product/cycle and a checkout confirmation action. This is subscription management rather than an in-feature acquisition prompt. |

The shared modal uses one selected-cycle price, an Upgrade to Pro for [price]/[cycle] primary action, contextual Also included with Pro benefits, and an installed HeroUI secondary Compare Free and Pro link styled as a button. Unknown feature values use generic copy; inherited object names are not accepted as copy entries. Existing ownership checks, campaign handling, trial checks, loading retry, cancellation information, checkout payloads and local failure recovery remain intact.

Validation is recorded in the cycle log and test summary. Real-component browser coverage uses disposable loopback fixtures and synthetic price metadata, with checkout aborted before payment processing. It does not establish production conversion performance or payment-provider settlement.
