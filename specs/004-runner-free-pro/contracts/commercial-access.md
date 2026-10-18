# Commercial Access Contract

## Capability matrix

| Benefit                                | Free      | Effective Pro or scoped legacy Runner grant |
| -------------------------------------- | --------- | ------------------------------------------- |
| Registered devices                     | Multiple  | Multiple                                    |
| Active broadcasts across owner devices | One       | Multiple                                    |
| Selected destinations per broadcast    | One       | Multiple simultaneous                       |
| Monthly streaming hours                | Unlimited | Unlimited                                   |
| Manual Clip playback and Live fallback | Included  | Included                                    |
| Scheduled Clip playback                | Disabled  | Enabled                                     |
| Generated-output attribution           | Required  | Optional                                    |
| Custom standby                         | Disabled  | Enabled                                     |

Basic Runner availability never requires a new standalone purchase. Keep independent authorization/resource limits on overlays/playlists. Runner-only grants do not give unrelated Pro capabilities. Effective Pro follows existing trial/grant/agency rules rather than only `user.plan`.

## Purchase retirement

Reject new individual Runner checkout from public query paths, server actions, plan builder and billing mutations before creating Stripe sessions or committing checkout intent. Reject new agency Runner-seat increases/allocations sourced from new purchases; retain already granted seats and their ordinary reconciliation/decreases. Historical invoices, webhook price matching, subscription decoding, grants and active allocation history remain readable. Existing Pro checkout/subscription behavior remains unchanged.

The user reports no paying individual Runner users and two granted recipients. Do not assume agency recurring history is absent or query production during isolated tests. Release preflight must review existing recurring items read-only before any commercial retirement action. If unexpected paid items exist, preserve them and obtain an explicit transition decision rather than auto-canceling or reclassifying unrelated benefits. No Stripe API/SDK upgrade or external billing write is included in planning.

## Expiry

At known Pro/legacy validity end, block new scheduled paid starts, new concurrent admissions and added targets. Keep all saved settings. Existing scheduled broadcasts finish their captured window and current clip; existing manual sessions finish when stopped by owner, without new targets or new paid sessions. Restore required attribution on generated content and baseline standby. Free admissions remain blocked while any grandfathered nonterminal admission exists; after all close, permit one new broadcast with one target. Valid renewed access re-enables saved configuration without duplicate starts.

Offline local snapshot must carry known expiry so new paid starts stop on time. Unknown revocation reaches the local client when it reconnects; do not claim immediate remote enforcement during a network partition. Existing owner-wide Free slot is not released by revoking/deleting a device that may still be streaming.

## Read-only release preflight

This checklist prepares the release review; it does not authorize or claim a live billing operation.

1. Record the candidate revision and the existing individual Runner price/product identifiers and agency Runner-seat identifiers from the preserved catalog. Keep current Pro identifiers and prices separate.
2. Using the existing authorized billing reporting path, inspect recurring subscription items matching those identifiers, including active, trialing, past-due and cancellation-at-period-end records. Reconcile locally stored subscription/item status with the provider's read-only record when available. Report counts and non-secret internal references; do not export payment details, customer contact information or credentials into test evidence.
3. Inspect scoped individual Runner grants, their start/end/revocation state, and existing agency license allocations. Confirm current recipients retain exactly their Runner scope and ordinary expiry/reconciliation behavior; do not convert them into unrelated Pro benefits. The reported two granted recipients are an expectation to verify, not a fixture or proof that paid history is absent.
4. Verify that new individual Runner purchases and agency Runner-seat increases are refused while existing invoices, webhook decoding, reconciliation and allocation decreases remain readable and functional. Use isolated fixture evidence for mutations; the live review stays read-only.
5. If unexpected recurring paid items, inconsistent allocations or ambiguous historical prices exist, record them and keep their current billing/access history intact. Obtain an explicit transition decision before any cancellation, price replacement, refund, benefit reclassification or customer communication. This feature performs none of those actions automatically.
6. Attach the reviewed counts, time, candidate revision and unresolved references to the release checkpoint through the existing restricted reporting channel. Do not mark this preflight executed merely because these instructions or fixture tests exist.
