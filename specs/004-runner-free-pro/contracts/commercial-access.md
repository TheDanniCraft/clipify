# Commercial Access Contract

## Capability matrix

| Benefit                                | Free      | Effective Pro         |
| -------------------------------------- | --------- | --------------------- |
| Registered devices                     | Multiple  | Multiple              |
| Active broadcasts across owner devices | One       | Multiple              |
| Selected destinations per broadcast    | One       | Multiple simultaneous |
| Monthly streaming hours                | Unlimited | Unlimited             |
| Manual Clip playback and Live fallback | Included  | Included              |
| Scheduled Clip playback                | Disabled  | Enabled               |
| Generated-output attribution           | Required  | Optional              |
| Custom standby                         | Disabled  | Enabled               |

Basic Runner availability never requires a new standalone purchase. Keep independent authorization/resource limits on overlays/playlists. Retired Runner-only grants do not confer paid capabilities. Effective Pro follows existing trial/grant/agency rules rather than only `user.plan`.

## Purchase retirement

Remove the standalone Runner billing product, entitlement enum, agency Runner seats and purchase/configuration controls. Reject old query paths and signed purchase intents before any Stripe checkout. Effective Pro, valid Pro grants/trials and agency creator seats remain supported. Do not convert retired Runner-only benefits into Pro.

The user explicitly authorized a hard cut of unreleased Runner-only records. Preserve shared tables used by Pro and unrelated agency creator functionality. Schema source edits are permitted; generated migrations remain workflow-owned. This correction performs no external Stripe operations, customer communication or production data changes.

## Expiry

At known Pro validity end, block new scheduled paid starts, new concurrent admissions and added targets. Keep all saved settings. Existing scheduled broadcasts finish their captured window and current clip; existing manual sessions finish when stopped by owner, without new targets or new paid sessions. Restore required attribution on generated content and baseline standby. Free admissions remain blocked while any grandfathered nonterminal admission exists; after all close, permit one new broadcast with one target. Valid renewed access re-enables saved configuration without duplicate starts.

Offline local snapshot must carry known expiry so new paid starts stop on time. Unknown revocation reaches the local client when it reconnects; do not claim immediate remote enforcement during a network partition. Existing owner-wide Free slot is not released by revoking/deleting a device that may still be streaming.

## Release checks

Verify isolated Free, effective Pro, Pro grant/trial/creator-seat and expired/revoked Pro fixtures. A retired Runner-only record must not unlock advanced features. Confirm that billing and awards expose only supported products, old purchase requests cannot create checkout sessions, and retired commercial notices are discarded. Verify current Pro purchase and agency creator-seat behavior independently. Apply ordinary generated schema migrations through the owning workflow after merge; do not generate or hand-edit migration files on this branch.
