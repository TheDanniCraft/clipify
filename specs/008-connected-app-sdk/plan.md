# Implementation Plan: Connected application SDK milestone

Branch: feature/awards-sdk-milestone. Spec: spec.md.

## Summary and technical context

Use existing Next.js/TypeScript/Better Auth OAuth client_credentials for a new, narrowly scoped resource. Persist creator/operation eligibility independently from user/MCP grants. One reusable gateway invokes the same cached-search function as user workflows. Package a dependency-light SDK and a self-contained headless Awards Docker context with its own private PostgreSQL. No web UI, copied creator sessions, external database access, show migration or migration generation.

## Constitution check

Test-first slices, isolated fixture databases, one native integration owner carrying BDD and ATDD (same observable acceptance boundary), fixed existing thresholds. No mandatory enabled Spec Kit extension hooks. Non-UI milestone: Mobbin/browser visual review N/A; real HTTP and Docker runtime acceptance required. Authorisation and SDK errors get unit/contract denial tests, concurrency/revocation get real database checks. Preserve main workspace show.

## Structure

src/server/connected-apps/{oauth-policy,grants,gateway}.ts; src/app/api/connected-apps/route.ts and admin/route.ts; src/server/resources/cached-clip-search.ts; packages/sdk; examples/babbler-awards; test/server/connected-apps; scripts/connected-apps.mjs; specs/008-connected-app-sdk.

## Research and design

See research.md, data-model.md, contracts/operations.md. Existing user-bound TrustedCreatorPrincipal is deliberately not widened. New machine grants are read-only. Auth provider claims distinguish machine tokens; token issuer/audience and exact registered client are verified, then database grant and current creator state govern execution. Revocation and expiry are rechecked before returning data. Server-side body/response/time budgets bound network work.

## Validation and gates

Inner: PATH=/tmp/node-v26.13.0-linux-x64/bin:$PATH bun run test --runInBand --runTestsByPath <file> --coverage=false. SDK tests use a controlled real HTTP token/gateway server in integration. PostgreSQL integration uses test/support/mcp/postgres.ts and job-owned disposable loopback container/template. Container smoke builds packaged SDK then independent Awards context, checks Docker port/network configuration and executes allowed/denied searches without sharing database networks. Complete owning regression files before push. Existing complete CI coverage, lint/format/types/build remain mandatory before merge; add source ownership to coverage lists and a container smoke lane. Mutation tool unavailable: deliberate denial/expiry mutant spot checks. Retain logs under this feature tdd and CI artifacts; no live credentials.

## Overall Test Summary Destination

Feature report test-summary.md links traceability, defects, and test-first cycles. Do not claim final CI green while pending.
