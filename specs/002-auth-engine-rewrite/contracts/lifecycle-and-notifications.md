# Contract: Lifecycle, Entitlements, and Notifications

## Paid access

Effective creator capabilities are the union of active creator-owned and agency-funded entitlement sources. Removing one source never removes another. Adding/removing people never changes creator-seat counts.

Agency removal moves `active -> removal_scheduled`, sets `endsAt = requestedAt + 7 days`, and continues consuming the seat. At `endsAt`, only the agency-funded grant ends. Data is retained; unsupported features are blocked/read-only/disabled per the downgrade matrix.

## Account deletion

Owner-only, recent-authenticated request:

- **Paid-through (default)**: schedule Stripe renewal cancellation and Creator Account suspension at the authenticated Stripe period end.
- **Delete now**: begin suspension immediately after displaying cancellation/refund consequences.

Suspension revokes dashboard sessions, pauses overlays/integrations without deleting them, releases active agency allocations, and sets purge eligibility to 30 days later. Recovery before that boundary requires normal authentication plus recent confirmation, restores eligible prior runtime states, does not restart billing, and does not reclaim agency allocations. Purge is not allowed before the boundary and never triggers an automatic database restore.

## Required notification intents

| Lifecycle         | Event boundaries                                                            |
| ----------------- | --------------------------------------------------------------------------- |
| Deletion          | request; actual suspension/30 days; 7 days; 3 days; 1 day; 0 days; recovery |
| Agency allocation | grant; removal scheduled/7 days; 3 days; 1 day; ended                       |

Messages state the effective access/erasure date and distinguish loss of paid features from data deletion. A deletion recovery URL leads to an authenticated flow; it is not a bearer login.

## Delivery contract

`enqueueNotification(tx, event)` writes a uniquely deduplicated outbox record in the triggering database transaction. `deliverDueNotifications(now, workerId)` claims with a lease/skip-locked equivalent, sends via the transactional mail port, records provider ID, and retries bounded transient failures. Permanent failures dead-letter and alert operators. Logs/audit contain no token, OTP, overlay secret, or OAuth credential.

Stripe exclusively sends invoice, receipt, failed-payment, and subscription cancellation lifecycle emails. Clipify does not duplicate them.
