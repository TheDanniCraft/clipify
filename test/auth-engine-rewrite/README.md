# Auth engine rewrite test suites

Focused Jest evidence is grouped by boundary:

- `unit/`: pure policy, state, and transformation behavior
- `integration/`: database-backed auth and lifecycle behavior
- `contract/`: provider, route, and protected-boundary contracts
- `property/`: generated authorization and invariant matrices
- `migration/`: cutover state machine, continuity, and fault injection

Use `bun run test:auth` for the feature regression or the corresponding
`test:auth:<suite>` command for a narrow checkpoint.
