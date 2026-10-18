# Runner scope approval

Status: Approved scope implemented across all23 delivery slices. Final integrated qualification remains in progress; see [test-summary.md](test-summary.md) for actual gates and release readiness. The specification and contracts contain the final technical decisions.

| Capability                      | Free                     | Pro                                                   |
| ------------------------------- | ------------------------ | ----------------------------------------------------- |
| Registered devices              | Multiple                 | Multiple                                              |
| Active broadcasts per owner     | One                      | Multiple                                              |
| Destinations per broadcast      | One                      | Multiple simultaneous                                 |
| Clip playback and live fallback | Manual                   | Manual; scheduled clip playback                       |
| Generated output watermark      | Required; movable corner | Removable                                             |
| Standby appearance              | Standard                 | Custom logo, background, message, optional next event |

Use the installed HeroUI Pro Agenda for week planner create/move/resize, with accessible form and list controls. Keep user-facing behaviors Clip playback / Live fallback separate from Manual / Scheduled control. Capture/encode once for compatible multi-target output on Pro; isolate destination failures and show per-target status. All streaming and schedule execution remain local.

Scheduled end always finishes the current clip with no preference checkbox. No new clip starts after the event end. Explicit Stop now interrupts; stalled playback has a recovery timeout. Same-source/same-target adjacent events continue without reconnecting; other adjacent events wait for clip completion. Reject overlapping events on the same Runner.

Free concurrency is owner-scoped and enforced across devices and entry points, not merely hidden by UI. A disconnected control channel does not prove the stream ended or free the slot. Technical planning must specify recoverable active-slot enforcement and the local schedule/control contract.

Preserve existing Runner grants/allocations as scoped Runner Pro benefits without extending their duration or adding unrelated Pro access. Remove standalone Runner purchase flows. On expiry retain configuration, disable future automation and new paid starts, restore generated-output branding, and let current broadcasts finish normally.

Planning defaults: no commercial Pro concurrency/target cap; DST gaps skipped and repeated times run once; stalled clips stop after 60 seconds without progress after event end or five minutes maximum overrun.

Delivery slices: access/concurrency and purchase retirement; attribution/standby; destinations and fan-out; Agenda/local schedules and graceful transitions; complete integration and release gates. Technical planning resolves contracts, data model, performance checks, isolated tests and coverage evidence before tasks and test-first implementation.

Free broadcast hours are unlimited. Monthly quotas and fallback weighting are excluded.

## Confirmed launch decisions after pricing discussion

Ship Free + Pro at current names and current prices. No Plus/Lite tier, price increase, annual-only product, subscriber price-transition policy or release email is part of this feature. Pro includes all existing paid benefits and the planned advanced Runner benefits. Free hours remain unlimited, with one active broadcast and one destination across multiple registered devices. Local execution still runs on the user's PC.

Update src/app/components/Pricing/pricing-catalog.ts, comparison.tsx and existing pricing cards/setup copy; group Runner and broadcasting alongside existing feature categories rather than adding a tier or an oversized undifferentiated list. Produce a reviewable responsive UI using existing HeroUI styling; a gated HeroUI v2 example is design inspiration, not unavailable source assumed installed. Add feature copy and onboarding/billing consistency, remove new Runner add-on offers, preserve historical IDs/grants. Update src/app/llms.txt/llms.txt and src/app/llms-full.txt/llms-full.txt, verifying served routes/src/app/lib/llmsContent.ts reflect the same plan limits, unlimited hours, local scheduling/connectivity and legacy scope. No email is sent by these tasks.

I1: stable identity, captured active occurrence and server-enforced edit/delete locks; Stop/Resume retains Scheduled mode and original end. U1: renewable Free lease with bounded local drain and terminal-only tombstone ACK. I2: focused native workflow Red/Green without coverage; full workflows coverage only at completion gates under the same owner. A1: measurable fixed translucent watermark and overlay collision handling. A2: multi-day/week schedules, DST-local boundaries and mobile day/editor support. These are planning resolutions; all product evidence remains Planned/Not Run.
