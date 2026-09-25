# Contract: Compliance Registry

## Purpose

Define one reviewed declaration source for cookie-policy tables and the read-only browser documentation audit. Existing consent details may consume the same declarations, but this feature does not own c15t activation, persistence, revocation, or cleanup behavior.

## Required service fields

Every service declaration provides:

- stable `id`, user-facing `name`, and `provider`;
- consent `category` and whether affirmative consent is required;
- specific purpose and privacy-policy purpose references;
- reviewed legal basis with applicability qualification where needed;
- data categories, recipient role, hosting regions, transfer information, and retention;
- exact or bounded network origins;
- zero or more storage declarations;
- activation, revocation, and cleanup behavior;
- links to policy sections and audit flows.

## Invariants

1. Document rendering treats existing c15t categories as read-only references and creates no second consent state.
2. A necessary service must include a necessity rationale tied to a user-requested or security-critical function.
3. A declared no-storage service cannot include cookie or web-storage keys.
4. A storage pattern must be anchored and narrow; wildcard-all patterns are invalid.
5. Every external origin belongs to one service or an explicit platform exception.
6. Existing activation, revocation, and cleanup behavior may be documented but is not modified by this feature.
7. Every service appears in at least one legal disclosure section and one audit flow.
8. Device inspection exposes names and types only, never values.

## Change classification

The following are material by default:

- new or broadened purpose;
- new data category or recipient;
- new third-country transfer or changed safeguard;
- optional-to-necessary reclassification;
- consent category movement;
- substantially longer retention;
- introduction of sale, sharing, behavioral advertising, or profiling.

Display-only wording, typo corrections, and more restrictive technical patterns are editorial unless they change the meaning of the disclosure.
