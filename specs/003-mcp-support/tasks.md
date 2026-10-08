# Tasks: MCP Support

> Consolidated MCP server scope: 66 tools on `feature/mcp-support`. The original foundation, workflow expansion, feedback and focused editing tools belong to this one feature/PR. Marketplace submission remains out of scope. Expansion task IDs are T406–T541; original IDs and blockers are preserved. Historical workflow records are in [history/workflows/README.md](history/workflows/README.md). Workflow requirement/scenario identities use the `WF-` documentation namespace to distinguish them from the original IDs; executable Gherkin IDs and retained logs are unchanged.

**Branch**: `feature/mcp-support`. **Input**: `specs/003-mcp-support/` design artifacts.

**Tests are mandatory. Published task IDs are preserved.** Reordered IDs are intentionally non-monotonic; execute document order and stated dependencies, not numerical sorting. No original ID is removed or repurposed as a different artifact.

## Format and Execution Rules

`[TDD]` owns implementation tests; `[BDD]` owns executable scenarios that also satisfy ATDD through recorded equivalence; `[GATE]` protects evidence/quality outputs. Each slice writes only its ready cases, observes intended Red, implements minimally, confirms Green and refactors. Full catalogue coverage is mandatory before release; staging examples is not sampling. A partially exercised inventory artifact remains Planned, with completed case-level evidence indexed separately.

## Phase 1: Setup

### Environment, dependencies and baseline

- [x] T001 [GATE] Verify actual branch and feature pointer in .specify/feature.json; read installed node_modules/next/dist/docs/ route and server-function guides, and record exact pinned API constraints in specs/003-mcp-support/research.md.
- [x] T002 Verify published Better Auth MCP/CIMD 1.7.6 and compatible official SDK v2 server/client peer metadata; pin dependencies in package.json and bun.lock without upgrading auth implicitly. If unavailable, record the installation blocker in specs/003-mcp-support/defect-log.md rather than inventing imports.
- [x] T003 [GATE] Capture the pre-change test/coverage baseline from jest.config.js and .github/workflows/ci.yml, preserve current thresholds, and record command/commit/artifact links in specs/003-mcp-support/test-traceability.md.
- [x] T004 [GATE] Inventory all browser/shared resource writers and callers (create/copy/import/items/secret/config/bulk volume/reference detach) in src/app/actions/database.ts, src/app/dashboard/ and src/app/components/OverlayTable/index.tsx; attach implementation destinations and lock/revision needs to specs/003-mcp-support/contracts/backend.md.

## Phase 2: Foundational

### Isolated fixtures and complete specification catalogue

- [x] T005 [TDD] Create controlled shared actor/creator/agency/OAuth fixture builders and a custom SDK client in test/support/mcp/fixtures.ts and test/support/mcp/client.ts using existing Jest setup/PGlite patterns; no production credentials or shared state.
- [x] T006 [BDD] Create real loopback PostgreSQL independent-connection fixtures in test/support/mcp/postgres.ts and BDD fixture adapter in test/bdd/support/mcp-support.ts; reuse CI browser-tests schema preparation and enforce fixture cleanup. Do not call guarded db:push:e2e outside its existing authorized CI context.
- [x] T007 [BDD] Review the complete scenario catalogue and every published ID/example in specs/003-mcp-support/spec.md; establish BDD-owned runnable feature directory test/bdd/features/mcp-support/ and fixture conventions. Materialize only the current slice’s scenarios together with their executable bindings; do not create unbound future .feature files or weaken playwright.config.ts fail-on-gen. Final release requires the entire catalogue.
- [x] T008 [GATE] Verify Evidence Artifact Registry, Source Coverage Map, Scenario Coverage Matrix and applicability in specs/003-mcp-support/test-traceability.md; confirm specs/003-mcp-support/defect-log.md and specs/003-mcp-support/test-summary.md are initialized, and add each task-to-artifact relationship without copying status fields.
- [x] T009 [BDD] Define safe fixture/real-host account prerequisites and configured client adapters in test/support/mcp/client-profiles.ts; document ChatGPT web, Claude web, Codex CLI and custom test client setup in specs/003-mcp-support/quickstart.md. Missing vendor access blocks only dependent live runs, not independent work.

## Phase 3: User Story 1 — Connect and revoke an AI client (P1)

**Independent test**: connect/deny consent/read an approved creator/revoke using a custom controlled client. Named-host full mutation acceptance remains a later integrated release gate.

### Story specification and evidence registration

- [x] T010 [US1] [BDD] Review this story’s complete published scenario catalogue and examples in specs/003-mcp-support/spec.md before production coding. Materialize each runnable scenario/example under test/bdd/features/mcp-support/ only when its slice’s bindings are ready; retain one BDD owner and both evidence roles, with no approved sampling.
- [x] T011 [US1] [GATE] Record US1 scenario/test definitions, source relationships and all explicit example rows in specs/003-mcp-support/test-traceability.md; verify report links and Planned states in specs/003-mcp-support/defect-log.md and specs/003-mcp-support/test-summary.md before implementation.

### Provider schema source — test first

- [x] T252 [US1] [TDD] Add TDD-US1-030 in test/mcp/contract/provider-schema.test.ts covering generated OAuth/JWKS model exports, existing organization/passkey schema preservation and correct Drizzle adapter model mapping. Use provider config fixtures so no unsupported network/production secrets are required.
- [x] T253 [US1] [TDD] Run test/mcp/contract/provider-schema.test.ts and observe missing-model Red; record exact failure in specs/003-mcp-support/tdd/cycle-log.md before provider schema generation.
- [x] T254 [US1] Generate provider OAuth/JWKS schema source into src/db/auth-schema.ts using the pinned supported Better Auth CLI/config fixture, inspect and merge preservation of existing tables, and verify adapter mapping in src/auth/config.ts. Do not generate/edit drizzle/ migrations or change migration guards.
- [x] T255 [US1] [TDD] Rerun test/mcp/contract/provider-schema.test.ts to Green and refactor the config fixture/schema mapping while green; record registry evidence in specs/003-mcp-support/test-traceability.md.

### Discovery and dynamic registration

- [x] T012 [US1] [TDD] Add TDD-US1-001 in test/mcp/contract/oauth.test.ts: Given a compatible client has no prior Clipify configuration; it discovers the service; assert it receives the service and authorization metadata. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-001, US1.
- [x] T013 [US1] [TDD] Add TDD-US1-002 in test/mcp/contract/oauth.test.ts: Given a custom client has no Clipify session or assigned credentials; it registers valid client metadata; assert it receives a client identity but cannot read creator data. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-002, US1.
- [x] T014 [US1] [TDD] Add TDD-US1-003 in test/mcp/contract/oauth.test.ts: Given client registration metadata has an invalid callback or unsupported grant; the client registers; assert registration is rejected and no client record is created. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-001, FR-002, US1.
- [x] T015 [US1] [TDD] Add TDD-US1-028 in test/mcp/contract/discovery.test.ts: CIMD transport rejects private/link-local/loopback/IPv6 special addresses, redirect chains, rebinding, oversized metadata, invalid client identity and mismatched callbacks; DCR validation rejects unsupported scopes. Initial Red: Missing security boundary or contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-002, FR-004, US1.
- [x] T016 [US1] [BDD] Bind BDD-US1-001, BDD-US1-002, BDD-US1-003 in test/bdd/steps/mcp-support.steps.ts using test/bdd/support/mcp-support.ts; execute all listed examples through the highest verified real entry point. Keep distinct messages/interfaces separate and use the BDD owner for both evidence roles. Full BDD-US1-021 host mutation runs are dependent on US2/US3/US4.
- [x] T017 [US1] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T018 [US1] Configure JWT plus mcp()/cimd() in src/auth/config.ts, provider-owned discovery aliases in src/app/.well-known/ and stateless Node transport in src/app/mcp/route.ts using explicit legacy:stateless. Enable both dynamic/unauthenticated registration controls; preserve existing plugins and safe Node CIMD fetch. Add a disabled-by-default MCP setting in src/server/mcp/config.ts, driven by this slice’s transport tests, so incomplete later policies are not exposed. Restrict scope/redirect/grant validation and issuer/resource matching; package/API checks precede configuration. Proceed only after the immediately preceding slice Red checkpoint; edit schema sources only, never generated drizzle/ files.
- [x] T019 [US1] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T020 [US1] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### Shared creator read pilot — test first

- [x] T256 [US1] [TDD] Add TDD-US1-031 in test/mcp/integration/creator-read-pilot.test.ts for explicit verified-principal creator-read evaluation, owner/direct/agency membership and ceiling, inaccessible creator rejection, and safe DTOs. This tests the shared evaluator/read service with controlled trusted principals before OAuth consent journeys; it does not claim live MCP token success.
- [x] T257 [US1] [TDD] Run test/mcp/integration/creator-read-pilot.test.ts and record intended missing shared-principal/read boundary Red in specs/003-mcp-support/tdd/cycle-log.md.
- [x] T258 [US1] Extract trusted-principal evaluation from src/auth/authorize-operation.ts while retaining the browser-session adapter; add safe creator-read pilot service in src/server/mcp/creators.ts. Resolve current owner/direct/agency permissions and refuse unauthorized targets. OAuth transport adaptation occurs only after the consent/token slice tests are written.
- [x] T259 [US1] [TDD] Run test/mcp/integration/creator-read-pilot.test.ts to Green, refactor while passing and record evidence in specs/003-mcp-support/test-traceability.md.

### Complete consent, issuance and authenticated read flow

All consent preset, creator selection, CSRF/grant binding and code/token tests precede this coherent OAuth flow’s production changes. The tested pilot makes the read assertions runnable; token issuance and consent are integrated before the first Green checkpoint. Each smaller inner case still records its own Red/Green evidence; do not implement beyond current failed assertions.

- [x] T021 [US1] [TDD] Add TDD-US1-004 in test/mcp/contract/oauth.test.ts: Given a registered client requests read access to a creator the user owns; the signed-in user approves those permissions and that creator; assert the client reads that creator and cannot access an unapproved creator. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-003, SC-001, US1.
- [x] T022 [US1] [TDD] Add TDD-US1-005 in test/mcp/contract/oauth.test.ts: Given the user is shown the client and requested permissions; the user denies consent; assert no grant is issued and no creator data is accessible. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-002, FR-003, US1.
- [x] T023 [US1] [TDD] Add TDD-US1-026 in test/mcp/contract/oauth.test.ts: Approved creator set intersection, per-call creator selection, rejection of missing/unapproved context, new consent for expansion, and membership removal shrinking access without expanding the grant. Initial Red: Missing grant boundary or incorrect access decision. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-003, FR-006, FR-008, FR-011, US1.
- [x] T024 [US1] [TDD] Add TDD-US1-029 in test/mcp/contract/oauth.test.ts: Consent approval CSRF/state protection, authenticate actor, bind approved creator set to issued grant ID and generation; reject unknown/revoked grant, client/subject mismatch and audience mismatch. Initial Red: Missing security boundary or contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-003, FR-005, US1.
- [x] T025 [US1] [BDD] Bind BDD-US1-004, BDD-US1-005, BDD-US1-022, BDD-US1-023 in test/bdd/steps/mcp-support.steps.ts using test/bdd/support/mcp-support.ts; execute all listed examples through the highest verified real entry point. Keep distinct messages/interfaces separate and use the BDD owner for both evidence roles. Full BDD-US1-021 host mutation runs are dependent on US2/US3/US4.
- [x] T030 [US1] [TDD] Add TDD-US1-006 in test/mcp/contract/oauth.test.ts: Given an approved authorization code and matching proof exist; the client exchanges the code; assert expiring access bound to Clipify MCP is issued. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-004, US1.
- [x] T031 [US1] [TDD] Add TDD-US1-007 in test/mcp/contract/oauth.test.ts: Given missing PKCE proof is presented; the client exchanges authorization; assert access is rejected without issuing tokens. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-003, FR-004, US1.
- [x] T032 [US1] [TDD] Add TDD-US1-008 in test/mcp/contract/oauth.test.ts: Given incorrect PKCE proof is presented; the client exchanges authorization; assert access is rejected without issuing tokens. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-003, FR-004, US1.
- [x] T033 [US1] [TDD] Add TDD-US1-009 in test/mcp/contract/oauth.test.ts: Given a reused authorization code is presented; the client exchanges authorization; assert access is rejected without issuing tokens. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-003, FR-004, US1.
- [x] T034 [US1] [TDD] Add TDD-US1-010 in test/mcp/contract/oauth.test.ts: Given an expired authorization code is presented; the client exchanges authorization; assert access is rejected without issuing tokens. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-003, FR-004, US1.
- [x] T035 [US1] [TDD] Add TDD-US1-011 in test/mcp/contract/oauth.test.ts: Given an unregistered callback is presented; the client exchanges authorization; assert access is rejected without issuing tokens. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-003, FR-004, US1.
- [x] T036 [US1] [TDD] Add TDD-US1-012 in test/mcp/contract/oauth.test.ts: Given a changed callback is presented; the client exchanges authorization; assert access is rejected without issuing tokens. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-003, FR-004, US1.
- [x] T037 [US1] [TDD] Add TDD-US1-013 in test/mcp/contract/oauth.test.ts: Given the client presents missing access; it calls a tool; assert the call is rejected without reading or changing creator data. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-004, FR-004, SC-004, US1.
- [x] T038 [US1] [TDD] Add TDD-US1-014 in test/mcp/contract/oauth.test.ts: Given the client presents expired access; it calls a tool; assert the call is rejected without reading or changing creator data. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-004, FR-004, SC-004, US1.
- [x] T039 [US1] [TDD] Add TDD-US1-015 in test/mcp/contract/oauth.test.ts: Given the client presents an invalid signature; it calls a tool; assert the call is rejected without reading or changing creator data. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-004, FR-004, SC-004, US1.
- [x] T040 [US1] [TDD] Add TDD-US1-016 in test/mcp/contract/oauth.test.ts: Given the client presents an incorrect issuer; it calls a tool; assert the call is rejected without reading or changing creator data. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-004, FR-004, SC-004, US1.
- [x] T041 [US1] [TDD] Add TDD-US1-017 in test/mcp/contract/oauth.test.ts: Given the client presents an audience for another service; it calls a tool; assert the call is rejected without reading or changing creator data. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-004, FR-004, SC-004, US1.
- [x] T042 [US1] [TDD] Add TDD-US1-018 in test/mcp/contract/oauth.test.ts: Given a valid refresh grant exists; the client refreshes access; assert renewed access preserves or narrows the approved permissions. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-004, US1.
- [x] T043 [US1] [TDD] Add TDD-US1-019 in test/mcp/contract/oauth.test.ts: Given a refresh grant is expired or the client requests wider permissions; the client refreshes access; assert the refresh is rejected without widening access. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-005, FR-004, US1.
- [x] T044 [US1] [TDD] Add TDD-US1-021 in test/mcp/contract/oauth.test.ts: Single-use code consumption remains atomic across simultaneous exchanges. Initial Red: Missing invariant or incorrect boundary assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-003, FR-004, US1.
- [x] T045 [US1] [TDD] Add TDD-US1-022 in test/mcp/contract/oauth.test.ts: Token expiry rejects exactly at expiry; rejects malformed authorization headers and malformed token claims. Initial Red: Missing invariant or incorrect boundary assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-004, FR-004, US1.
- [x] T046 [US1] [TDD] Add TDD-US1-023 in test/mcp/integration/retries.test.ts: Refresh rotation rejects reuse beyond any explicitly documented retry window and never changes resource audience or creator grant. Initial Red: Missing invariant or incorrect boundary assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-005, FR-004, US1.
- [x] T047 [US1] [BDD] Bind BDD-US1-006, BDD-US1-007, BDD-US1-008, BDD-US1-009, BDD-US1-010, BDD-US1-011, BDD-US1-012, BDD-US1-013, BDD-US1-014, BDD-US1-015, BDD-US1-016, BDD-US1-017, BDD-US1-018, BDD-US1-019 in test/bdd/steps/mcp-support.steps.ts using test/bdd/support/mcp-support.ts; execute all listed examples through the highest verified real entry point. Keep distinct messages/interfaces separate and use the BDD owner for both evidence roles. Full BDD-US1-021 host mutation runs are dependent on US2/US3/US4.
- [x] T060 [US1] [TDD] Add TDD-US1-027 in test/mcp/contract/oauth.test.ts: Read, Read & edit, individual scope removal, explicit overlay/playlist/both delete opt-ins, rejected unknown scopes and exact final grant matching. Initial Red: Missing consent selection or unintended scope grant. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-003, FR-018, US1.
- [x] T061 [US1] [BDD] Materialize and bind BDD-US1-024 consent examples in test/bdd/features/mcp-support/consent.feature and test/bdd/steps/mcp-support.steps.ts before consent implementation. Specify BDD-US1-021 host adapter assertions in test/support/mcp/client-profiles.ts now; its executable full-host feature is materialized only after resource/policy/activity integration.
- [x] T048 [US1] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T062 [US1] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T027 [US1] Implement src/server/mcp/grants.ts, src/auth/mcp-principal.ts and src/app/auth/mcp/consent/page.tsx after the complete authorization-flow Red checkpoint. Preserve immutable UUID grant ID/generation, provider subject/client/consent binding, expiry/revocation, unique (grant, creator), URL-capable client IDs, server-validated agency context and exact selected creator set. Wire the tested read pilot into the authenticated tools registry so consent scenarios can actually read; no mutation tools are introduced in this slice.
- [x] T049 [US1] Implement src/auth/mcp-principal.ts and src/server/mcp/server.ts to verify provider signature/issuer/audience/expiry, code single use/PKCE, exact subject/client/grant generation, and approved scopes/creator set. Resolve live grant before protocol/tools; refresh only preserves/narrows access. Never synthesize browser cookies or trust clientInfo. Reject invalid identity, expiry and unsupported protocol traffic with correct OAuth challenges. Proceed only after the immediately preceding slice Red checkpoint; edit schema sources only, never generated drizzle/ files.
- [x] T063 [US1] Implement the final selected-scope handling in src/server/mcp/scopes.ts and src/app/auth/mcp/consent/page.tsx only after T060/T061 and the shared authorization-flow Red. Read and Read & edit omit delete; grant exactly selected individual scopes, reject unknown scopes, and validate both explicit resource delete opt-ins. No host-specific production workaround is added.
- [x] T028 [US1] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T050 [US1] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T064 [US1] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T029 [US1] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.
- [x] T051 [US1] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.
- [x] T065 [US1] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### Immediate connection revocation

- [x] T052 [US1] [TDD] Add TDD-US1-020 in test/mcp/contract/oauth.test.ts: Given two connected clients have separate approved grants; the user lists connections and revokes the first; assert the first client’s old access and refresh are rejected while the second remains usable. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-006, FR-005, SC-001, SC-004, US1.
- [x] T053 [US1] [TDD] Add TDD-US1-024 in test/mcp/contract/oauth.test.ts: Grant revocation is durable; revocation failure reports failure and leaves connection status accurate; concurrent revoke and next call cannot authorize after completed revocation. Initial Red: Missing invariant or incorrect boundary assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-006, FR-005, US1.
- [x] T054 [US1] [BDD] Bind BDD-US1-020 in test/bdd/steps/mcp-support.steps.ts using test/bdd/support/mcp-support.ts; execute all listed examples through the highest verified real entry point. Keep distinct messages/interfaces separate and use the BDD owner for both evidence roles. Full BDD-US1-021 host mutation runs are dependent on US2/US3/US4.
- [x] T055 [US1] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T056 [US1] Implement user-owned connection listing/revoke in src/server/mcp/grants.ts and src/app/dashboard/settings/connected-apps-panel.tsx with CSRF checks, grant locking and local durable revoke plus provider refresh/consent cleanup. Old access immediately fails; partial provider cleanup leaves local grant revoked and reports retryable cleanup status. Separate connections remain independent. Proceed only after the immediately preceding slice Red checkpoint; edit schema sources only, never generated drizzle/ files.
- [x] T057 [US1] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T058 [US1] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### Required client profiles — staged contract cases

Only ready controlled-client contract cases execute now; real-host mutation examples are explicitly deferred to T247. No host success is claimed here.

- [x] T059 [US1] [TDD] Define TDD-US1-025 controlled client-profile contract cases in test/mcp/contract/client-profiles.test.ts; actual named-host mutation acceptance remains Planned until T247. Bindings must not report real vendor acceptance from fixtures. Add current discovery/consent/revoke cases incrementally; mutation cases enter with their verb cycles.

### US1 intermediate quality/report review

- [x] T066 [US1] [GATE] Run all currently materialized story scenarios and affected Jest files, existing regression suites and applicable quality gates from specs/003-mcp-support/plan.md. Preserve fail-on-gen and nonempty discovery. Record slice results in specs/003-mcp-support/test-traceability.md; do not run or skip unmaterialized future cases, and do not declare full-story/release Green until its entire catalogue is executable. Final T249 runs all mandatory integrated gates.
- [x] T067 [US1] [GATE] Update final slice evidence and actual quality-gate results for US1 in specs/003-mcp-support/test-traceability.md; update specs/003-mcp-support/defect-log.md with investigation/closure or explicit risk decisions, and specs/003-mcp-support/test-summary.md with exact totals and outstanding cross-story host runs. Review story reports without falsely marking overall Go.

## Phase 4: User Story 2 — Manage overlays and playlists through chat (P1)

**Independent test**: each of thirteen public verbs persists correct state, rejects its applicable validation/authority/plan conflicts, and preserves browser behavior.

### Story specification and evidence registration

- [x] T068 [US2] [BDD] Review this story’s complete published scenario catalogue and examples in specs/003-mcp-support/spec.md before production coding. Materialize each runnable scenario/example under test/bdd/features/mcp-support/ only when its slice’s bindings are ready; retain one BDD owner and both evidence roles, with no approved sampling.
- [x] T069 [US2] [GATE] Record US2 scenario/test definitions, source relationships and all explicit example rows in specs/003-mcp-support/test-traceability.md; verify report links and Planned states in specs/003-mcp-support/defect-log.md and specs/003-mcp-support/test-summary.md before implementation.

### Creator discovery and capabilities

- [x] T070 [US2] [TDD] Add TDD-US2-001 in test/mcp/integration/resource-operations.test.ts: Given owned, directly shared, agency-linked, and inaccessible creators exist; the client lists creators; assert only creators permitted by both the grant and current membership appear. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-006, US2.
- [x] T071 [US2] [TDD] Add TDD-US2-002 in test/mcp/integration/resource-operations.test.ts: Given the user selects an accessible creator with current usage and grants; the client requests capabilities; assert the effective plan, current usage, limits, and eligible operations are reported. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-006, US2.
- [x] T072 [US2] [BDD] Bind BDD-US2-001, BDD-US2-002 in test/bdd/steps/mcp-support.steps.ts using test/bdd/support/mcp-support.ts; execute all listed examples through the highest verified real entry point. Keep distinct messages/interfaces separate and use the BDD owner for both evidence roles. Full BDD-US1-021 host mutation runs are dependent on US2/US3/US4.
- [x] T073 [US2] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T074 [US2] Extend the already-tested shared principal/read pilot from src/auth/authorize-operation.ts and src/server/mcp/creators.ts with list_creators and get_capabilities adapters in src/server/mcp/tools.ts; revalidate approved-set/live access and current owner entitlements. No second permission evaluator is created.
- [x] T075 [US2] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T076 [US2] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### Strict DTO, pagination and secret-free result primitives

Focused inner tests execute now; operation-specific Gherkin examples become executable with each actual public verb below.

- [x] T098 [US2] [TDD] Add TDD-US2-016 in test/mcp/integration/resource-operations.test.ts: Given the request includes an unknown input field; the client submits the mutation; assert an invalid-input error is returned and no partial change occurs. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-013, FR-012, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T099 [US2] [TDD] Add TDD-US2-017 in test/mcp/integration/resource-operations.test.ts: Given the request includes an invalid identifier; the client submits the mutation; assert an invalid-input error is returned and no partial change occurs. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-013, FR-012, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T100 [US2] [TDD] Add TDD-US2-018 in test/mcp/integration/resource-operations.test.ts: Given the request includes a wrong field type; the client submits the mutation; assert an invalid-input error is returned and no partial change occurs. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-013, FR-012, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T101 [US2] [TDD] Add TDD-US2-019 in test/mcp/integration/resource-operations.test.ts: Given the request includes an out-of-range value; the client submits the mutation; assert an invalid-input error is returned and no partial change occurs. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-013, FR-012, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T102 [US2] [TDD] Add TDD-US2-020 in test/mcp/integration/resource-operations.test.ts: Given the request includes an invalid playlist item reference; the client submits the mutation; assert an invalid-input error is returned and no partial change occurs. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-013, FR-012, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T103 [US2] [TDD] Add TDD-US2-021 in test/mcp/integration/resource-operations.test.ts: Given the request includes a non-permutation playlist reorder; the client submits the mutation; assert an invalid-input error is returned and no partial change occurs. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-013, FR-012, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T104 [US2] [TDD] Add TDD-US2-022 in test/mcp/integration/resource-operations.test.ts: Given a creator has overlays, OAuth connections, and runner credentials; the client reads every supported tool result; assert no secret or credential appears and excluded operations are unavailable. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-012, SC-002, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T105 [US2] [TDD] Define reusable validation step bindings in test/bdd/steps/mcp-support.steps.ts; each BDD-US2-016–022 runnable example is materialized with its actual public verb, so no scenario can pass merely because a tool is missing.
- [x] T106 [US2] [TDD] Add TDD-US2-041 in test/mcp/integration/resource-operations.test.ts: Each overlay/playlist/item mutation crossed with missing scope, denied creator/resource ownership, applicable paid restriction, malformed input and persistence failure; positive direct/agency delegation and current-plan checks. Initial Red: Missing security boundary or contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-013, FR-009, FR-012, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T107 [US2] [BDD] Bind BDD-US2-016, BDD-US2-017, BDD-US2-018, BDD-US2-019, BDD-US2-020, BDD-US2-021, BDD-US2-022 in test/bdd/steps/mcp-support.steps.ts using test/bdd/support/mcp-support.ts; execute all listed examples through the highest verified real entry point. Keep distinct messages/interfaces separate and use the BDD owner for both evidence roles. Full BDD-US1-021 host mutation runs are dependent on US2/US3/US4.
- [x] T108 [US2] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T109 [US2] Implement strict schemas and public allowlist DTOs in src/server/mcp/schemas.ts and src/server/mcp/tools.ts: UUID resource IDs, existing creator ID domain, input JSON max 256 KiB, names trimmed/nonempty/max 120 characters, list limit default 25/max 100, opaque validated stable cursors, expectedRevision positive integer, retryKey 1–128 characters. Reject unknown/wrong/nullability/enum/array/order classes per existing domain constraints. Exclude cookies/tokens/overlay secrets/runner credentials and unsupported operations. Proceed only after the immediately preceding slice Red checkpoint; edit schema sources only, never generated drizzle/ files.
- [x] T110 [US2] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T111 [US2] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### Retry repository primitives

- [x] T112 [US2] [TDD] Add TDD-US2-023 in test/mcp/integration/retries.test.ts: Given a overlay create succeeds but its response is lost; the client retries identical inputs with the same retry key; assert the original result is returned and exactly one resource exists. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-014, FR-013, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T113 [US2] [TDD] Add TDD-US2-024 in test/mcp/integration/retries.test.ts: Given two identical overlay creates share a retry key; they arrive concurrently; assert both return the same committed resource without duplicate creation. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-014, FR-013, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T114 [US2] [TDD] Add TDD-US2-025 in test/mcp/integration/retries.test.ts: Given a overlay retry key already has a successful result; the client reuses the key with changed inputs; assert a retry-conflict error occurs and the original resource is unchanged. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-015, FR-013, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T115 [US2] [TDD] Add TDD-US2-026 in test/mcp/integration/retries.test.ts: Given a playlist create succeeds but its response is lost; the client retries identical inputs with the same retry key; assert the original result is returned and exactly one resource exists. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-014, FR-013, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T116 [US2] [TDD] Add TDD-US2-027 in test/mcp/integration/retries.test.ts: Given two identical playlist creates share a retry key; they arrive concurrently; assert both return the same committed resource without duplicate creation. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-014, FR-013, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T117 [US2] [TDD] Add TDD-US2-028 in test/mcp/integration/retries.test.ts: Given a playlist retry key already has a successful result; the client reuses the key with changed inputs; assert a retry-conflict error occurs and the original resource is unchanged. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-015, FR-013, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T118 [US2] [TDD] Add TDD-US2-029 in test/mcp/integration/retries.test.ts: Given two clients or actors or creators use the same textual retry key; each performs an authorized creation; assert their independent requests do not reuse another context’s result. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-013, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T119 [US2] [TDD] Add TDD-US2-036 in test/mcp/integration/retries.test.ts: Retry expiry: replay before 24 hours; expiry boundary; missing key; oversized key; failure before commit remains retryable; committed result survives lost response. Initial Red: Missing invariant or incorrect boundary assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-014, EC-015, FR-013, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T120 [US2] [TDD] Add TDD-US2-037 in test/mcp/integration/retries.test.ts: Retry lookup revalidates current authorization and entitlements before disclosing any stored result. Initial Red: Missing invariant or incorrect boundary assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-013, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T121 [US2] [BDD] Define retry fixture/bindings in test/bdd/steps/mcp-support.steps.ts; materialize BDD-US2-023–029 examples only with overlay/playlist create verb cycles. Inner retry repository tests run now; integrated artifacts stay Planned until complete.
- [x] T122 [US2] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T123 [US2] Add mcp_mutation_retries in src/db/schema.ts and src/server/mcp/retries.ts: unique (grant, actor, client, creator, tool, retryKey), canonical argument digest, safe committed result, resource ID and expiry retained at least 24 hours. Reauthorize before lookup; identical concurrent replays return one committed result, changed payload rejects, rollback leaves no successful record. Creation/retry/result audit share one transaction; expiry cleanup is bounded. Proceed only after the immediately preceding slice Red checkpoint; edit schema sources only, never generated drizzle/ files.
- [x] T124 [US2] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T125 [US2] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### Revision primitives and existing browser writers

- [x] T126 [US2] [TDD] Add TDD-US2-038 in test/mcp/integration/revisions.test.ts: Matching, missing, stale and malformed revisions; atomic competing edits; playlist-item revision advancement; rollback preserves revision; fresh-read retry; all twelve resource/interface combinations. Initial Red: Missing comparison or lost-update assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-021, FR-007, FR-014, FR-017, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T127 [US2] [BDD] Define revision-conflict fixture/bindings in test/bdd/steps/mcp-support.steps.ts for BDD-US2-030–031. Inner revision helper and existing browser-to-browser cases run now; browser/MCP combinations are materialized with each public edit verb, preserving exact example IDs.
- [x] T128 [US2] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T129 [US2] After the focused inner revision tests are Red, add configurationRevision positive integer default 1 to overlays/playlists in src/db/schema.ts and compare-and-increment helpers in src/server/resources/revision.ts. Update existing browser writers/callers, parent playlist item revisions and indirect config/reference/secret writes; runtime usage timestamps do not increment revision. Handle stale autosave/reload in dashboard/OverlayTable callers. MCP adapters exercise the same helpers in their later verb cycles.
- [x] T130 [US2] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T131 [US2] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### Risk/explicit-delete permission primitives

- [x] T132 [US2] [TDD] Add TDD-US2-039 in test/mcp/integration/resource-operations.test.ts: Accurate read-only/destructive tool metadata, delete permission enforced regardless of host prompts, distinct resource delete scopes, and normal backend access denial despite approved delete scope. Initial Red: Incorrect risk hint or missing deletion permission guard. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, FR-008, FR-018, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T133 [US2] [BDD] Define risk/delete permission bindings in test/bdd/steps/mcp-support.steps.ts for BDD-US2-032. Exercise inner permission/annotation schema now; public delete examples are materialized with each delete verb. No unconditional confirmed:true bypass exists.
- [x] T134 [US2] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T135 [US2] Implement per-resource approved delete scope checks and accurate readOnlyHint/destructiveHint/idempotentHint/openWorldHint in src/server/mcp/tools.ts. Delete requires current backend access and expectedRevision; host hints/confirmed:true grant no authority. Test host that ignores hints; approved deletion needs no dashboard confirmation. Proceed only after the immediately preceding slice Red checkpoint; edit schema sources only, never generated drizzle/ files.
- [x] T136 [US2] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T137 [US2] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### Shared service extraction with preserved browser semantics

Existing return/effect preservation tests drive extraction. No new public write verb is implemented before its own outer tests.

- [x] T090 [US2] [TDD] Add TDD-US2-034 in test/mcp/integration/resource-operations.test.ts: Every overlay, playlist, and playlist-item mutation rolls back partial persistence on injected failure. Initial Red: Missing invariant or incorrect boundary assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-017, FR-007, US2.
- [x] T091 [US2] [TDD] Add TDD-US2-040 in test/mcp/integration/revisions.test.ts: Paginated list empty/boundary/invalid cursor classes, output redaction and resource ownership; delete reference cleanup increments affected overlay revisions and preserves gallery unpublishing behavior. Initial Red: Missing security boundary or contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, FR-012, FR-014, US2. In this prerequisite cycle add only the focused inner schema/retry/revision/risk/service cases that can execute independently of unbuilt public tools. Public operation-specific examples are added in the named verb cycles below; retain whole-artifact Planned status until every required example is run.
- [x] T092 [US2] [BDD] Add shared-service preservation tests/bindings in test/mcp/integration/resource-operations.test.ts for the extraction seam and existing browser effects only. Keep BDD-US2-003 through BDD-US2-015 in the spec catalogue; materialize each with its corresponding public verb cycle, not in this prerequisite feature.
- [x] T093 [US2] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T094 [US2] Extract the shared overlay service interface and existing browser adapter boundary in src/server/resources/overlays.ts and src/app/actions/database.ts under tests for preserved return/error/effect semantics. Do not register or implement new public mutation verbs here; each verb is implemented in its explicit later Red/Green cycle. Preserve the existing runtime backend restrictions throughout.
- [x] T095 [US2] Extract the shared playlist service interface and existing browser adapter boundary in src/server/resources/playlists.ts and src/app/actions/database.ts under existing-behavior preservation tests. Keep detach/gallery-unpublish and clip validation behavior. New public verbs and write behavior are deferred to the individual tested verb cycles below.
- [x] T096 [US2] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T097 [US2] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### list_overlays — focused outer Red/Green cycle

- [x] T077 [US2] [TDD] Add TDD-US2-003 in test/mcp/integration/resource-operations.test.ts: Given an eligible creator has consent and current permission for list overlay; the client performs list overlay; assert the correct result and resulting state are visible to the creator in the dashboard. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, SC-002, US2. This task begins the dedicated list_overlays cycle; add only this operation’s public cases now.
- [x] T260 [US2] [TDD] Extend applicable existing TDD inventory artifacts for list_overlays: TDD-US2-040 pagination/redaction, in test/mcp/integration/resource-operations.test.ts, test/mcp/integration/retries.test.ts and test/mcp/integration/revisions.test.ts as applicable. Add the actual per-verb negative/boundary cases before the adapter is implemented; do not duplicate artifacts or mark partially covered IDs Green.
- [x] T261 [US2] [BDD] Materialize BDD-US2-003 and only its applicable validation, retry, revision, redaction and delete-scope examples from the complete catalogue in test/bdd/features/mcp-support/list_overlays.feature; bind them in test/bdd/steps/mcp-support.steps.ts. Preserve stable scenario/example identity when collecting subsets; for shared outlines use one canonical feature per scenario and append ready example rows, never duplicate scenario IDs across features.
- [x] T262 [US2] [TDD] Run the new list_overlays Jest file cases and nonempty generated BDD selection via bunx bddgen/Playwright; verify intended unsupported behavior Red in specs/003-mcp-support/tdd/cycle-log.md. Setup/missing-step failure is not Red.
- [x] T263 [US2] Implement only list_overlays in src/server/resources/overlays.ts and src/server/mcp/tools.ts using the now-tested strict DTOs, current backend permissions/owner policy, revisions/retry helpers and delete scopes as applicable. Route browser calls to the same service; preserve transaction rollback and existing side effects. No distinct MCP quota policy.
- [x] T264 [US2] [TDD] Run list_overlays cases and its exact BDD examples to Green; refactor only this verb while passing. Store slice evidence in specs/003-mcp-support/tdd/cycle-log.md and test-traceability.md; aggregate artifact becomes Green only when all its required cases have run.

### get_overlay — focused outer Red/Green cycle

- [x] T078 [US2] [TDD] Add TDD-US2-004 in test/mcp/integration/resource-operations.test.ts: Given an eligible creator has consent and current permission for read overlay; the client performs read overlay; assert the correct result and resulting state are visible to the creator in the dashboard. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, SC-002, US2. This task begins the dedicated get_overlay cycle; add only this operation’s public cases now.
- [x] T265 [US2] [TDD] Extend applicable existing TDD inventory artifacts for get_overlay: TDD-US2-040 pagination/redaction, in test/mcp/integration/resource-operations.test.ts, test/mcp/integration/retries.test.ts and test/mcp/integration/revisions.test.ts as applicable. Add the actual per-verb negative/boundary cases before the adapter is implemented; do not duplicate artifacts or mark partially covered IDs Green.
- [x] T266 [US2] [BDD] Materialize BDD-US2-004 and only its applicable validation, retry, revision, redaction and delete-scope examples from the complete catalogue in test/bdd/features/mcp-support/get_overlay.feature; bind them in test/bdd/steps/mcp-support.steps.ts. Preserve stable scenario/example identity when collecting subsets; for shared outlines use one canonical feature per scenario and append ready example rows, never duplicate scenario IDs across features.
- [x] T267 [US2] [TDD] Run the new get_overlay Jest file cases and nonempty generated BDD selection via bunx bddgen/Playwright; verify intended unsupported behavior Red in specs/003-mcp-support/tdd/cycle-log.md. Setup/missing-step failure is not Red.
- [x] T268 [US2] Implement only get_overlay in src/server/resources/overlays.ts and src/server/mcp/tools.ts using the now-tested strict DTOs, current backend permissions/owner policy, revisions/retry helpers and delete scopes as applicable. Route browser calls to the same service; preserve transaction rollback and existing side effects. No distinct MCP quota policy.
- [x] T269 [US2] [TDD] Run get_overlay cases and its exact BDD examples to Green; refactor only this verb while passing. Store slice evidence in specs/003-mcp-support/tdd/cycle-log.md and test-traceability.md; aggregate artifact becomes Green only when all its required cases have run.

### create_overlay — focused outer Red/Green cycle

- [x] T079 [US2] [TDD] Add TDD-US2-005 in test/mcp/integration/resource-operations.test.ts: Given an eligible creator has consent and current permission for create overlay; the client performs create overlay; assert the correct result and resulting state are visible to the creator in the dashboard. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, SC-002, US2. This task begins the dedicated create_overlay cycle; add only this operation’s public cases now.
- [x] T271 [US2] [BDD] Materialize BDD-US2-005 and only its applicable validation, retry, revision, redaction and delete-scope examples from the complete catalogue in test/bdd/features/mcp-support/create_overlay.feature; bind them in test/bdd/steps/mcp-support.steps.ts. Preserve stable scenario/example identity when collecting subsets; for shared outlines use one canonical feature per scenario and append ready example rows, never duplicate scenario IDs across features.
- [x] T272 [US2] [TDD] Run the new create_overlay Jest file cases and nonempty generated BDD selection via bunx bddgen/Playwright; verify intended unsupported behavior Red in specs/003-mcp-support/tdd/cycle-log.md. Setup/missing-step failure is not Red.
- [x] T273 [US2] Implement only create_overlay in src/server/resources/overlays.ts and src/server/mcp/tools.ts using the now-tested strict DTOs, current backend permissions/owner policy, revisions/retry helpers and delete scopes as applicable. Route browser calls to the same service; preserve transaction rollback and existing side effects. No distinct MCP quota policy.
- [x] T274 [US2] [TDD] Run create_overlay cases and its exact BDD examples to Green; refactor only this verb while passing. Store slice evidence in specs/003-mcp-support/tdd/cycle-log.md and test-traceability.md; aggregate artifact becomes Green only when all its required cases have run.

### update_overlay — focused outer Red/Green cycle

- [x] T080 [US2] [TDD] Add TDD-US2-006 in test/mcp/integration/resource-operations.test.ts: Given an eligible creator has consent and current permission for update overlay; the client performs update overlay; assert the correct result and resulting state are visible to the creator in the dashboard. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, SC-002, US2. This task begins the dedicated update_overlay cycle; add only this operation’s public cases now.
- [x] T276 [US2] [BDD] Materialize BDD-US2-006 and only its applicable validation, retry, revision, redaction and delete-scope examples from the complete catalogue in test/bdd/features/mcp-support/update_overlay.feature; bind them in test/bdd/steps/mcp-support.steps.ts. Preserve stable scenario/example identity when collecting subsets; for shared outlines use one canonical feature per scenario and append ready example rows, never duplicate scenario IDs across features.
- [x] T277 [US2] [TDD] Run the new update_overlay Jest file cases and nonempty generated BDD selection via bunx bddgen/Playwright; verify intended unsupported behavior Red in specs/003-mcp-support/tdd/cycle-log.md. Setup/missing-step failure is not Red.
- [x] T278 [US2] Implement only update_overlay in src/server/resources/overlays.ts and src/server/mcp/tools.ts using the now-tested strict DTOs, current backend permissions/owner policy, revisions/retry helpers and delete scopes as applicable. Route browser calls to the same service; preserve transaction rollback and existing side effects. No distinct MCP quota policy.
- [x] T279 [US2] [TDD] Run update_overlay cases and its exact BDD examples to Green; refactor only this verb while passing. Store slice evidence in specs/003-mcp-support/tdd/cycle-log.md and test-traceability.md; aggregate artifact becomes Green only when all its required cases have run.

### delete_overlay — focused outer Red/Green cycle

- [x] T081 [US2] [TDD] Add TDD-US2-007 in test/mcp/integration/resource-operations.test.ts: Given an eligible creator has consent and current permission for delete overlay; the client performs delete overlay; assert the correct result and resulting state are visible to the creator in the dashboard. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, SC-002, US2. This task begins the dedicated delete_overlay cycle; add only this operation’s public cases now.
- [x] T281 [US2] [BDD] Materialize BDD-US2-007 and only its applicable validation, retry, revision, redaction and delete-scope examples from the complete catalogue in test/bdd/features/mcp-support/delete_overlay.feature; bind them in test/bdd/steps/mcp-support.steps.ts. Preserve stable scenario/example identity when collecting subsets; for shared outlines use one canonical feature per scenario and append ready example rows, never duplicate scenario IDs across features.
- [x] T282 [US2] [TDD] Run the new delete_overlay Jest file cases and nonempty generated BDD selection via bunx bddgen/Playwright; verify intended unsupported behavior Red in specs/003-mcp-support/tdd/cycle-log.md. Setup/missing-step failure is not Red.
- [x] T283 [US2] Implement only delete_overlay in src/server/resources/overlays.ts and src/server/mcp/tools.ts using the now-tested strict DTOs, current backend permissions/owner policy, revisions/retry helpers and delete scopes as applicable. Route browser calls to the same service; preserve transaction rollback and existing side effects. No distinct MCP quota policy.
- [x] T284 [US2] [TDD] Run delete_overlay cases and its exact BDD examples to Green; refactor only this verb while passing. Store slice evidence in specs/003-mcp-support/tdd/cycle-log.md and test-traceability.md; aggregate artifact becomes Green only when all its required cases have run.

### list_playlists — focused outer Red/Green cycle

- [x] T082 [US2] [TDD] Add TDD-US2-008 in test/mcp/integration/resource-operations.test.ts: Given an eligible creator has consent and current permission for list playlist; the client performs list playlist; assert the correct result and resulting state are visible to the creator in the dashboard. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, SC-002, US2. This task begins the dedicated list_playlists cycle; add only this operation’s public cases now.
- [x] T285 [US2] [TDD] Extend applicable existing TDD inventory artifacts for list_playlists: TDD-US2-040 pagination/redaction, in test/mcp/integration/resource-operations.test.ts, test/mcp/integration/retries.test.ts and test/mcp/integration/revisions.test.ts as applicable. Add the actual per-verb negative/boundary cases before the adapter is implemented; do not duplicate artifacts or mark partially covered IDs Green.
- [x] T286 [US2] [BDD] Materialize BDD-US2-008 and only its applicable validation, retry, revision, redaction and delete-scope examples from the complete catalogue in test/bdd/features/mcp-support/list_playlists.feature; bind them in test/bdd/steps/mcp-support.steps.ts. Preserve stable scenario/example identity when collecting subsets; for shared outlines use one canonical feature per scenario and append ready example rows, never duplicate scenario IDs across features.
- [x] T287 [US2] [TDD] Run the new list_playlists Jest file cases and nonempty generated BDD selection via bunx bddgen/Playwright; verify intended unsupported behavior Red in specs/003-mcp-support/tdd/cycle-log.md. Setup/missing-step failure is not Red.
- [x] T288 [US2] Implement only list_playlists in src/server/resources/playlists.ts and src/server/mcp/tools.ts using the now-tested strict DTOs, current backend permissions/owner policy, revisions/retry helpers and delete scopes as applicable. Route browser calls to the same service; preserve transaction rollback and existing side effects. No distinct MCP quota policy.
- [x] T289 [US2] [TDD] Run list_playlists cases and its exact BDD examples to Green; refactor only this verb while passing. Store slice evidence in specs/003-mcp-support/tdd/cycle-log.md and test-traceability.md; aggregate artifact becomes Green only when all its required cases have run.

### get_playlist — focused outer Red/Green cycle

- [x] T083 [US2] [TDD] Add TDD-US2-009 in test/mcp/integration/resource-operations.test.ts: Given an eligible creator has consent and current permission for read playlist; the client performs read playlist; assert the correct result and resulting state are visible to the creator in the dashboard. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, SC-002, US2. This task begins the dedicated get_playlist cycle; add only this operation’s public cases now.
- [x] T290 [US2] [TDD] Extend applicable existing TDD inventory artifacts for get_playlist: TDD-US2-040 pagination/redaction, in test/mcp/integration/resource-operations.test.ts, test/mcp/integration/retries.test.ts and test/mcp/integration/revisions.test.ts as applicable. Add the actual per-verb negative/boundary cases before the adapter is implemented; do not duplicate artifacts or mark partially covered IDs Green.
- [x] T291 [US2] [BDD] Materialize BDD-US2-009 and only its applicable validation, retry, revision, redaction and delete-scope examples from the complete catalogue in test/bdd/features/mcp-support/get_playlist.feature; bind them in test/bdd/steps/mcp-support.steps.ts. Preserve stable scenario/example identity when collecting subsets; for shared outlines use one canonical feature per scenario and append ready example rows, never duplicate scenario IDs across features.
- [x] T292 [US2] [TDD] Run the new get_playlist Jest file cases and nonempty generated BDD selection via bunx bddgen/Playwright; verify intended unsupported behavior Red in specs/003-mcp-support/tdd/cycle-log.md. Setup/missing-step failure is not Red.
- [x] T293 [US2] Implement only get_playlist in src/server/resources/playlists.ts and src/server/mcp/tools.ts using the now-tested strict DTOs, current backend permissions/owner policy, revisions/retry helpers and delete scopes as applicable. Route browser calls to the same service; preserve transaction rollback and existing side effects. No distinct MCP quota policy.
- [x] T294 [US2] [TDD] Run get_playlist cases and its exact BDD examples to Green; refactor only this verb while passing. Store slice evidence in specs/003-mcp-support/tdd/cycle-log.md and test-traceability.md; aggregate artifact becomes Green only when all its required cases have run.

### create_playlist — focused outer Red/Green cycle

- [x] T084 [US2] [TDD] Add TDD-US2-010 in test/mcp/integration/resource-operations.test.ts: Given an eligible creator has consent and current permission for create playlist; the client performs create playlist; assert the correct result and resulting state are visible to the creator in the dashboard. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, SC-002, US2. This task begins the dedicated create_playlist cycle; add only this operation’s public cases now.
- [x] T296 [US2] [BDD] Materialize BDD-US2-010 and only its applicable validation, retry, revision, redaction and delete-scope examples from the complete catalogue in test/bdd/features/mcp-support/create_playlist.feature; bind them in test/bdd/steps/mcp-support.steps.ts. Preserve stable scenario/example identity when collecting subsets; for shared outlines use one canonical feature per scenario and append ready example rows, never duplicate scenario IDs across features.
- [x] T298 [US2] Implement only create_playlist in src/server/resources/playlists.ts and src/server/mcp/tools.ts using the now-tested strict DTOs, current backend permissions/owner policy, revisions/retry helpers and delete scopes as applicable. Route browser calls to the same service; preserve transaction rollback and existing side effects. No distinct MCP quota policy.
- [x] T299 [US2] [TDD] Run create_playlist cases and its exact BDD examples to Green; refactor only this verb while passing. Store slice evidence in specs/003-mcp-support/tdd/cycle-log.md and test-traceability.md; aggregate artifact becomes Green only when all its required cases have run.

### update_playlist — focused outer Red/Green cycle

- [x] T085 [US2] [TDD] Add TDD-US2-011 in test/mcp/integration/resource-operations.test.ts: Given an eligible creator has consent and current permission for update playlist; the client performs update playlist; assert the correct result and resulting state are visible to the creator in the dashboard. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, SC-002, US2. This task begins the dedicated update_playlist cycle; add only this operation’s public cases now.
- [x] T301 [US2] [BDD] Materialize BDD-US2-011 and only its applicable validation, retry, revision, redaction and delete-scope examples from the complete catalogue in test/bdd/features/mcp-support/update_playlist.feature; bind them in test/bdd/steps/mcp-support.steps.ts. Preserve stable scenario/example identity when collecting subsets; for shared outlines use one canonical feature per scenario and append ready example rows, never duplicate scenario IDs across features.
- [x] T302 [US2] [TDD] Run the new update_playlist Jest file cases and nonempty generated BDD selection via bunx bddgen/Playwright; verify intended unsupported behavior Red in specs/003-mcp-support/tdd/cycle-log.md. Setup/missing-step failure is not Red.
- [x] T303 [US2] Implement only update_playlist in src/server/resources/playlists.ts and src/server/mcp/tools.ts using the now-tested strict DTOs, current backend permissions/owner policy, revisions/retry helpers and delete scopes as applicable. Route browser calls to the same service; preserve transaction rollback and existing side effects. No distinct MCP quota policy.
- [x] T304 [US2] [TDD] Run update_playlist cases and its exact BDD examples to Green; refactor only this verb while passing. Store slice evidence in specs/003-mcp-support/tdd/cycle-log.md and test-traceability.md; aggregate artifact becomes Green only when all its required cases have run.

### delete_playlist — focused outer Red/Green cycle

- [x] T086 [US2] [TDD] Add TDD-US2-012 in test/mcp/integration/resource-operations.test.ts: Given an eligible creator has consent and current permission for delete playlist; the client performs delete playlist; assert the correct result and resulting state are visible to the creator in the dashboard. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, SC-002, US2. This task begins the dedicated delete_playlist cycle; add only this operation’s public cases now.
- [x] T306 [US2] [BDD] Materialize BDD-US2-012 and only its applicable validation, retry, revision, redaction and delete-scope examples from the complete catalogue in test/bdd/features/mcp-support/delete_playlist.feature; bind them in test/bdd/steps/mcp-support.steps.ts. Preserve stable scenario/example identity when collecting subsets; for shared outlines use one canonical feature per scenario and append ready example rows, never duplicate scenario IDs across features.
- [x] T307 [US2] [TDD] Run the new delete_playlist Jest file cases and nonempty generated BDD selection via bunx bddgen/Playwright; verify intended unsupported behavior Red in specs/003-mcp-support/tdd/cycle-log.md. Setup/missing-step failure is not Red.
- [x] T308 [US2] Implement only delete_playlist in src/server/resources/playlists.ts and src/server/mcp/tools.ts using the now-tested strict DTOs, current backend permissions/owner policy, revisions/retry helpers and delete scopes as applicable. Route browser calls to the same service; preserve transaction rollback and existing side effects. No distinct MCP quota policy.
- [x] T309 [US2] [TDD] Run delete_playlist cases and its exact BDD examples to Green; refactor only this verb while passing. Store slice evidence in specs/003-mcp-support/tdd/cycle-log.md and test-traceability.md; aggregate artifact becomes Green only when all its required cases have run.

### add_playlist_items — focused outer Red/Green cycle

- [x] T087 [US2] [TDD] Add TDD-US2-013 in test/mcp/integration/resource-operations.test.ts: Given an eligible creator has consent and current permission for add playlist item; the client performs add playlist item; assert the correct result and resulting state are visible to the creator in the dashboard. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, SC-002, US2. This task begins the dedicated add_playlist_items cycle; add only this operation’s public cases now.
- [x] T311 [US2] [BDD] Materialize BDD-US2-013 and only its applicable validation, retry, revision, redaction and delete-scope examples from the complete catalogue in test/bdd/features/mcp-support/add_playlist_items.feature; bind them in test/bdd/steps/mcp-support.steps.ts. Preserve stable scenario/example identity when collecting subsets; for shared outlines use one canonical feature per scenario and append ready example rows, never duplicate scenario IDs across features.
- [x] T312 [US2] [TDD] Run the new add_playlist_items Jest file cases and nonempty generated BDD selection via bunx bddgen/Playwright; verify intended unsupported behavior Red in specs/003-mcp-support/tdd/cycle-log.md. Setup/missing-step failure is not Red.
- [x] T313 [US2] Implement only add_playlist_items in src/server/resources/playlists.ts and src/server/mcp/tools.ts using the now-tested strict DTOs, current backend permissions/owner policy, revisions/retry helpers and delete scopes as applicable. Route browser calls to the same service; preserve transaction rollback and existing side effects. No distinct MCP quota policy.
- [x] T314 [US2] [TDD] Run add_playlist_items cases and its exact BDD examples to Green; refactor only this verb while passing. Store slice evidence in specs/003-mcp-support/tdd/cycle-log.md and test-traceability.md; aggregate artifact becomes Green only when all its required cases have run.

### remove_playlist_items — focused outer Red/Green cycle

- [x] T088 [US2] [TDD] Add TDD-US2-014 in test/mcp/integration/resource-operations.test.ts: Given an eligible creator has consent and current permission for remove playlist item; the client performs remove playlist item; assert the correct result and resulting state are visible to the creator in the dashboard. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, SC-002, US2. This task begins the dedicated remove_playlist_items cycle; add only this operation’s public cases now.
- [x] T316 [US2] [BDD] Materialize BDD-US2-014 and only its applicable validation, retry, revision, redaction and delete-scope examples from the complete catalogue in test/bdd/features/mcp-support/remove_playlist_items.feature; bind them in test/bdd/steps/mcp-support.steps.ts. Preserve stable scenario/example identity when collecting subsets; for shared outlines use one canonical feature per scenario and append ready example rows, never duplicate scenario IDs across features.
- [x] T317 [US2] [TDD] Run the new remove_playlist_items Jest file cases and nonempty generated BDD selection via bunx bddgen/Playwright; verify intended unsupported behavior Red in specs/003-mcp-support/tdd/cycle-log.md. Setup/missing-step failure is not Red.
- [x] T318 [US2] Implement only remove_playlist_items in src/server/resources/playlists.ts and src/server/mcp/tools.ts using the now-tested strict DTOs, current backend permissions/owner policy, revisions/retry helpers and delete scopes as applicable. Route browser calls to the same service; preserve transaction rollback and existing side effects. No distinct MCP quota policy.
- [x] T319 [US2] [TDD] Run remove_playlist_items cases and its exact BDD examples to Green; refactor only this verb while passing. Store slice evidence in specs/003-mcp-support/tdd/cycle-log.md and test-traceability.md; aggregate artifact becomes Green only when all its required cases have run.

### reorder_playlist_items — focused outer Red/Green cycle

- [x] T089 [US2] [TDD] Add TDD-US2-015 in test/mcp/integration/resource-operations.test.ts: Given an eligible creator has consent and current permission for reorder playlist item; the client performs reorder playlist item; assert the correct result and resulting state are visible to the creator in the dashboard. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-007, SC-002, US2. This task begins the dedicated reorder_playlist_items cycle; add only this operation’s public cases now.
- [x] T321 [US2] [BDD] Materialize BDD-US2-015 and only its applicable validation, retry, revision, redaction and delete-scope examples from the complete catalogue in test/bdd/features/mcp-support/reorder_playlist_items.feature; bind them in test/bdd/steps/mcp-support.steps.ts. Preserve stable scenario/example identity when collecting subsets; for shared outlines use one canonical feature per scenario and append ready example rows, never duplicate scenario IDs across features.
- [x] T322 [US2] [TDD] Run the new reorder_playlist_items Jest file cases and nonempty generated BDD selection via bunx bddgen/Playwright; verify intended unsupported behavior Red in specs/003-mcp-support/tdd/cycle-log.md. Setup/missing-step failure is not Red.
- [x] T323 [US2] Implement only reorder_playlist_items in src/server/resources/playlists.ts and src/server/mcp/tools.ts using the now-tested strict DTOs, current backend permissions/owner policy, revisions/retry helpers and delete scopes as applicable. Route browser calls to the same service; preserve transaction rollback and existing side effects. No distinct MCP quota policy.
- [x] T324 [US2] [TDD] Run reorder_playlist_items cases and its exact BDD examples to Green; refactor only this verb while passing. Store slice evidence in specs/003-mcp-support/tdd/cycle-log.md and test-traceability.md; aggregate artifact becomes Green only when all its required cases have run.

### US2 quality/report review

- [x] T138 [US2] [GATE] Run all currently materialized story scenarios and affected Jest files, existing regression suites and applicable quality gates from specs/003-mcp-support/plan.md. Preserve fail-on-gen and nonempty discovery. Record slice results in specs/003-mcp-support/test-traceability.md; do not run or skip unmaterialized future cases, and do not declare full-story/release Green until its entire catalogue is executable. Final T249 runs all mandatory integrated gates.
- [x] T139 [US2] [GATE] Update final slice evidence and actual quality-gate results for US2 in specs/003-mcp-support/test-traceability.md; update specs/003-mcp-support/defect-log.md with investigation/closure or explicit risk decisions, and specs/003-mcp-support/test-summary.md with exact totals and outstanding cross-story host runs. Review story reports without falsely marking overall Go.

## Phase 5: User Story 3 — Preserve permissions and plan limits everywhere (P1)

**Independent test**: role/owner/agency intersections and all browser/MCP quota, lifecycle and conflict combinations pass with independent PostgreSQL connections.

### Story specification and registry

- [x] T140 [US3] [BDD] Review this story’s complete published scenario catalogue and examples in specs/003-mcp-support/spec.md before production coding. Materialize each runnable scenario/example under test/bdd/features/mcp-support/ only when its slice’s bindings are ready; retain one BDD owner and both evidence roles, with no approved sampling.
- [x] T141 [US3] [GATE] Record US3 scenario/test definitions, source relationships and all explicit example rows in specs/003-mcp-support/test-traceability.md; verify report links and Planned states in specs/003-mcp-support/defect-log.md and specs/003-mcp-support/test-summary.md before implementation.

### Current authorization intersection

- [x] T142 [US3] [TDD] Add TDD-US3-001 in test/mcp/integration/authorization-entitlements.test.ts: Given the client lacks the operation scope; the client attempts the affected operation; assert access is denied without revealing resource contents or changing state. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-007, FR-008, SC-004, US3.
- [x] T143 [US3] [TDD] Add TDD-US3-002 in test/mcp/integration/authorization-entitlements.test.ts: Given the team member lacks the operation permission; the client attempts the affected operation; assert access is denied without revealing resource contents or changing state. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-007, FR-008, SC-004, US3.
- [x] T144 [US3] [TDD] Add TDD-US3-003 in test/mcp/integration/authorization-entitlements.test.ts: Given the resource belongs to an unapproved creator; the client attempts the affected operation; assert access is denied without revealing resource contents or changing state. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-007, FR-008, SC-004, US3.
- [x] T145 [US3] [TDD] Add TDD-US3-004 in test/mcp/integration/authorization-entitlements.test.ts: Given the agency role exceeds the creator permission ceiling; the client attempts the affected operation; assert access is denied without revealing resource contents or changing state. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-007, FR-008, SC-004, US3.
- [x] T146 [US3] [TDD] Add TDD-US3-005 in test/mcp/integration/authorization-entitlements.test.ts: Given the caller supplies a forged creator identity; the client attempts the affected operation; assert access is denied without revealing resource contents or changing state. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-007, FR-008, SC-004, US3.
- [x] T147 [US3] [TDD] Add TDD-US3-053 in test/mcp/integration/authorization-entitlements.test.ts: Permission intersection for owner, direct team, and agency roles; resource owner mismatch and inactive link deny access; malformed or missing selected context denies access. Initial Red: Missing invariant or incorrect boundary assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-007, FR-008, US3.
- [x] T148 [US3] [BDD] Bind BDD-US3-001, BDD-US3-002, BDD-US3-003, BDD-US3-004, BDD-US3-005 in test/bdd/steps/mcp-support.steps.ts using test/bdd/support/mcp-support.ts; execute all listed examples through the highest verified real entry point. Keep distinct messages/interfaces separate and use the BDD owner for both evidence roles. Full BDD-US1-021 host mutation runs are dependent on US2/US3/US4.
- [x] T149 [US3] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T150 [US3] Complete src/auth/authorize-operation.ts and src/auth/mcp-principal.ts explicit verified identity intersection: grant/scopes, current owner/direct/agency roles/link ceiling, lifecycle, creator set and resource ownership. No implicit next/headers in shared services and no authority from arbitrary creator IDs or clientInfo. Provide transaction-aware checks and safe denial; preserve existing nondelegable behavior. Proceed only after the immediately preceding slice Red checkpoint; edit schema sources only, never generated drizzle/ files.
- [x] T151 [US3] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T152 [US3] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### Shared backend commercial rules

- [x] T153 [US3] [TDD] Add TDD-US3-006 in test/mcp/integration/authorization-entitlements.test.ts: Given a Free creator already has one overlay; the browser requests another overlay; assert a plan-limit error reports usage and limit and no overlay is created. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-008, FR-009, US3.
- [x] T154 [US3] [TDD] Add TDD-US3-007 in test/mcp/integration/authorization-entitlements.test.ts: Given a Free creator lacks paid-feature access; the browser attempts paid overlay settings; assert the paid-feature change is rejected and saved settings are preserved. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-009, FR-009, US3.
- [x] T155 [US3] [TDD] Add TDD-US3-008 in test/mcp/integration/authorization-entitlements.test.ts: Given a creator has effective Pro access through a subscription; the browser creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-009, US3.
- [x] T156 [US3] [TDD] Add TDD-US3-009 in test/mcp/integration/authorization-entitlements.test.ts: Given a creator has effective Pro access through a trial; the browser creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-009, US3.
- [x] T157 [US3] [TDD] Add TDD-US3-010 in test/mcp/integration/authorization-entitlements.test.ts: Given a creator has effective Pro access through a grant; the browser creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-009, US3.
- [x] T158 [US3] [TDD] Add TDD-US3-011 in test/mcp/integration/authorization-entitlements.test.ts: Given a creator has effective Pro access through a agency allocation; the browser creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-009, US3.
- [x] T159 [US3] [TDD] Add TDD-US3-012 in test/mcp/integration/authorization-entitlements.test.ts: Given a downgraded creator retains multiple overlay resources; the browser reads a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-010, FR-009, US3.
- [x] T160 [US3] [TDD] Add TDD-US3-013 in test/mcp/integration/authorization-entitlements.test.ts: Given a downgraded creator retains multiple overlay resources; the browser updates a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-010, FR-009, US3.
- [x] T161 [US3] [TDD] Add TDD-US3-014 in test/mcp/integration/authorization-entitlements.test.ts: Given a downgraded creator retains multiple overlay resources; the browser runs a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-010, FR-009, US3.
- [x] T162 [US3] [TDD] Add TDD-US3-015 in test/mcp/integration/authorization-entitlements.test.ts: Given a downgraded creator retains multiple playlist resources; the browser reads a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-010, FR-009, US3.
- [x] T163 [US3] [TDD] Add TDD-US3-016 in test/mcp/integration/authorization-entitlements.test.ts: Given a downgraded creator retains multiple playlist resources; the browser updates a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-010, FR-009, US3.
- [x] T164 [US3] [TDD] Add TDD-US3-017 in test/mcp/integration/authorization-entitlements.test.ts: Given a downgraded creator retains multiple playlist resources; the browser runs a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-010, FR-009, US3.
- [x] T165 [US3] [TDD] Add TDD-US3-018 in test/mcp/integration/authorization-entitlements.test.ts: Given a Free creator already has one overlay; the MCP requests another overlay; assert a plan-limit error reports usage and limit and no overlay is created. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-008, FR-009, US3.
- [x] T166 [US3] [TDD] Add TDD-US3-019 in test/mcp/integration/authorization-entitlements.test.ts: Given a Free creator lacks paid-feature access; the MCP attempts paid overlay settings; assert the paid-feature change is rejected and saved settings are preserved. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-009, FR-009, US3.
- [x] T167 [US3] [TDD] Add TDD-US3-020 in test/mcp/integration/authorization-entitlements.test.ts: Given a creator has effective Pro access through a subscription; the MCP creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-009, US3.
- [x] T168 [US3] [TDD] Add TDD-US3-021 in test/mcp/integration/authorization-entitlements.test.ts: Given a creator has effective Pro access through a trial; the MCP creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-009, US3.
- [x] T169 [US3] [TDD] Add TDD-US3-022 in test/mcp/integration/authorization-entitlements.test.ts: Given a creator has effective Pro access through a grant; the MCP creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-009, US3.
- [x] T170 [US3] [TDD] Add TDD-US3-023 in test/mcp/integration/authorization-entitlements.test.ts: Given a creator has effective Pro access through a agency allocation; the MCP creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-009, US3.
- [x] T171 [US3] [TDD] Add TDD-US3-024 in test/mcp/integration/authorization-entitlements.test.ts: Given a downgraded creator retains multiple overlay resources; the MCP reads a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-010, FR-009, US3.
- [x] T172 [US3] [TDD] Add TDD-US3-025 in test/mcp/integration/authorization-entitlements.test.ts: Given a downgraded creator retains multiple overlay resources; the MCP updates a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-010, FR-009, US3.
- [x] T173 [US3] [TDD] Add TDD-US3-026 in test/mcp/integration/authorization-entitlements.test.ts: Given a downgraded creator retains multiple overlay resources; the MCP runs a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-010, FR-009, US3.
- [x] T174 [US3] [TDD] Add TDD-US3-027 in test/mcp/integration/authorization-entitlements.test.ts: Given a downgraded creator retains multiple playlist resources; the MCP reads a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-010, FR-009, US3.
- [x] T175 [US3] [TDD] Add TDD-US3-028 in test/mcp/integration/authorization-entitlements.test.ts: Given a downgraded creator retains multiple playlist resources; the MCP updates a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-010, FR-009, US3.
- [x] T176 [US3] [TDD] Add TDD-US3-029 in test/mcp/integration/authorization-entitlements.test.ts: Given a downgraded creator retains multiple playlist resources; the MCP runs a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-010, FR-009, US3.
- [x] T177 [US3] [TDD] Add TDD-US3-051 in test/mcp/integration/authorization-entitlements.test.ts: Quota boundary at zero, one below, exactly at, and above current limit; lock isolation by creator; failed insert releases reservation; simultaneous delete and create preserve invariant. Initial Red: Missing invariant or incorrect boundary assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-011, FR-009, FR-010, US3.
- [x] T178 [US3] [TDD] Add TDD-US3-052 in test/mcp/integration/authorization-entitlements.test.ts: Resolve active and expired subscription/trial/grant/allocation boundaries; creator entitlement overrides actor entitlement; Free runtime and retained-resource eligibility match existing policy. Initial Red: Missing invariant or incorrect boundary assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-012, FR-009, FR-011, US3.
- [x] T179 [US3] [BDD] Bind BDD-US3-006, BDD-US3-007, BDD-US3-008, BDD-US3-009, BDD-US3-010, BDD-US3-011, BDD-US3-012, BDD-US3-013, BDD-US3-014, BDD-US3-015, BDD-US3-016, BDD-US3-017, BDD-US3-018, BDD-US3-019, BDD-US3-020, BDD-US3-021, BDD-US3-022, BDD-US3-023, BDD-US3-024, BDD-US3-025, BDD-US3-026, BDD-US3-027, BDD-US3-028, BDD-US3-029 in test/bdd/steps/mcp-support.steps.ts using test/bdd/support/mcp-support.ts; execute all listed examples through the highest verified real entry point. Keep distinct messages/interfaces separate and use the BDD owner for both evidence roles. Full BDD-US1-021 host mutation runs are dependent on US2/US3/US4.
- [x] T180 [US3] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T181 [US3] Implement shared owner entitlement/resource policy in src/server/resources/quota.ts, src/server/resources/overlays.ts and src/server/resources/playlists.ts; route browser and every copy/import/gallery-related playlist writer via these services. Free has one overlay/playlist per existing policy, Pro is effective from subscription/trial/grant/agency allocation, and retained-resource update/runtime normalization uses existing authoritative policy. Reject paid settings without overwriting saved Pro config. Proceed only after the immediately preceding slice Red checkpoint; edit schema sources only, never generated drizzle/ files.
- [x] T182 [US3] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T183 [US3] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### Independent PostgreSQL quota races

- [x] T184 [US3] [TDD] Add TDD-US3-030 in test/mcp/integration/authorization-entitlements.test.ts: Given an empty Free creator has no active qualifying entitlement; twenty all browser creation requests execute concurrently; assert exactly one overlay exists and nineteen requests receive plan-limit errors. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-011, FR-010, SC-003, US3.
- [x] T185 [US3] [TDD] Add TDD-US3-031 in test/mcp/integration/authorization-entitlements.test.ts: Given an empty Free creator has no active qualifying entitlement; twenty all MCP creation requests execute concurrently; assert exactly one overlay exists and nineteen requests receive plan-limit errors. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-011, FR-010, SC-003, US3.
- [x] T186 [US3] [TDD] Add TDD-US3-032 in test/mcp/integration/authorization-entitlements.test.ts: Given an empty Free creator has no active qualifying entitlement; twenty ten browser and ten MCP creation requests execute concurrently; assert exactly one overlay exists and nineteen requests receive plan-limit errors. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-011, FR-010, SC-003, US3.
- [x] T187 [US3] [TDD] Add TDD-US3-056 in test/mcp/integration/authorization-entitlements.test.ts: Real PostgreSQL multi-connection quota and revision tests, independent of PGlite serialization; 20 requests without rate-limit interference; verify unrelated creators progress independently. Initial Red: Missing security boundary or contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-011, FR-010, US3.
- [x] T188 [US3] [BDD] Bind BDD-US3-030, BDD-US3-031, BDD-US3-032 in test/bdd/steps/mcp-support.steps.ts using test/bdd/support/mcp-support.ts; execute all listed examples through the highest verified real entry point. Keep distinct messages/interfaces separate and use the BDD owner for both evidence roles. Full BDD-US1-021 host mutation runs are dependent on US2/US3/US4.
- [x] T189 [US3] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T190 [US3] Serialize quota transactions on stable creator-account row in src/server/resources/quota.ts. Lock order grant→creator→playlist→overlays by ID; resolve entitlements/count/write in transaction, lock parent playlist for item quotas/order and coordinate deletion/reconciliation/entitlement writers. No process-local quota mutex. Wire real PostgreSQL races through test/bdd/support/mcp-support.ts and .github/workflows/ci.yml existing guarded loopback browser-tests job; do not bypass migration guards. Proceed only after the immediately preceding slice Red checkpoint; edit schema sources only, never generated drizzle/ files.
- [x] T191 [US3] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T192 [US3] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### Live entitlement and membership transitions

- [x] T193 [US3] [TDD] Add TDD-US3-033 in test/mcp/integration/authorization-entitlements.test.ts: Given a client has connected before a creator’s upgrade; the change occurs and the client makes its next mutation; assert current permissions, lifecycle, and entitlements determine the result without reconnecting. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-012, FR-011, SC-004, US3.
- [x] T194 [US3] [TDD] Add TDD-US3-034 in test/mcp/integration/authorization-entitlements.test.ts: Given a client has connected before a creator’s downgrade; the change occurs and the client makes its next mutation; assert current permissions, lifecycle, and entitlements determine the result without reconnecting. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-012, FR-011, SC-004, US3.
- [x] T195 [US3] [TDD] Add TDD-US3-035 in test/mcp/integration/authorization-entitlements.test.ts: Given a client has connected before a creator’s trial expiry; the change occurs and the client makes its next mutation; assert current permissions, lifecycle, and entitlements determine the result without reconnecting. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-012, FR-011, SC-004, US3.
- [x] T196 [US3] [TDD] Add TDD-US3-036 in test/mcp/integration/authorization-entitlements.test.ts: Given a client has connected before a creator’s grant expiry; the change occurs and the client makes its next mutation; assert current permissions, lifecycle, and entitlements determine the result without reconnecting. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-012, FR-011, SC-004, US3.
- [x] T197 [US3] [TDD] Add TDD-US3-037 in test/mcp/integration/authorization-entitlements.test.ts: Given a client has connected before a creator’s team removal; the change occurs and the client makes its next mutation; assert current permissions, lifecycle, and entitlements determine the result without reconnecting. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-012, FR-011, SC-004, US3.
- [x] T198 [US3] [TDD] Add TDD-US3-038 in test/mcp/integration/authorization-entitlements.test.ts: Given a client has connected before a creator’s agency unlinking; the change occurs and the client makes its next mutation; assert current permissions, lifecycle, and entitlements determine the result without reconnecting. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-012, FR-011, SC-004, US3.
- [x] T199 [US3] [TDD] Add TDD-US3-039 in test/mcp/integration/authorization-entitlements.test.ts: Given a client has connected before a creator’s account suspension; the change occurs and the client makes its next mutation; assert current permissions, lifecycle, and entitlements determine the result without reconnecting. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-012, FR-011, SC-004, US3.
- [x] T200 [US3] [BDD] Bind BDD-US3-033, BDD-US3-034, BDD-US3-035, BDD-US3-036, BDD-US3-037, BDD-US3-038, BDD-US3-039 in test/bdd/steps/mcp-support.steps.ts using test/bdd/support/mcp-support.ts; execute all listed examples through the highest verified real entry point. Keep distinct messages/interfaces separate and use the BDD owner for both evidence roles. Full BDD-US1-021 host mutation runs are dependent on US2/US3/US4.
- [x] T201 [US3] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T202 [US3] Make subsequent calls/mutations re-resolve committed state in src/server/mcp/grants.ts and src/server/resources/quota.ts; coordinate grant/creator locks with revoke, downgrade, entitlement reconciliation and allocation writers. Cover upgrade/downgrade/trial/grant expiry, team removal, agency unlinking and suspension without reconnecting. Old token creator sets never expand from newly acquired membership. Proceed only after the immediately preceding slice Red checkpoint; edit schema sources only, never generated drizzle/ files.
- [x] T203 [US3] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T204 [US3] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.
- [x] T205 [US3] [TDD] Add TDD-US3-040 in test/mcp/integration/authorization-entitlements.test.ts: Given a requested resource is absent or inaccessible; the client requests it; assert a safe unavailable-resource error reveals no private existence or contents. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-016, FR-014, US3.
- [x] T206 [US3] [TDD] Add TDD-US3-041 in test/mcp/integration/authorization-entitlements.test.ts: Given a persistence failure occurs during a mutation; the client receives the outcome; assert a service-failure error appears without false success or partial resource changes. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-017, FR-014, US3.

### Safe errors and rollback boundaries

- [x] T207 [US3] [TDD] Add TDD-US3-042 in test/mcp/integration/authorization-entitlements.test.ts: Given a dependent-service timeout occurs during a mutation; the client receives the outcome; assert a service-failure error appears without false success or partial resource changes. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-017, FR-014, US3.
- [x] T208 [US3] [TDD] Add TDD-US3-054 in test/mcp/integration/authorization-entitlements.test.ts: Map each documented error source to the correct public error; redact identifiers and private exception contents; prevent success replies after rollback. Initial Red: Missing invariant or incorrect boundary assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-016, EC-017, FR-014, US3.
- [x] T209 [US3] [BDD] Bind BDD-US3-040, BDD-US3-041, BDD-US3-042 in test/bdd/steps/mcp-support.steps.ts using test/bdd/support/mcp-support.ts; execute all listed examples through the highest verified real entry point. Keep distinct messages/interfaces separate and use the BDD owner for both evidence roles. Full BDD-US1-021 host mutation runs are dependent on US2/US3/US4.
- [x] T210 [US3] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T211 [US3] Implement src/server/resources/errors.ts and src/server/mcp/errors.ts mappings for 401 auth, 403 missing scope, access denial, identical missing/inaccessible RESOURCE_UNAVAILABLE, PLAN_LIMIT_REACHED usage/limit, FEATURE_RESTRICTED, INVALID_INPUT, CONFLICT, RETRY_CONFLICT, RATE_LIMITED and SERVICE_UNAVAILABLE. Keep safe correlation ID and no raw SQL/private existence. Browser adapters preserve actionable conflict/limit feedback; external timeouts 10 seconds, cancellation/rollback release work without false success. Proceed only after the immediately preceding slice Red checkpoint; edit schema sources only, never generated drizzle/ files.
- [x] T212 [US3] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T213 [US3] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### US3 quality/report review

- [x] T214 [US3] [GATE] Run all currently materialized story scenarios and affected Jest files, existing regression suites and applicable quality gates from specs/003-mcp-support/plan.md. Preserve fail-on-gen and nonempty discovery. Record slice results in specs/003-mcp-support/test-traceability.md; do not run or skip unmaterialized future cases, and do not declare full-story/release Green until its entire catalogue is executable. Final T249 runs all mandatory integrated gates.
- [x] T215 [US3] [GATE] Update final slice evidence and actual quality-gate results for US3 in specs/003-mcp-support/test-traceability.md; update specs/003-mcp-support/defect-log.md with investigation/closure or explicit risk decisions, and specs/003-mcp-support/test-summary.md with exact totals and outstanding cross-story host runs. Review story reports without falsely marking overall Go.

## Phase 6: User Story 4 — Activity and throttling (P2)

**Independent test**: distributed budgets, retry guidance and authorized redacted activity without cross-creator leaks.

### Story specification and registry

- [x] T216 [US4] [BDD] Review this story’s complete published scenario catalogue and examples in specs/003-mcp-support/spec.md before production coding. Materialize each runnable scenario/example under test/bdd/features/mcp-support/ only when its slice’s bindings are ready; retain one BDD owner and both evidence roles, with no approved sampling.
- [x] T217 [US4] [GATE] Record US4 scenario/test definitions, source relationships and all explicit example rows in specs/003-mcp-support/test-traceability.md; verify report links and Planned states in specs/003-mcp-support/defect-log.md and specs/003-mcp-support/test-summary.md before implementation.

### Distributed throttling and cleanup

- [x] T218 [US4] [TDD] Add TDD-US4-001 in test/mcp/integration/retries.test.ts: Given a registration caller exhausts its configured registration budget; it submits another registration; assert registration is throttled with retry guidance and no client record is created. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-018, FR-015, SC-005, US4.
- [x] T219 [US4] [TDD] Add TDD-US4-002 in test/mcp/integration/retries.test.ts: Given a client exhausts its configured tool-call budget; it attempts another mutation; assert the call is throttled with retry guidance and no business resource changes. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-019, FR-015, SC-005, US4.
- [x] T220 [US4] [TDD] Add TDD-US4-017 in test/mcp/integration/activity-rate-limits.test.ts: Rate budget at below, exactly at, and above threshold; reset boundary; isolate callers; coordinate across instances; unavailable limiter fails closed without creating records. Initial Red: Missing invariant or incorrect boundary assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-018, EC-019, FR-015, US4.
- [x] T221 [US4] [BDD] Bind BDD-US4-001, BDD-US4-002 in test/bdd/steps/mcp-support.steps.ts using test/bdd/support/mcp-support.ts; execute all listed examples through the highest verified real entry point. Keep distinct messages/interfaces separate and use the BDD owner for both evidence roles. Full BDD-US1-021 host mutation runs are dependent on US2/US3/US4.
- [x] T222 [US4] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T223 [US4] Reuse HMAC/database counters from src/auth/rate-limit.ts in src/server/mcp/rate-limit.ts for registration 10/min/network+100/day/network and calls 120/min/actor+client+600/min/network with configurable deployment budgets. Preserve provider CSRF/origin protection; fail closed if limiter missing. Retry-After and network/identity isolation work across instances. Expire never-consented registration records after 24 hours and expired retries/counters in bounded jobs. Proceed only after the immediately preceding slice Red checkpoint; edit schema sources only, never generated drizzle/ files.
- [x] T224 [US4] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T225 [US4] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### Durable redacted activity

- [x] T226 [US4] [TDD] Add TDD-US4-003 in test/mcp/integration/activity-rate-limits.test.ts: Given a connected client has successful and denied authenticated operations; an authorized user inspects activity; assert each entry identifies actor, client, creator, operation, time, and outcome without secrets or private payloads. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references FR-016, SC-005, US4.
- [x] T227 [US4] [TDD] Add TDD-US4-004 in test/mcp/integration/activity-rate-limits.test.ts: Given a user cannot access another creator’s activity; the user requests that activity; assert access is denied and the activity remains private. Initial Red: Missing behavior or incorrect contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-020, FR-016, US4.
- [x] T228 [US4] [TDD] Add TDD-US4-018 in test/mcp/integration/activity-rate-limits.test.ts: Activity redaction, chronological listing, pagination, cross-creator isolation, denied-call attribution, and durable recording; storage failure cannot silently lose required audit evidence. Initial Red: Missing invariant or incorrect boundary assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-020, FR-016, US4.
- [x] T229 [US4] [TDD] Add TDD-US4-019 in test/mcp/integration/retries.test.ts: Rate-limit dependency failure yields safe service error; audit transaction failure rolls back mutation; actor activity never reads denied target metadata; cleanup expires unconsented client registrations and retry records. Initial Red: Missing security boundary or contract assertion. Expand every enumerated implementation-level input/transition/boundary/error obligation into explicit cases; registry references EC-018, EC-019, FR-015, FR-016, US4.
- [x] T230 [US4] [BDD] Bind BDD-US4-003, BDD-US4-004 in test/bdd/steps/mcp-support.steps.ts using test/bdd/support/mcp-support.ts; execute all listed examples through the highest verified real entry point. Keep distinct messages/interfaces separate and use the BDD owner for both evidence roles. Full BDD-US1-021 host mutation runs are dependent on US2/US3/US4.
- [x] T231 [US4] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.
- [x] T232 [US4] Extend src/auth/audit.ts and src/server/mcp/activity.ts to persist successful and denied authenticated calls with actor/client/grant/approved creator/tool/time/outcome allowlist; never actorSessionId=grantId and never raw inputs/secrets/private payloads. Successful audit shares mutation transaction and failure rolls back. Account settings list/revoke user-owned clients; activity requires current creator/audit permission, pagination and existing privacy retention/deletion policy. Add accessible localized UI in src/app/dashboard/settings/connected-apps-panel.tsx. Proceed only after the immediately preceding slice Red checkpoint; edit schema sources only, never generated drizzle/ files.
- [x] T233 [US4] [TDD] Rerun this slice’s affected Jest files and exact BDD IDs/examples; confirm Green and persist command/SHA/output links once in specs/003-mcp-support/test-traceability.md and specs/003-mcp-support/tdd/cycle-log.md. Retain not-yet-available real-host examples as Planned/Blocked; never declare story acceptance from mocks.
- [x] T234 [US4] Refactor only this green slice’s auth/service/tool/UI boundaries, rerun its affected suites and preserve Green; record changes and any unexpected failures in specs/003-mcp-support/tdd/cycle-log.md and specs/003-mcp-support/defect-log.md. Do not alter unrelated published scenarios.

### US4 quality/report review

- [x] T235 [US4] [GATE] Run all currently materialized story scenarios and affected Jest files, existing regression suites and applicable quality gates from specs/003-mcp-support/plan.md. Preserve fail-on-gen and nonempty discovery. Record slice results in specs/003-mcp-support/test-traceability.md; do not run or skip unmaterialized future cases, and do not declare full-story/release Green until its entire catalogue is executable. Final T249 runs all mandatory integrated gates.
- [x] T236 [US4] [GATE] Update final slice evidence and actual quality-gate results for US4 in specs/003-mcp-support/test-traceability.md; update specs/003-mcp-support/defect-log.md with investigation/closure or explicit risk decisions, and specs/003-mcp-support/test-summary.md with exact totals and outstanding cross-story host runs. Review story reports without falsely marking overall Go.

## Phase 7: Integrated Validation and Rollout Readiness

### Cross-cutting test-first boundaries and final gates

- [x] T237 [TDD] Add meaningful failing tests (TDD-US4-021) in test/mcp/unit/coverage-gate.test.ts for missing feature source collection, uncovered file, threshold boundaries and incorrect coverage JSON; prove intended Red before scripts/check-mcp-coverage.mjs production gate code.
- [x] T238 Implement scripts/check-mcp-coverage.mjs and extend jest.config.js collection to changed auth/server/MCP/consent/connection sources. Enforce feature >=90% lines/statements/functions and >=85% branches; security/quota/revocation/revision >=95% lines and >=90% branches, while preserving baseline/global/gallery gates.
- [x] T239 [TDD] Run test/mcp/unit/coverage-gate.test.ts through Green and refactor the coverage checker while passing; run bun run test:coverage plus node scripts/check-mcp-coverage.mjs and record coverage files and gate results in specs/003-mcp-support/test-traceability.md.
- [x] T240 [TDD] Add failing rollout/config tests (TDD-US3-057) in test/mcp/contract/rollout.test.ts for disabled endpoint, missing schema readiness, unavailable required settings and conflicting issuer/resource values; verify Red before runtime rollout/config behavior.
- [x] T241 Implement schema-ready feature disablement and typed runtime settings in src/server/mcp/config.ts and src/app/mcp/route.ts; endpoint remains unavailable until configured and schema-ready. Coordinate browser revision rollout/old-tab reload in src/app/actions/database.ts without granting unconditional writes or bypassing schema migration policy.
- [x] T242 [TDD] Rerun test/mcp/contract/rollout.test.ts and affected real HTTP smoke to Green, then refactor while green; retain cycle evidence in specs/003-mcp-support/tdd/cycle-log.md.
- [x] T244 Implement bounded cancellation/cleanup and existing-privacy lifecycle integration in src/server/mcp/server.ts, src/server/mcp/retries.ts, src/server/mcp/activity.ts and existing job/privacy adapters; do not hold transaction locks across external calls.
- [x] T245 [TDD] Run test/mcp/integration/runtime-boundaries.test.ts and warmed 20-independent-creator BDD load fixture to Green; measure p95 reads <=1s/mutations <=2s excluding external latency and retain measurement settings/results in test-results/mcp/ and registry evidence.
- [x] T246 Update .github/workflows/ci.yml after tests/coverage gate are Green: run feature coverage enforcement, preserve guarded browser-tests loopback PostgreSQL setup, add nonempty generated-scenario checks and upload coverage/, test-results/, playwright-report/ and test-results/mcp/ on failure with explicit 30-day retention. Add no feature-generated migration files.
- [x] T248 [TDD] Execute recorded deliberate mutants for omitted scopes, wrong owner, missing online grant, unlocked quota and skipped revision comparison against test/mcp/; each must fail for the correct assertion, then restore and confirm Green. Retain output in test-results/mcp/mutants/; protect TDD test strength.
- [x] T250 [P] [GATE] Validate specs/003-mcp-support/quickstart.md against completed implementation, update connection examples and safe setup guidance; verify unsupported operations, risk hint limitations, grant expansion consent and migration rollout instructions match src/server/mcp/ contracts.
- [x] T251 [GATE] Review closed/open/deferred defects in specs/003-mcp-support/defect-log.md and final totals/coverage/host evidence in specs/003-mcp-support/test-summary.md. Require all mandatory evidence Green and no unaccepted blocking defects before Go; preserve explicit ownership/approval requirements and rolling convergence destination reports/test-summary.md.

## Dependencies & Execution Order

Setup → isolated foundation → provider schema/discovery → tested creator-read pilot → consent/token/read flow → revoke → resource primitives → each public verb → backend commercial/concurrency guarantees → activity/rate controls → full integrated release gates. MCP remains disabled by default until schema and all required rules/evidence are ready. No deployment is performed by task generation.

US1 reads are available through the tested pilot before their consent acceptance Green. US2 helper tests are completed before public mutation adapters; each verb adds its real-entry-point cases before production registration. Full named-host mutation journey waits until T247. No scenario ID exists twice in executable features, and future unbound scenarios stay in the complete spec catalogue rather than generated files.

## Parallel Opportunities

Only independent test files/fixtures may be edited in parallel after prerequisites are satisfied. Registry/schema/shared-binding edits serialize; Red, implementation and Green checkpoints never run in parallel. T250 documentation validation may run beside final evidence review after integrated checks.

| Story | Independent work when the slice is ready                                                          | Sequential boundary                                                       |
| ----- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| US1   | OAuth contract cases and consent component fixtures in test/mcp/contract/ and test/mcp/component/ | Consent/token/read flow and shared schemas                                |
| US2   | DTO unit cases and revision helper cases in separate test/mcp/ files                              | Public verb tests precede its adapter; shared registry/bindings serialize |
| US3   | Permission property cases and independent PostgreSQL fixture preparation                          | Quota locks and live transition writers                                   |
| US4   | Rate-counter tests and connection UI tests                                                        | Audit transaction and shared step definitions                             |

## Implementation Strategy

A connection-only custom-client demo follows US1. Full management requires US1–US3; the approved release additionally requires US4 and all four actual client hosts. Finish each focused verb before adding the next. Keep all unsupported or unconfigured MCP routes unavailable, preserve existing browser policy, and never use disabled-feature status as an exemption from test-first production changes.

## Artifact-to-Task Coverage

| Evidence artifact | Primary task | Story |
| ----------------- | ------------ | ----- |
| BDD-US1-001       | T016         | US1   |
| BDD-US1-002       | T016         | US1   |
| BDD-US1-003       | T016         | US1   |
| BDD-US1-004       | T025         | US1   |
| BDD-US1-005       | T025         | US1   |
| BDD-US1-006       | T047         | US1   |
| BDD-US1-007       | T047         | US1   |
| BDD-US1-008       | T047         | US1   |
| BDD-US1-009       | T047         | US1   |
| BDD-US1-010       | T047         | US1   |
| BDD-US1-011       | T047         | US1   |
| BDD-US1-012       | T047         | US1   |
| BDD-US1-013       | T047         | US1   |
| BDD-US1-014       | T047         | US1   |
| BDD-US1-015       | T047         | US1   |
| BDD-US1-016       | T047         | US1   |
| BDD-US1-017       | T047         | US1   |
| BDD-US1-018       | T047         | US1   |
| BDD-US1-019       | T047         | US1   |
| BDD-US1-020       | T054         | US1   |
| BDD-US1-021       | T061         | US1   |
| BDD-US1-022       | T025         | US1   |
| BDD-US1-023       | T025         | US1   |
| BDD-US1-024       | T061         | US1   |
| BDD-US2-001       | T072         | US2   |
| BDD-US2-002       | T072         | US2   |
| BDD-US2-003       | T092         | US2   |
| BDD-US2-004       | T092         | US2   |
| BDD-US2-005       | T092         | US2   |
| BDD-US2-006       | T092         | US2   |
| BDD-US2-007       | T092         | US2   |
| BDD-US2-008       | T092         | US2   |
| BDD-US2-009       | T092         | US2   |
| BDD-US2-010       | T092         | US2   |
| BDD-US2-011       | T092         | US2   |
| BDD-US2-012       | T092         | US2   |
| BDD-US2-013       | T092         | US2   |
| BDD-US2-014       | T092         | US2   |
| BDD-US2-015       | T092         | US2   |
| BDD-US2-016       | T107         | US2   |
| BDD-US2-017       | T107         | US2   |
| BDD-US2-018       | T107         | US2   |
| BDD-US2-019       | T107         | US2   |
| BDD-US2-020       | T107         | US2   |
| BDD-US2-021       | T107         | US2   |
| BDD-US2-022       | T107         | US2   |
| BDD-US2-023       | T121         | US2   |
| BDD-US2-024       | T121         | US2   |
| BDD-US2-025       | T121         | US2   |
| BDD-US2-026       | T121         | US2   |
| BDD-US2-027       | T121         | US2   |
| BDD-US2-028       | T121         | US2   |
| BDD-US2-029       | T121         | US2   |
| BDD-US2-030       | T127         | US2   |
| BDD-US2-031       | T127         | US2   |
| BDD-US2-032       | T133         | US2   |
| BDD-US3-001       | T148         | US3   |
| BDD-US3-002       | T148         | US3   |
| BDD-US3-003       | T148         | US3   |
| BDD-US3-004       | T148         | US3   |
| BDD-US3-005       | T148         | US3   |
| BDD-US3-006       | T179         | US3   |
| BDD-US3-007       | T179         | US3   |
| BDD-US3-008       | T179         | US3   |
| BDD-US3-009       | T179         | US3   |
| BDD-US3-010       | T179         | US3   |
| BDD-US3-011       | T179         | US3   |
| BDD-US3-012       | T179         | US3   |
| BDD-US3-013       | T179         | US3   |
| BDD-US3-014       | T179         | US3   |
| BDD-US3-015       | T179         | US3   |
| BDD-US3-016       | T179         | US3   |
| BDD-US3-017       | T179         | US3   |
| BDD-US3-018       | T179         | US3   |
| BDD-US3-019       | T179         | US3   |
| BDD-US3-020       | T179         | US3   |
| BDD-US3-021       | T179         | US3   |
| BDD-US3-022       | T179         | US3   |
| BDD-US3-023       | T179         | US3   |
| BDD-US3-024       | T179         | US3   |
| BDD-US3-025       | T179         | US3   |
| BDD-US3-026       | T179         | US3   |
| BDD-US3-027       | T179         | US3   |
| BDD-US3-028       | T179         | US3   |
| BDD-US3-029       | T179         | US3   |
| BDD-US3-030       | T188         | US3   |
| BDD-US3-031       | T188         | US3   |
| BDD-US3-032       | T188         | US3   |
| BDD-US3-033       | T200         | US3   |
| BDD-US3-034       | T200         | US3   |
| BDD-US3-035       | T200         | US3   |
| BDD-US3-036       | T200         | US3   |
| BDD-US3-037       | T200         | US3   |
| BDD-US3-038       | T200         | US3   |
| BDD-US3-039       | T200         | US3   |
| BDD-US3-040       | T209         | US3   |
| BDD-US3-041       | T209         | US3   |
| BDD-US3-042       | T209         | US3   |
| BDD-US4-001       | T221         | US4   |
| BDD-US4-002       | T221         | US4   |
| BDD-US4-003       | T230         | US4   |
| BDD-US4-004       | T230         | US4   |
| TDD-US1-001       | T012         | US1   |
| TDD-US1-002       | T013         | US1   |
| TDD-US1-003       | T014         | US1   |
| TDD-US1-004       | T021         | US1   |
| TDD-US1-005       | T022         | US1   |
| TDD-US1-006       | T030         | US1   |
| TDD-US1-007       | T031         | US1   |
| TDD-US1-008       | T032         | US1   |
| TDD-US1-009       | T033         | US1   |
| TDD-US1-010       | T034         | US1   |
| TDD-US1-011       | T035         | US1   |
| TDD-US1-012       | T036         | US1   |
| TDD-US1-013       | T037         | US1   |
| TDD-US1-014       | T038         | US1   |
| TDD-US1-015       | T039         | US1   |
| TDD-US1-016       | T040         | US1   |
| TDD-US1-017       | T041         | US1   |
| TDD-US1-018       | T042         | US1   |
| TDD-US1-019       | T043         | US1   |
| TDD-US1-020       | T052         | US1   |
| TDD-US1-021       | T044         | US1   |
| TDD-US1-022       | T045         | US1   |
| TDD-US1-023       | T046         | US1   |
| TDD-US1-024       | T053         | US1   |
| TDD-US1-025       | T059         | US1   |
| TDD-US1-026       | T023         | US1   |
| TDD-US1-027       | T060         | US1   |
| TDD-US1-028       | T015         | US1   |
| TDD-US1-029       | T024         | US1   |
| TDD-US1-030       | T252         | US1   |
| TDD-US1-031       | T256         | US1   |
| TDD-US2-001       | T070         | US2   |
| TDD-US2-002       | T071         | US2   |
| TDD-US2-003       | T077         | US2   |
| TDD-US2-004       | T078         | US2   |
| TDD-US2-005       | T079         | US2   |
| TDD-US2-006       | T080         | US2   |
| TDD-US2-007       | T081         | US2   |
| TDD-US2-008       | T082         | US2   |
| TDD-US2-009       | T083         | US2   |
| TDD-US2-010       | T084         | US2   |
| TDD-US2-011       | T085         | US2   |
| TDD-US2-012       | T086         | US2   |
| TDD-US2-013       | T087         | US2   |
| TDD-US2-014       | T088         | US2   |
| TDD-US2-015       | T089         | US2   |
| TDD-US2-016       | T098         | US2   |
| TDD-US2-017       | T099         | US2   |
| TDD-US2-018       | T100         | US2   |
| TDD-US2-019       | T101         | US2   |
| TDD-US2-020       | T102         | US2   |
| TDD-US2-021       | T103         | US2   |
| TDD-US2-022       | T104         | US2   |
| TDD-US2-023       | T112         | US2   |
| TDD-US2-024       | T113         | US2   |
| TDD-US2-025       | T114         | US2   |
| TDD-US2-026       | T115         | US2   |
| TDD-US2-027       | T116         | US2   |
| TDD-US2-028       | T117         | US2   |
| TDD-US2-029       | T118         | US2   |
| TDD-US2-034       | T090         | US2   |
| TDD-US2-035       | T105         | US2   |
| TDD-US2-036       | T119         | US2   |
| TDD-US2-037       | T120         | US2   |
| TDD-US2-038       | T126         | US2   |
| TDD-US2-039       | T132         | US2   |
| TDD-US2-040       | T091         | US2   |
| TDD-US2-041       | T106         | US2   |
| TDD-US3-001       | T142         | US3   |
| TDD-US3-002       | T143         | US3   |
| TDD-US3-003       | T144         | US3   |
| TDD-US3-004       | T145         | US3   |
| TDD-US3-005       | T146         | US3   |
| TDD-US3-006       | T153         | US3   |
| TDD-US3-007       | T154         | US3   |
| TDD-US3-008       | T155         | US3   |
| TDD-US3-009       | T156         | US3   |
| TDD-US3-010       | T157         | US3   |
| TDD-US3-011       | T158         | US3   |
| TDD-US3-012       | T159         | US3   |
| TDD-US3-013       | T160         | US3   |
| TDD-US3-014       | T161         | US3   |
| TDD-US3-015       | T162         | US3   |
| TDD-US3-016       | T163         | US3   |
| TDD-US3-017       | T164         | US3   |
| TDD-US3-018       | T165         | US3   |
| TDD-US3-019       | T166         | US3   |
| TDD-US3-020       | T167         | US3   |
| TDD-US3-021       | T168         | US3   |
| TDD-US3-022       | T169         | US3   |
| TDD-US3-023       | T170         | US3   |
| TDD-US3-024       | T171         | US3   |
| TDD-US3-025       | T172         | US3   |
| TDD-US3-026       | T173         | US3   |
| TDD-US3-027       | T174         | US3   |
| TDD-US3-028       | T175         | US3   |
| TDD-US3-029       | T176         | US3   |
| TDD-US3-030       | T184         | US3   |
| TDD-US3-031       | T185         | US3   |
| TDD-US3-032       | T186         | US3   |
| TDD-US3-033       | T193         | US3   |
| TDD-US3-034       | T194         | US3   |
| TDD-US3-035       | T195         | US3   |
| TDD-US3-036       | T196         | US3   |
| TDD-US3-037       | T197         | US3   |
| TDD-US3-038       | T198         | US3   |
| TDD-US3-039       | T199         | US3   |
| TDD-US3-040       | T205         | US3   |
| TDD-US3-041       | T206         | US3   |
| TDD-US3-042       | T207         | US3   |
| TDD-US3-051       | T177         | US3   |
| TDD-US3-052       | T178         | US3   |
| TDD-US3-053       | T147         | US3   |
| TDD-US3-054       | T208         | US3   |
| TDD-US3-056       | T187         | US3   |
| TDD-US3-057       | T240         | US3   |
| TDD-US4-001       | T218         | US4   |
| TDD-US4-002       | T219         | US4   |
| TDD-US4-003       | T226         | US4   |
| TDD-US4-004       | T227         | US4   |
| TDD-US4-017       | T220         | US4   |
| TDD-US4-018       | T228         | US4   |
| TDD-US4-019       | T229         | US4   |
| TDD-US4-020       | T243         | US4   |
| TDD-US4-021       | T237         | US4   |

Primary tasks define inventory artifacts; per-verb follow-up tasks add explicitly named remaining cases to those same artifacts rather than making duplicate suite copies. Executed-case coverage and final whole-artifact status are recorded in traceability, not inferred from one passing helper.

## Remediation Closure

| Finding | Correction                                                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| C1      | Consent tests moved before implementation; helper/verb cycles put revision, retry, validation and scope cases before public writes. |
| C2      | Complete spec catalogue is distinct from incrementally materialized bound features; fail-on-gen preserved.                          |
| C3      | EC-021 references the actual revision artifact.                                                                                     |
| C4      | Gate regex pipes escaped and normalized table row restored.                                                                         |
| C5      | Combined invalid-resource/error cases enumerate examples; per-verb cases run before adapters.                                       |
| C6      | One BDD owner tag, with ATDD as traceable evidence role.                                                                            |
| H1      | Tested creator-read pilot precedes consent read journeys.                                                                           |
| H2      | Provider schema source has explicit Red/Green generation task.                                                                      |
| M1      | Revision evidence consistently uses revisions.test.ts.                                                                              |

## Updated Counts

324 tasks: US1=66, US2=137, US3=76, US4=21; Setup/Foundations=9; Integrated validation=15. Suite tasks: TDD=209, BDD=39, ATDD=0 separately owned (shared evidence on BDD), GATE=19. Registry: 125 TDD obligations and 102 BDD-owned scenarios, with 165 mandatory scenario cases. The additional tasks supply provider schema/read prerequisites and per-verb test-first cycles; original T001–T251 IDs are preserved.

## User-requested follow-ups (2026-10-04)

These extend the original 324 tasks; existing IDs and acceptance gates remain unchanged.

- [x] T325 [GATE] Refresh the installed Graphify index after implementation settles; inspect graph/report for new MCP/auth/shared backend nodes and retain the actual command/result. Do not claim an index refresh from merely checking tool availability.
- [x] T326 [GATE] Update the shared feature/pricing catalog and llms.txt/llms-full.txt references to include MCP on Free and Pro with the same creator plan limits. Test catalog availability and rendered reference consistency; do not advertise any plan bypass.
- [x] T327 [US1] Refine consent and connected-apps UI with installed HeroUI/HeroUI Pro guidance and existing application patterns. Use appropriate compound controls, semantic theme tokens, explicit delete permissions, loading/error/empty states and accessible confirmation. Retain behavior tests; inspect real rendered pages before declaring visual completion.

- [x] T328 [US2] [TDD] Supplemental read-input validation: reject unknown fields, bad pagination and malformed creator with stable safe INVALID_INPUT and unchanged resources. TDD-US2-042 and BDD-US2-033 extend the original catalogue by one TDD artifact/one scenario/three cases. Use the SDK public low-level tool handler and projection while retaining strict advertised schemas and protocol/auth checks; 51 affected Jest cases and four focused BDD cases pass. Original Red logs use the descriptive alias BDD-US2-LIST-VALIDATION.

- [x] T329 [US1] Resolve actual provider repeated ba_param consent state: TDD-US1-032 and BDD-US1-025 real Next.js browser Red/Green, preserve duplicate critical field rejection, update traceability and defects.

- [x] T330 [US2] Correct supplemental item-only consent behavior for all three item verbs. Define TDD-US2-043 and BDD-US2-034 with real OAuth/MCP examples, confirm missing behavior Red, remove unrequested read-scope dependency from transactional safe results, verify/refactor and retain evidence.

- [x] T331 [US1] Verify owned and foreign targets under offline-only consent with TDD-US1-033 and BDD-US1-026 before production. Enforce current creator authority for scope sets without an operational permission, preserve exact approved scopes, verify/refactor and retain evidence.

## Supplemental implementation checks

- [x] T332 [US1] [TDD] Verify public HTTP envelope bounds using actual Next route: 256 KiB exact and overflow/never-ending stream, configured Host, modern preflight headers, and approved-origin OAuth challenge CORS. Retain genuine Red and Bun/Node Green plus existing transport BDD regression under TDD-HTTP-001. This supplements T109 and does not complete remaining T109 schemas or T059 named-client profile evidence. Evidence: test-results/mcp/request-boundaries-*.txt.

- [x] T333 [US1] [TDD] Reject inherited-property tool names through the same protocol path as any unknown tool. Own-property permission lookup tested through actual provider/PG/Next endpoint for constructor, **proto**, toString and an ordinary unknown name, with genuine Red, Bun/Node Green, authenticated legacy/modern controls, lint and types. Evidence: test-results/mcp/unknown-tools-*.txt; TDD-HTTP-002.

- [x] T334 [US2] [TDD] Return coherent playlist revision and ordered items during an independent atomic writer. Genuine actual-PG authenticated MCP and BDD Red reproduced mixed versions; read-only repeatable-read transaction passes 4 read cases, both BDD outline examples and 38 native Node read/item/schema controls, lint and types. Owner artifacts TDD-US2-009 / BDD-US2-009; test-results/mcp/playlist-snapshot-*.txt.

- [x] T335 [US4] [TDD] Bound actual MCP request-body cancellation and ten-second read deadline, retaining TDD/BDD-HTTP-003 genuine Red, Bun/native Node Green, CORS/Host regression checks, lint and typecheck. Supplements T243/T244 without completing external dependency cancellation, privacy lifecycle or benchmarks. Evidence: test-results/mcp/request-cancellation-*.txt.

- [x] T336 [US1] [TDD] Add bounded durable revoked-credential cleanup and wire independent retries into existing MCP cleanup worker. Preserve active/unbound/unknown references and local revoked authority; retain real PostgreSQL normal/bounded/concurrent checks, worker Red/Green, existing revoke BDD regression, lint/typecheck. Supplements T053/T056 without completing remaining revoke concurrency/UI obligations. Evidence: test-results/mcp/revoked-*.txt.

- [x] T337 [US4] [TDD] Persist safe authenticated read/denied/invalid-input/missing-scope/rate-limit/unknown-tool activity while preserving atomic mutation-success audit and never using grant as actorSessionId. Retain TDD-ACTIVITY-001/002 and BDD-ACTIVITY-001 Red/Green, native Node regression, lint/typecheck. Supplements T232; activity visibility, pagination, privacy retention and audit-failure catalogue remain incomplete. Evidence: test-results/mcp/{tool,throttled}-activity-*.txt.

- [x] T338 [US4] [TDD] Implement allowlisted activity listing under current creator audit permission, newest-first bounded pagination preserving microsecond timestamps and actor/creator-bound signed cursors. Retain thirteen Bun/native PG checks, seven BDD examples, lint/typecheck. Supplements T232 without completing UI/privacy/deletion lifecycle. Evidence: test-results/mcp/activity-list-*.txt.

- [x] T339 [US4] [TDD] Add verified current-session activity actions and actual HeroUI/Pro settings panel with audit-authorized creator selection, safe operation/actor/app/time/outcome display, bounded signed pagination, and private-history clearing after lost access. Retain fourteen focused Red/Green cases, nineteen including connection regressions, actual BDD-US4-003 browser Red/Green, lint/typecheck. Supplements T232; complete privacy, failure catalogue and source coverage gates remain open. Evidence: test-results/mcp/activity-settings-*.txt.

- [x] T340 [US2] [TDD] Share verified-session browser playlist deletion with the locked backend transaction and exact last-read revision. Reject malformed/stale/current-access failures; clean up items/references atomically. Retain23 new unit/PG checks,59 with browser action controls,5 backend-adapter BDD examples,8 native Node cases, lint/typecheck. Dashboard caller revisions/confirmation UX remain the next slice. Evidence: test-results/mcp/browser-playlist-delete-*.txt.

- [x] T341 [US2] [TDD] Preserve loaded playlist revisions in dashboard single/bulk deletion calls and both list mappings; replace raw trash SVG with accessible HeroUI icon button and existing explicit confirmation. Retain stale rows with safe reload guidance. Two component and two actual dashboard Red/Green cases,76 focused/regression checks, final typecheck/lint pass. Bulk full-browser acceptance and remaining revision combinations are separate. Evidence:test-results/mcp/browser-playlist-delete-ui-*.txt.

- [x] T342 [US4] [TDD] Preserve verified browser actor/session attribution in shared playlist rename/deletion and exclude those session actions from AI app activity. Keep OAuth action/grant metadata and transactional audit unchanged. Three new realPG controls,20selected protocol/adapter controls,2BDD examples,3nativeNode cases, lint/typecheck pass. Evidence:test-results/mcp/browser-playlist-audit-*.txt.

- [x] T343 [US2] [TDD] Add verified-session browser reorder adapter using shared parent-lock/revision transaction and correct session audit.17 PG checks,5 backend BDD examples,6 nativeNode,lint/typecheck pass; public legacy action conversion remains separate. Evidence:test-results/mcp/browser-playlist-reorder-*.txt.

- [x] T344 [US2] [TDD] Implement verified-session append/replace ID selection with provider validation before locks, current authorization/quota/revision inside locks, atomic optional rename and session audit.11 realPG/11 nativeNode cases,10 backend BDD examples,lint/types pass. Public browser action/caller conversion is separate. Evidence:test-results/mcp/browser-playlist-items-*.txt.

- [x] T345 [US2] [TDD] Convert public browser clip selection/reorder/import and both playlist editors to exact revisions and safe failure results; combined name/clips one transaction. Preserve import filters at delegate boundary;205focused/regression checks,17realPG,2actualclipUI and2renameUI controls,lint/types/format pass. Broader browser run5Green/1DCR429setup excluded then affected two rerunGreen. Include changed source in strict coverage and remove prior table exclusion. Locked Pro-import recheck is separate next task. Evidence:test-results/mcp/browser-playlist-items-ui-*.txt.

- [x] T346 [US2] [TDD] Recheck auto-import Pro entitlement inside shared locked mutation after provider validation; set requirement on trusted server caller and distinct verified-session import audit.149focused/regression checks,2backendBDD,13nativeNode controls,lint/types pass. Evidence:test-results/mcp/browser-playlist-import-*.txt.

- [x] T347 [US2] [TDD] Add verified-session overlay deletion adapter sharing locked backend revision transaction and correct browser audit.13selectedactualPG including5OAuth controls,5backendBDD,8nativeNode,lint/types pass. Public browser action and dashboard revision/control conversion remains separate. Evidence:test-results/mcp/browser-overlay-delete-*.txt.

- [x] T348 [US2] [TDD] Convert public overlay deletion and dashboard single/bulk callers to the shared verified backend and cached revision; use named HeroUI delete button and explicit confirmation, retain stale rows with reload guidance.171 focused/regression checks and2 actual dashboard/MCP browser scenarios, lint/typecheck Green. Bulk full-browser acceptance remains separate. Evidence:test-results/mcp/browser-overlay-delete-ui-*.txt.

- [x] T349 [US2] [TDD] Add verified-session overlay configuration adapter using exact shared locked revision/current policy and ordinary session audit.16actualPG save/delete checks,4OAuth update controls,6backendBDD,8nativeNode,lint/typecheck pass. Public dashboard conversion, sanitizer/reward handling and durable side effects remain separate. Evidence:test-results/mcp/browser-overlay-save-*.txt.

- [x] T350 [US2] [TDD] Extract existing browser configuration normalization into shared server-only backend and apply inside locked overlay update; remove moved coverage-ignore comments.34focused/regression checks,3BDD,3nativeNode,4OAuth update controls,lint/typecheck pass. Public save revision conversion, reward validation and durable side effects remain separate. Evidence:test-results/mcp/overlay-sanitization-*.txt.

- [x] T351 [US2] [TDD] Preserve browser Pro reward patch capability under strict separate server schema and allow Free unchanged advanced editor snapshots while rejecting actual paid changes; MCP reward inputs remain denied.14focused tests,2backendBDD,3nativeNode,4OAuth update controls,lint/typecheck pass. Provider reward validation, public dashboard conversion and durable side effects remain separate. Evidence:test-results/mcp/browser-overlay-patch-*.txt.

- [x] T352 [US2] [TDD] Convert public overlay save, settings/style editors, reward cleanup and table status caller to loaded revisions and shared verified backend; adopt committed response and preserve stale draft with reload guidance. Cancel obsolete initial reads to prevent typed-input loss.196focused/regression tests,22actualPG,4actualbrowser settings/style cases,full types/lint/format Green. Legacy sanitizer tests relocated to shared helper. Reward best-effort browser setup retained; durable/cross-process side effects, provider reward ownership and full bulk acceptance remain separate. Evidence:test-results/mcp/browser-overlay-save-ui-*.txt.

- [x] T353 [US2] [TDD] Add verified-session and server-only trusted-chat bulk volume backend with current creator lifecycle/Pro checks, ordered overlay locks, all-or-nothing revision advancement and per-overlay session/worker audits.18actualPG checks,7BDD examples,10nativeNode,types/lint Green. Public controller/chat writers still need conversion; signed EventSub entry acceptance and policy-writer serialization remain separate. Evidence:test-results/mcp/overlay-volume-*.txt.

- [x] T354 [US2] [TDD] Convert public volume/controller and trusted chat callers to shared current-policy/revision backend; refuse broadcast/success on denied commit and prevent cached chat plan bypass.60focused tests,5backendBDD,full types/lint Green. Corrected native Node baseline retained; initial Bun setup failures excluded as ENV075. Signed EventSub HTTP and controller browser acceptance remain separate. Evidence:test-results/mcp/overlay-volume-callers-*.txt.

- [x] T355 [US2] [TDD] Disconnect process-local active overlay sources after shared configuration transaction commits paused status; actual authenticated MCP normal/stale Red/Green.6selectedPG checks,2BDD,2nativeNode,types/lint Green. Cross-process runtime and rollback failure catalogue remain separate. Evidence:test-results/mcp/overlay-pause-*.txt.

- [x] T356 [US2] [TDD] Revalidate actual connected overlay state frames against current runtime policy and server-stored subscription secret after independent database policy writer.58focused tests/4suites,6backendBDD,types/lint Green. Cover pause/delete/disable/suspend/rotation/retained Free restriction; active control preserved. Websocket module server-only and visible to strict coverage. Idle heartbeat and source activity remain separate. Evidence:test-results/mcp/overlay-runtime-*.txt.

- [x] T357 [US2] [TDD] Revalidate idle subscribed source policy on existing30second UPGRADE heartbeat with four concurrent checks and no overlapping validation passes.50focused tests/4suites,6BDD,types/lint Green. Actual scheduled callback, independentPG changes; wire profiles, database deadlines and load gates separate. Include ws route in strict critical coverage. Evidence:test-results/mcp/overlay-idle-runtime-*.txt.

- [x] T358 [US2] [TDD] Revalidate current runtime access before source_activity can restore presence; retain malformed/unauthorized rejection order.31focused tests/3suites,6actual backendBDD,types/lint Green. All six independent access-change cases prevent restored presence; active control preserved. Evidence:test-results/mcp/overlay-activity-runtime-*.txt.

- [x] T359 [US3] [TDD] Serialize owner plan/disabled policy writes with shared resource transactions and trusted chat via native owner-row lock in grant/creator/owner/resource order.18PG,22unit,4BDD,4nativeNode,types/lint Green; actualPG wait_event_type confirms writer waits. Membership/agency/entitlement-grant serialization remains separate. Evidence:test-results/mcp/owner-policy-serialization-*.txt.

- [x] T360 [US3] [TDD] Hold relevant actor membership rows in stable share-lock order before resolving current resource permission; native removal/role reduction waits until committed mutation.19focused tests,2BDD,2nativeNode,types/lint Green. Direct path verified; custom roles, agency-path catalogue and Better Auth endpoint catalogue remain separate. Evidence:test-results/mcp/membership-policy-serialization-*.txt.

- [x] T361 [US3] [TDD] Lock current role definitions applicable to actor memberships before permission resolution; native permission reduction/definition removal waits through resource transaction.17focused checks,2BDD,2nativeNode,types/lint Green. Agency ceiling and entitlement-source rows remain separate. Evidence:test-results/mcp/custom-role-policy-serialization-*.txt.

- [x] T362 [US3] [TDD] Share-lock approved agency-context creator link rows before current resource authorization; native ceiling reduction/revocation/deletion waits through resource commit.24focused tests,3BDD,3nativeNode,types/lint Green. Corrected genuine Red excludes wrong-writer fixture ENV077; helper now requires exactly one affected policy row. Allocation/grant sources remain separate. Evidence:test-results/mcp/agency-policy-serialization-*.txt.

- [x] T363 [US3] [TDD] Share-lock owner/global Pro entitlement grant rows before effective-plan resolution in resource and trusted chat transactions.25focused tests,8BDD,8nativeNode,types/lint Green. Real Free owner plus current personal/global grant; native revoke/delete/expiry changes wait for resource commit. Agency allocations/clock expiry separate. Evidence:test-results/mcp/grant-policy-serialization-*.txt.

- [x] T364 [US3] [TDD] Share-lock current creator_pro allocations before effective-plan reads in common resource/trusted chat transactions; native allocation end/delete/expiry waits through commit.28focused checks,4BDD,4nativeNode,types/lint Green. Grant and agency-link regression controls rerun; applicable link locks precede allocations. Clock/load/deadline and full endpoint catalogue remain separate. Evidence:test-results/mcp/allocation-policy-serialization-*.txt.

- [x] T365 [TDD] Repair compiled native coverage probes to resolve actual installed Next/rate-limiter entries and server-compatible Turnstile export, with real import/load calibration, cold-source protection, compiled public/WebSocket regression and static checks. Close ENV081 only after all affected suites pass; no mocked modules or weakened coverage thresholds.

- [x] T366 [TDD] Repair actual inverted TypeScript mapped statement intervals in native source-coverage pipeline after final Jest mapping; preserve all execution/cold counters and global/source gate failures.26 calibration/gate checks,4 refactor cases,types/lint Green. ENV082 Verified. Evidence:test-results/mcp/coverage-source-ranges-_.txt and coverage-range-pipeline-_.txt.

- [x] T367 [TDD] Guard direct Better Auth OAuth authorization metadata path with the same schema/configuration readiness as root aliases; seven genuine Red failures precede production.23 bootstrap tests,8 native Node,3 actual HTTP smoke,types/lint/format pass. Evidence:test-results/mcp/rollout-direct-discovery-*.txt.

- [x] T368 [TDD] Include changed auth catch-all route in real Jest source collection and strict security manifest; two genuine Red assertions precede enforcement change.23 manifest/collector/native-import checks,types/lint/format pass; global/gallery thresholds retained. Full coverage gate remains separate. Evidence:test-results/mcp/coverage-auth-route-manifest-*.txt.

- [x] T369 [TDD] Bound native PostgreSQL acquisition and server-side SQL execution to ten seconds in shared backend pool; prove actual MCP sleeping transaction/TCP handshake timeout and released work after genuine TDD/BDD Red.14 native regression checks,2 acceptance scenarios,types/lint/format pass. Request-level cancellation and cumulative request deadline remain separate. Evidence:test-results/mcp/database-deadline-*.txt.

- [x] T370 [TDD] Require changed shared database client in strict critical-source manifest and actual Jest collection; two genuine Red assertions,23 calibration/regression checks,lint/format Green. Full coverage remains separate. Evidence:test-results/mcp/coverage-db-client-*.txt.

- [x] T371 [US4] [TDD] Include actor-owned active/revoked MCP approval metadata in comprehensive private account export while excluding foreign grants, OAuth client secrets and arbitrary client metadata. Genuine TDD/BDD Red precedes implementation;5 native/credential regression checks,2 acceptance scenarios,types/lint/format and refactor pass. Retention/deletion separate. Evidence:test-results/mcp/account-export-*.txt.

- [x] T372 [TDD] Require changed comprehensive account export in critical-source manifest and actual Jest collection;2 genuine Red cases,23 regression/calibration checks,lint/format pass. Full coverage gate remains separate. Evidence:test-results/mcp/coverage-account-export-*.txt.

- [x] T373 [US3] [TDD] Reject OAuth token/grant expiry after native overlay/playlist edit resource-lock wait; preserve clock deadline from locked authorization and roll back expired edit/revision/audit. Four genuine Red cases plus2 active controls precede production in TDD/BDD;32 regression checks,6 acceptance scenarios,types/lint/format Green. Other mutation clock catalogue separate. Evidence:test-results/mcp/resource-expiry-*.txt.

- [x] T374 [US3] [TDD] Reject queued overlay/playlist deletion after token/grant clock expiry, preserving resources/revisions/audits;6 native/BDD examples with4 genuine Red before production.19 initial checks,28 regression cases,6 BDD scenarios,types/lint/format pass. Item/create clock catalogue separate. Evidence:test-results/mcp/resource-delete-expiry-*.txt.

- [x] T375 [US4] [TDD] Add bounded/configured MCP operational activity retention preserving current activity and unrelated audits.5 native and11 input cases plus4 BDD scenarios genuine Red before production;23 cleanup regressions,types/lint/format Green. Default90days configurable1–365;invalid settings prevent deletion. Scheduler/purge cleanup separate. Evidence:test-results/mcp/activity-retention-*.txt.

- [x] T376 [US4] [TDD] Wire bounded activity retention into existing nonoverlapping30second cleanup worker with independent failure reporting/retry.3 genuine Red cases with10 lifecycle controls;29 combined and24 refactor tests,types/lint/format Green. Account-deletion cleanup separate. Evidence:test-results/mcp/activity-retention-scheduler-*.txt.

- [x] T377 [US4] [TDD] Clean orphan MCP activity after actual actor/creator source-schema deletion in existing bounded worker; verify FK grant/approval/retry/credential cascades and preserve foreign history,billing audits,suspended recovery.2 genuine TDD/BDD Red with1 recovery control;35 regression checks,3 BDD scenarios,types/lint/format Green. Full account purge scheduler and MCP-disabled cleanup obligation remain separate. Evidence:test-results/mcp/account-purge-*.txt.

- [x] T378 [US4] [TDD] Cancel request-owned busy/queued native SQL without late commit or unrelated cancellation; preserve durable encrypted provider rotation and public pool shutdown semantics. Genuine native/BDD Red before fixes;7 focused checks,4 BDD scenarios,10 compiled selections,3 named-query controls,4 timeout regressions and static gates Green. Complete cumulative/degraded cancellation catalogue remains separate. Evidence:test-results/mcp/database-abort-ownership-*.txt.

- [x] T379 [US4] [TDD] Enforce critical source coverage and actual Jest collection for request-owned cancellation and provider credential serialization;2 genuine Red with17 controls precede production,23 refactor checks and lint/format Green. Evidence:test-results/mcp/coverage-cancellation-source-*.txt.

- [x] T380 [US4] [TDD] Bound actual Better Auth Twitch refresh headers and response consumption to ten seconds, preserve serialized encrypted rotation and prevent late vendor response persistence.2 genuine native/BDD Red before production;compiled body regression fixed;4 native checks,4 BDD scenarios,5 compiled selections and static gates Green. Evidence:test-results/mcp/provider-deadline-final-*.txt.

- [x] T381 [US4] [TDD] Add bounded Twitch refresh helper to actual strict critical manifest/Jest collection;2 genuine Red with17 controls before production,23 checks and lint/format Green. Evidence:test-results/mcp/coverage-provider-refresh-*.txt.

- [x] T382 [US3] [TDD] Reject token/grant expiry during queued playlist item remove/reorder/replacement, preserving item ordering,parent revision and audits;6 genuine native/BDD Red with3 active controls before production.9 native checks,9 BDD scenarios,45 compiled selections,46 unit/adapter regressions and static gates Green. Add/create/read clock catalogue separate. Evidence:test-results/mcp/playlist-item-expiry-*.txt.

- [x] T383 [US3] [TDD] Roll back OAuth resource/retry/audit creation when token/grant expires during native audit persistence wait;4 genuine native/BDD Red plus2 active controls before production.21 native retry regressions,6 BDD scenarios,23 compiled selections and static gates Green. Evidence:test-results/mcp/create-expiry-*.txt.

- [x] T384 [US3] [TDD] Recheck token/grant clock expiry for validated clip addition after resource waits, preserving items/revision/audit;2 genuine native/BDD Red with1 active control before fix.3 native checks,3 BDD scenarios,19 compiled selections and static gates Green. Actual encrypted creator credentials/local HTTP validation. Evidence:test-results/mcp/playlist-add-expiry-*.txt.

- [x] T385 [US4] [TDD] Prevent provider coordination from pinning every storage connection under concurrent cached credential access;native20-read starvation and invalid capacity boundary Red plusBDD Red before admission guard.3 native checks,2 BDD scenarios,7 compiled selections and static gates Green. Preserve durable/cross-process refresh locking;full warmed independent-creator benchmark separate. Evidence:test-results/mcp/provider-concurrency-*.txt.

- [x] T386 [US4] [TDD] Discard provider lease after advisory unlock failure so independent coordination remains usable;1 genuine native/BDD Red with1 healthy control before production.5 native regressions,3 BDD scenarios,8 compiled checks and static gates Green. Preserve completed credential result and admission cleanup. Evidence:test-results/mcp/provider-unlock-*.txt.

- [x] T387 [US4] [TDD] Run privacy retention independently of public MCP feature flag with read-only schema readiness; native/BDD each1 genuine Red plus legacy control,5 unit Red plus15 controls before fix.22 native/unit checks,2 BDD scenarios,13 compiled regressions and static gates Green. Full account purge adapter separate. Evidence:test-results/mcp/cleanup-disabled-*.txt.

- [x] T388 [US4] Verify existing credential admission timeout removes waiting work without a late callback and preserves storage/retry capacity; actual native timer/locks, initial Green requires no production change. Compiled/static gates pending. Evidence:test-results/mcp/provider-queue-*.txt.

- [x] T389 [US1] [TDD] Bound actual anonymous OAuth registration bodies to256KiB/10s with cancellation before provider parsing, preserving pre-body registration budgets;4 genuine native/BDD Red plus1 valid control before fix.5 native checks,5 BDD scenarios,51 compiled OAuth/registration regressions and static gates Green. Evidence:test-results/mcp/registration-body-*.txt.

- [x] T390 [US4] [TDD] Validate actual provider refresh response before encrypted persistence and bound64KiB consumption within existing10s deadline;4 genuine native/BDD Red plus4 controls.8 native checks,8 BDD scenarios,12 compiled response/deadline/durable-abort checks and static gates Green. Evidence:test-results/mcp/provider-response-*.txt.

- [x] T391 [US1] [TDD] Return supported OAuth400 invalid_grant on revoked/expired connection refresh after2 genuine native/BDD classification Red;9 native/9 BDD non-concurrency controls and static gates plus43 compiled OAuth regressions Green. Full T046 stays incomplete while MCP042 rotation race is unresolved;1 concurrent case explicitly unselected for this focused fix,not hidden release exclusion. Evidence:test-results/mcp/refresh-denial-*.txt.

- [x] T392 [US1] [GATE] Pin MCP effective transitive OAuth provider to1.7.6 so actual provider peers match auth/core1.7.6;2 native package guard Red before override.15 schema/version controls,1 native29-case token catalogue,static and installed patch validation Green; final BDD/types Green. Remove only stale unreferenced installed1.7.7 copy after lock update (ENV094). Evidence:test-results/mcp/auth-dependency-alignment-*.txt.

- [x] T393 [US1] [TDD] Repair pinned Drizzle1.7.6 atomic increment/compare-and-swap outer predicate recheck via supported Bun dependency patch; deterministic native/BDD Red observe2 locked refresh statements followed by2 successes before fix. Full10 native/10 BDD refresh cases and static/installed2-package patch validation Green; full44-case compiled OAuth regression Green. Source schemas only;no generated migrations. Evidence:test-results/mcp/refresh-overlap-*.txt.

- [x] T394 [US1] [TDD] Bound actual CIMD DNS/header waits through supported fetch callback while retaining vendor resolve-once public-address/TLS pinning and metadata body/profile validation;1 genuine native/BDD12s Red plus private-address control before fix.2 native/2 BDD and static gates pass; 14 compiled discovery/registration regressions Green. Full T015 catalogue separate. Evidence:test-results/mcp/cimd-deadline-*.txt.

- [x] T395 [US1] [TDD] Close unconsumed rejected CIMD response bodies through supported fetch wrapper, preserving delegate schema/profile/cache behavior;2 genuine native/BDD connection-lifetime Red plus9 valid/pinning/size/identity/callback/TLS controls. Full11 native/11 BDD,20 compiled and final static gates passed. Local TLS bridge preserves actual Host/SNI/cert checks and both pinned lookup callback forms;no external-host acceptance. Evidence:test-results/mcp/cimd-https-*.txt.

- [x] T396 [US2] [TDD] Adopt successful dashboard bulk status/delete results and their committed revisions despite other denied or rejected rows; preserve failed rows with reload guidance. Four genuine component Red and2 actual browser Red retained;19 component regressions,2 browser scenarios and static gates Green. Evidence:test-results/mcp/bulk-ui-*.txt.

## Requested verification speed improvement

- [x] T397 [TDD] Reproduce and repair ENV099 final Istanbul endpoint/source-map failure with focused executable evidence; retain all executed and cold counters, preserve strict thresholds, and isolate nested coverage output from the enclosing run.
- [x] T398 [TDD] Prove per-suite child coverage isolation with concurrent real probes and cold-branch controls before enabling bounded parallel ordinary regression/coverage workers. Keep deadline/performance-sensitive suites in a quiet serial lane; record nonempty scoped runs and actual timings without claiming final release acceptance.

- [x] T399 [TDD] Refactor the oversized resource-operation test suite into independent per-operation files, preserving every published test name/example and assertion. Verify identical describe-block hashes and101executed cases with bounded parallel workers; update mutation selectors and traceability without declaring unbuilt acceptance Green.

- [x] T400 [TDD] Add automatic per-run test worker budgeting from available CPUs, free memory and container limits, with a documented manual override. Keep ordinary database scopes within available loopback PostgreSQL capacity and run timing/load/race suites in a separate serial lane without duplicate/skipped tests or weaker coverage gates. Verify small/large machine profiles, invalid overrides and actual runner scheduling.

## Durable resource side effects

- [x] T401 [US2] [TDD] Persist browser Pro reward subscription intent atomically with its shared locked overlay revision/audit; stale or rolled-back edits create no jobs. Use a separate durable job adapter for provider effects, never the email notification outbox; source-schema edits only. Execute native PostgreSQL and matching BDD evidence before production changes.
- [x] T402 [US2] [TDD] Process committed reward intents through bounded provider I/O outside grant/quota transactions, with durable claim leases, retries and exact subscription idempotency; skip obsolete/deleted configuration, preserve committed resources on provider failure and wire the worker independently of public MCP availability. Verify process/retry/expiry/failure boundaries and existing reward behavior.

- [x] T403 [TDD] Reproduce ENV108 false cold/duplicate source obligations in actual combined parent/native coverage, then use consistent installed Jest instrumentation for native application probes and merge identical raw counters before one source remap. Preserve actual cold code, per-suite output isolation and all strict coverage gates; verify mixed/cold/parallel/range calibrations and focused reward source coverage before broad final measurement.

- [x] T404 [US2] [TDD] Complete the provider reward ownership validation explicitly left separate by T350–T352: before accepting a changed nonempty verified-session reward, validate the server-derived creator/reward with its server-owned credential through bounded provider I/O outside resource/grant/quota locks. Preserve unchanged/cleared rewards, recheck current authority/plan/revision inside the shared transaction and keep audit/resource/effect rollback atomic. Execute native HTTP/PG and owning BDD cases before production changes; no new OAuth engine or generated migration.

## External acceptance deferred until prerequisites are supplied

- [x] T405 [US1] Use Better Auth 1.7.7's supported `verifyOAuthQueryParams` helper before rendering consent or redirecting to login. Prove component and actual Next HTTP missing-verification Red before changes, verify real provider-issued query acceptance and altered/duplicate/expired query rejection, preserve consent/login controls, then run scoped tests, BDD, typecheck and lint. No custom OAuth verifier.

T247 blocked portion: actual ChatGPT web and Claude web require purpose-created accounts with connector access and an isolated publicly reachable HTTPS deployment. Actual Codex CLI requires authenticated host configuration targeting that isolated HTTPS deployment. These prerequisites are unavailable in this environment. Controlled custom SDK/native browser evidence continues locally and does not claim named-host acceptance. This individual external portion is moved after local tasks; it does not block implementation, regression, coverage, benchmark or local release preparation.

T244 current closure: retained genuine request cancellation, dependency deadline, activity retention, purge and disabled-MCP Red/Green cycles audited. Current 19 native checks in seven suites and16 owning BDD examples pass; current84 component/scheduler checks across four suites pass, types pass. Evidence: `test-results/mcp/runtime-privacy-current-checkpoint-green.txt`, `runtime-privacy-bdd-current-green.txt`, `overlay-selection-trial-existing-green.txt`, `overlay-selection-trial-existing-types.txt`. Benchmark initially Green needed no performance change; T243 provenance requirement and final release gates remain open.

T287/T292 original Red checkpoints audited: list_playlists native1 and BDD1 intended missing-tool failures, get_playlist native3 and BDD1 intended missing-tool failures, recorded before production in cycle log. Evidence:`test-results/mcp/list-playlists-red.txt`, `list-playlists-bdd-red.txt`, `get-playlist-red.txt`, `get-playlist-bdd-red.txt`. Later native/BDD Green, pagination and explicit-principal shared reader closure are separately retained. No current Green or mutant output relabeled as original Red.

T137 Green refactor checkpoint reviewed: `src/server/mcp/risk.ts` centralizes annotations, rejects unknown tools, describes bounded retry semantics, and never grants authorization. Owning annotation/risk discovery and six delete-scope BDD proofs retained; current complete ordinary phase also passes `test/mcp/unit/tool-risk.test.ts`. No needless production rewrite, no host-confirmation claim, no final story closure. Evidence:`test-results/mcp/tool-risk-green.txt`, `tool-risk-discovery-verified.txt`, `delete-permissions-bdd-green.txt`; current full run is separately in progress.

T111 schema Green refactor checkpoint reviewed: shared target/revision/retry/pagination/patch definitions keep fifteen inputs strict and DTO projections exclude ORM credentials; common owner policy remains separate from schemas. Original31-case Green retained and current full run passes owning `test/mcp/integration/resource-operations.test.ts`; expanded public per-verb validation/DTO evidence remains separately mapped. No source rewrite during frozen integration run. Evidence:`test-results/mcp/schemas-green.txt`, `schema-retry-risk-corrected-green.txt` and canonical public validation proof paths in registry.

---

## Workflow expansion tasks (T406–T541)

These 136 tasks are complete. Their historical T001–T136 identifiers are retained in the archive; canonical IDs equal historical IDs plus 405. This does not complete or waive any original blocked task.

# Tasks: MCP workflows

## Phase 1: Setup

- [x] T406 Resolve templates and record accepted scope in specs/003-mcp-support/spec.md
- [x] T407 Research existing shared-service boundaries in specs/003-mcp-support/research.md
- [x] T408 [GATE] Initialize plan and traceability/report registry in specs/003-mcp-support/test-traceability.md

## Phase 2: Foundation

- [x] T409 [TDD] Add strict catalogue/schema/consent/risk tests and record Red in test/mcp/workflows/catalogue.test.ts
- [x] T410 Implement and verify new catalogue/schemas/scopes in src/server/mcp/workflows/catalogue.ts

## Phase 3: Remote control

- [x] T411 [WF-US1] [BDD] Specify all positive/negative and option cases in test/bdd/features/mcp-workflows/remote.feature and record inventory in specs/003-mcp-support/test-traceability.md
- [x] T412 [WF-US1] [TDD] Add tests and matching BDD binding for get_overlay_runtime; observe expected Red in test/mcp/workflows/remote.test.ts
- [x] T413 [WF-US1] Implement get_overlay_runtime through shared backend policy in src/server/resources/remote.ts
- [x] T414 [WF-US1] [GATE] Verify Green and refactor get_overlay_runtime; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T415 [WF-US1] [TDD] Add tests and matching BDD binding for get_overlay_queues; observe expected Red in test/mcp/workflows/remote.test.ts
- [x] T416 [WF-US1] Implement get_overlay_queues through shared backend policy in src/server/resources/remote.ts
- [x] T417 [WF-US1] [GATE] Verify Green and refactor get_overlay_queues; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T418 [WF-US1] [TDD] Add tests and matching BDD binding for control_overlay; observe expected Red in test/mcp/workflows/remote.test.ts
- [x] T419 [WF-US1] Implement control_overlay through shared backend policy in src/server/resources/remote.ts
- [x] T420 [WF-US1] [GATE] Verify Green and refactor control_overlay; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T421 [WF-US1] [TDD] Add tests and matching BDD binding for enqueue_overlay_clip; observe expected Red in test/mcp/workflows/remote.test.ts
- [x] T422 [WF-US1] Implement enqueue_overlay_clip through shared backend policy in src/server/resources/remote.ts
- [x] T423 [WF-US1] [GATE] Verify Green and refactor enqueue_overlay_clip; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T424 [WF-US1] [TDD] Add tests and matching BDD binding for clear_overlay_queue; observe expected Red in test/mcp/workflows/remote.test.ts
- [x] T425 [WF-US1] Implement clear_overlay_queue through shared backend policy in src/server/resources/remote.ts
- [x] T426 [WF-US1] [GATE] Verify Green and refactor clear_overlay_queue; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T427 [WF-US1] [GATE] Run full affected evidence/coverage and update specs/003-mcp-support/test-summary.md

## Phase 4: Find and import clips

- [x] T428 [WF-US2] [BDD] Specify all positive/negative and option cases in test/bdd/features/mcp-workflows/discovery.feature and record inventory in specs/003-mcp-support/test-traceability.md
- [x] T429 [WF-US2] [TDD] Add tests and matching BDD binding for search_clips; observe expected Red in test/mcp/workflows/discovery.test.ts
- [x] T430 [WF-US2] Implement search_clips through shared backend policy in src/server/resources/discovery.ts
- [x] T431 [WF-US2] [GATE] Verify Green and refactor search_clips; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T432 [WF-US2] [TDD] Add tests and matching BDD binding for resolve_clip; observe expected Red in test/mcp/workflows/discovery.test.ts
- [x] T433 [WF-US2] Implement resolve_clip through shared backend policy in src/server/resources/discovery.ts
- [x] T434 [WF-US2] [GATE] Verify Green and refactor resolve_clip; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T435 [WF-US2] [TDD] Add tests and matching BDD binding for preview_playlist_import; observe expected Red in test/mcp/workflows/discovery.test.ts
- [x] T436 [WF-US2] Implement preview_playlist_import through shared backend policy in src/server/resources/discovery.ts
- [x] T437 [WF-US2] [GATE] Verify Green and refactor preview_playlist_import; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T438 [WF-US2] [TDD] Add tests and matching BDD binding for commit_playlist_import; observe expected Red in test/mcp/workflows/discovery.test.ts
- [x] T439 [WF-US2] Implement commit_playlist_import through shared backend policy in src/server/resources/discovery.ts
- [x] T440 [WF-US2] [GATE] Verify Green and refactor commit_playlist_import; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T441 [WF-US2] [GATE] Run full affected evidence/coverage and update specs/003-mcp-support/test-summary.md

## Phase 5: Galleries and website embeds

- [x] T442 [WF-US3] [BDD] Specify all positive/negative and option cases in test/bdd/features/mcp-workflows/galleries.feature and record inventory in specs/003-mcp-support/test-traceability.md
- [x] T443 [WF-US3] [TDD] Add tests and matching BDD binding for list_galleries; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T444 [WF-US3] Implement list_galleries through shared backend policy in src/server/resources/galleries.ts
- [x] T445 [WF-US3] [GATE] Verify Green and refactor list_galleries; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T446 [WF-US3] [TDD] Add tests and matching BDD binding for get_gallery; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T447 [WF-US3] Implement get_gallery through shared backend policy in src/server/resources/galleries.ts
- [x] T448 [WF-US3] [GATE] Verify Green and refactor get_gallery; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T449 [WF-US3] [TDD] Add tests and matching BDD binding for create_gallery; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T450 [WF-US3] Implement create_gallery through shared backend policy in src/server/resources/galleries.ts
- [x] T451 [WF-US3] [GATE] Verify Green and refactor create_gallery; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T452 [WF-US3] [TDD] Add tests and matching BDD binding for update_gallery; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T453 [WF-US3] Implement update_gallery through shared backend policy in src/server/resources/galleries.ts
- [x] T454 [WF-US3] [GATE] Verify Green and refactor update_gallery; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T455 [WF-US3] [TDD] Add tests and matching BDD binding for delete_gallery; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T456 [WF-US3] Implement delete_gallery through shared backend policy in src/server/resources/galleries.ts
- [x] T457 [WF-US3] [GATE] Verify Green and refactor delete_gallery; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T458 [WF-US3] [TDD] Add tests and matching BDD binding for publish_gallery; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T459 [WF-US3] Implement publish_gallery through shared backend policy in src/server/resources/galleries.ts
- [x] T460 [WF-US3] [GATE] Verify Green and refactor publish_gallery; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T461 [WF-US3] [TDD] Add tests and matching BDD binding for get_gallery_embed; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T462 [WF-US3] Implement get_gallery_embed through shared backend policy in src/server/resources/galleries.ts
- [x] T463 [WF-US3] [GATE] Verify Green and refactor get_gallery_embed; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T464 [WF-US3] [TDD] Add tests and matching BDD binding for get_gallery_preview; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T465 [WF-US3] Implement get_gallery_preview through shared backend policy in src/server/resources/galleries.ts
- [x] T466 [WF-US3] [GATE] Verify Green and refactor get_gallery_preview; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T467 [WF-US3] [TDD] Add tests and matching BDD binding for get_overlay_embed; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T468 [WF-US3] Implement get_overlay_embed through shared backend policy in src/server/resources/galleries.ts
- [x] T469 [WF-US3] [GATE] Verify Green and refactor get_overlay_embed; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T470 [WF-US3] [GATE] Run full affected evidence/coverage and update specs/003-mcp-support/test-summary.md

## Phase 6: Creator Pages

- [x] T471 [WF-US4] [BDD] Specify all positive/negative and option cases in test/bdd/features/mcp-workflows/creator-pages.feature and record inventory in specs/003-mcp-support/test-traceability.md
- [x] T472 [WF-US4] [TDD] Add tests and matching BDD binding for get_creator_page; observe expected Red in test/mcp/workflows/creator-pages.test.ts
- [x] T473 [WF-US4] Implement get_creator_page through shared backend policy in src/server/resources/creator-pages.ts
- [x] T474 [WF-US4] [GATE] Verify Green and refactor get_creator_page; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T475 [WF-US4] [TDD] Add tests and matching BDD binding for update_creator_page; observe expected Red in test/mcp/workflows/creator-pages.test.ts
- [x] T476 [WF-US4] Implement update_creator_page through shared backend policy in src/server/resources/creator-pages.ts
- [x] T477 [WF-US4] [GATE] Verify Green and refactor update_creator_page; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T478 [WF-US4] [TDD] Add tests and matching BDD binding for publish_creator_page; observe expected Red in test/mcp/workflows/creator-pages.test.ts
- [x] T479 [WF-US4] Implement publish_creator_page through shared backend policy in src/server/resources/creator-pages.ts
- [x] T480 [WF-US4] [GATE] Verify Green and refactor publish_creator_page; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T481 [WF-US4] [GATE] Run full affected evidence/coverage and update specs/003-mcp-support/test-summary.md

## Phase 7: Runner setup and streaming

- [x] T482 [WF-US5] [BDD] Specify all positive/negative and option cases in test/bdd/features/mcp-workflows/runners.feature and record inventory in specs/003-mcp-support/test-traceability.md
- [x] T483 [WF-US5] [TDD] Add tests and matching BDD binding for get_runner_setup; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T484 [WF-US5] Implement get_runner_setup through shared backend policy in src/server/resources/runners.ts
- [x] T485 [WF-US5] [GATE] Verify Green and refactor get_runner_setup; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T486 [WF-US5] [TDD] Add tests and matching BDD binding for list_runners; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T487 [WF-US5] Implement list_runners through shared backend policy in src/server/resources/runners.ts
- [x] T488 [WF-US5] [GATE] Verify Green and refactor list_runners; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T489 [WF-US5] [TDD] Add tests and matching BDD binding for get_runner; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T490 [WF-US5] Implement get_runner through shared backend policy in src/server/resources/runners.ts
- [x] T491 [WF-US5] [GATE] Verify Green and refactor get_runner; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T492 [WF-US5] [TDD] Add tests and matching BDD binding for create_runner; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T493 [WF-US5] Implement create_runner through shared backend policy in src/server/resources/runners.ts
- [x] T494 [WF-US5] [GATE] Verify Green and refactor create_runner; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T495 [WF-US5] [TDD] Add tests and matching BDD binding for update_runner; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T496 [WF-US5] Implement update_runner through shared backend policy in src/server/resources/runners.ts
- [x] T497 [WF-US5] [GATE] Verify Green and refactor update_runner; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T498 [WF-US5] [TDD] Add tests and matching BDD binding for delete_runner; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T499 [WF-US5] Implement delete_runner through shared backend policy in src/server/resources/runners.ts
- [x] T500 [WF-US5] [GATE] Verify Green and refactor delete_runner; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T501 [WF-US5] [TDD] Add tests and matching BDD binding for unlink_runner; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T502 [WF-US5] Implement unlink_runner through shared backend policy in src/server/resources/runners.ts
- [x] T503 [WF-US5] [GATE] Verify Green and refactor unlink_runner; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T504 [WF-US5] [TDD] Add tests and matching BDD binding for list_stream_sessions; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T505 [WF-US5] Implement list_stream_sessions through shared backend policy in src/server/resources/runners.ts
- [x] T506 [WF-US5] [GATE] Verify Green and refactor list_stream_sessions; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T507 [WF-US5] [TDD] Add tests and matching BDD binding for get_stream_session; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T508 [WF-US5] Implement get_stream_session through shared backend policy in src/server/resources/runners.ts
- [x] T509 [WF-US5] [GATE] Verify Green and refactor get_stream_session; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T510 [WF-US5] [TDD] Add tests and matching BDD binding for configure_stream_session; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T511 [WF-US5] Implement configure_stream_session through shared backend policy in src/server/resources/runners.ts
- [x] T512 [WF-US5] [GATE] Verify Green and refactor configure_stream_session; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T513 [WF-US5] [TDD] Add tests and matching BDD binding for control_stream_session; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T514 [WF-US5] Implement control_stream_session through shared backend policy in src/server/resources/runners.ts
- [x] T515 [WF-US5] [GATE] Verify Green and refactor control_stream_session; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T516 [WF-US5] [TDD] Add tests and matching BDD binding for get_runner_snapshot; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T517 [WF-US5] Implement get_runner_snapshot through shared backend policy in src/server/resources/runners.ts
- [x] T518 [WF-US5] [GATE] Verify Green and refactor get_runner_snapshot; update specs/003-mcp-support/tdd/cycle-log.md
- [x] T519 [WF-US5] [GATE] Run full affected evidence/coverage and update specs/003-mcp-support/test-summary.md
- [x] T520 [GATE] Run affected compatibility, coverage, types, lint, format, build and migration-policy gates in specs/003-mcp-support/test-traceability.md
- [x] T521 [GATE] Update tool docs, llms and capability/pricing descriptions in src/app/llms-full.txt/llms-full.txt
- [x] T522 [GATE] Refresh Graphify and overall observed test summary in reports/test-summary.md
- [x] T523 [GATE] Complete traceability/defect review and record remaining external-only blockers in specs/003-mcp-support/test-summary.md

## Dependencies and parallelism

Foundation precedes stories. Run one behavior slice at a time, with tests before production. Independent lint/types and independent reads may run concurrently. Do not run multiple database-heavy full suites concurrently. Story services remain separable for follow-up review.

## Additional WF-US3 completeness: public player integration

- [x] T524 [WF-US3] [TDD] Add actual-handler public player embed evidence in test/mcp/workflows/galleries.test.ts
- [x] T525 [WF-US3] Implement get_player_embed without private OBS credentials in src/server/resources/galleries.ts
- [x] T526 [WF-US3] [GATE] Verify public player formats and scopes in test/bdd/features/mcp-workflows/galleries.feature

## Browser and workflow integration discovered during execution

- [x] T527 [WF-US3] Coordinate browser gallery revisions and reject stale edits; native and existing action evidence in browser-gallery-revisions-green.log
- [x] T528 [WF-US3] Share browser/principal creation quota lock; native concurrency evidence in gallery-quota-race-green.log
- [x] T529 [WF-US3] Advance linked-gallery revisions during playlist deletion; linked-gallery-revision-green.log
- [x] T530 [WF-US4] Advance settings revisions, reject stale upserts and update browser state; browser-settings-stale-green.log
- [x] T531 [WF-US5] Advance browser stream configuration and reject stale edits; browser-runner-stale-green.log
- [x] T532 [WF-US5] Coordinate browser start/stop revisions; browser-runner-control-stale-green.log
- [x] T533 [WF-US5] Version browser unlink and owned-session shutdown; browser-runner-unlink-green.log
- [x] T534 [WF-US5] Version device naming/enrollment while preserving ordinary heartbeat versions; runner-heartbeat-revision-green.log and runner-enrollment-revision-green.log
- [x] T535 [WF-US3/WF-US5] Reject retained creation retries for deleted resources; retry-liveness-green.log
- [x] T536 [WF-US1] Extend read/edit consent presets and readable scope labels without silently granting consequential operations; consent-presets-green.log and consent-labels-green.log
- [x] T537 [WF-US1] Complete typed readable activity labels for all tools; activity-labels-green.log
- [x] T538 [WF-US1] Report live gallery limits and remote/Runner feature restrictions; capabilities-green.log
- [x] T539 [WF-US5] Preserve reported actual state and version entitlement shutdown intent; runner-suspension-revision-green.log and runner-heartbeat-expiry-green.log
- [x] T540 [GATE] Reconcile detailed option/edge scenarios, complete coverage and finalize source-frozen regression evidence

- [x] T541 [GATE] Classify workflow fixtures in the capacity-aware database lane; actual-runner Red/Green retained in workflow-scheduler-red.log and workflow-scheduler-green.log

## Feedback submission tasks

- [x] T542 Record accepted feedback scope, existing permission choice, RAM-only limits and Sentry privacy contract.
- [x] T543 [TDD] Retain intended missing-tool Red for strict feedback schema, annotations and permission.
- [x] T544 [BDD] Retain actual OAuth/MCP missing-tool Red and verify bug/suggestion submission with a controlled real Sentry SDK transport.
- [x] T545 Implement bounded per-user RAM quota, deduplication and retry conflict behavior, and verify technical boundaries.
- [x] T546 Implement Sentry feedback integration and privacy-safe workflow activity; verify authorization, Free/read-only, invalid input, unavailable sink and payload projection.
- [x] T547 Verify exact 50-tool catalogue, risk hints, activity label and targeted compatibility checks.
- [x] T548 Run relevant coverage/types/lint/format/build checks without lowering thresholds.
- [x] T549 Reconcile feedback evidence, final counts and reports, and refresh Graphify.

## Shared application limiter refinement

- [x] T550 Record the user-requested shared-library quota and fixed-window semantics, preserving auth/transport limits.
- [x] T551 Extract the existing app limiter core and verify existing callers; retain intended shared-quota unit/actual-MCP Red.
- [x] T552 Replace the custom feedback quota with the shared facade and keep bounded replay/concurrent-retry protection; verify real-library boundaries.
- [x] T553 Run affected tests, final types/lint/build/coverage and reconcile evidence/docs/Graphify.

## Always-available MCP refinement

- [x] T554 Remove activation-toggle configuration and conditional plugin installation; keep credential/schema validation.
- [x] T555 Update affected fixtures and tests; verify always-available native discovery/OAuth and failure boundaries, types/lint/build/coverage.
- [x] T556 Update the PR and preview handoff; retain actual deployment readiness evidence without a feature toggle.

- [x] T557 Fix Node 24 framework-proxied MCP and dynamic-registration POST request reconstruction; retain genuine failing regression, green adapter tests and actual production-Next smoke checks.

## Blocked historical prerequisites — current behavior implemented and tested

These tasks require unavailable original evidence or explicit review of a workflow exception. Recreating failure by withholding already written code does not establish original chronology. They are moved here after locally executable work, as requested.

- [ ] T026 [US1] [TDD] Run only this slice’s new Jest files via their commands in specs/003-mcp-support/test-traceability.md and generated BDD IDs via bunx bddgen plus verified nonempty Playwright selection; prove intended missing-behavior Red, not setup/no-tests failure. Save redacted evidence in specs/003-mcp-support/tdd/cycle-log.md and update registry. Blocked vendor cases cannot count as Red/Green.

**Blocker for T026:** Original provider-schema Red is recorded in the cycle journal, but referenced raw provider-schema-red.txt is unavailable. Current native schema/consent/token tests pass; the complete original checkpoint needs contemporaneous evidence or retention-exception review.

- [ ] T270 [US2] [TDD] Extend applicable existing TDD inventory artifacts for create_overlay: TDD-US2-034 rollback and TDD-US2-041 per-operation authority/validation; TDD-US2-023–029 and TDD-US2-036–037 applicable retry key/lost-response cases, in test/mcp/integration/resource-operations.test.ts, test/mcp/integration/retries.test.ts and test/mcp/integration/revisions.test.ts as applicable. Add the actual per-verb negative/boundary cases before the adapter is implemented; do not duplicate artifacts or mark partially covered IDs Green.

**Blocker for T270:** create_overlay: expanded rollback, scope/owner authority and retry boundaries inventory is implemented and Green. The original cycle deferred some full negative catalogue cases until after the public adapter; the explicitly required complete before-adapter inventory chronology is not proven. Current Green and original narrower missing-tool Red do not recreate that history.

- [ ] T275 [US2] [TDD] Extend applicable existing TDD inventory artifacts for update_overlay: TDD-US2-034 rollback and TDD-US2-041 per-operation authority/validation; TDD-US2-038 current/missing/stale revision and atomic interface pairs, in test/mcp/integration/resource-operations.test.ts, test/mcp/integration/retries.test.ts and test/mcp/integration/revisions.test.ts as applicable. Add the actual per-verb negative/boundary cases before the adapter is implemented; do not duplicate artifacts or mark partially covered IDs Green.

**Blocker for T275:** update_overlay: expanded rollback, scope/owner authority, revisions and interface boundaries inventory is implemented and Green. The original cycle deferred some full negative catalogue cases until after the public adapter; the explicitly required complete before-adapter inventory chronology is not proven. Current Green and original narrower missing-tool Red do not recreate that history.

- [ ] T280 [US2] [TDD] Extend applicable existing TDD inventory artifacts for delete_overlay: TDD-US2-034 rollback and TDD-US2-041 per-operation authority/validation; TDD-US2-038 current/missing/stale revision and atomic interface pairs; TDD-US2-039 explicit delete scope and accurate risk hints, in test/mcp/integration/resource-operations.test.ts, test/mcp/integration/retries.test.ts and test/mcp/integration/revisions.test.ts as applicable. Add the actual per-verb negative/boundary cases before the adapter is implemented; do not duplicate artifacts or mark partially covered IDs Green.

**Blocker for T280:** delete_overlay: expanded rollback, scope/owner authority, revisions and delete-risk boundaries inventory is implemented and Green. The original cycle deferred some full negative catalogue cases until after the public adapter; the explicitly required complete before-adapter inventory chronology is not proven. Current Green and original narrower missing-tool Red do not recreate that history.

- [ ] T295 [US2] [TDD] Extend applicable existing TDD inventory artifacts for create_playlist: TDD-US2-034 rollback and TDD-US2-041 per-operation authority/validation; TDD-US2-023–029 and TDD-US2-036–037 applicable retry key/lost-response cases, in test/mcp/integration/resource-operations.test.ts, test/mcp/integration/retries.test.ts and test/mcp/integration/revisions.test.ts as applicable. Add the actual per-verb negative/boundary cases before the adapter is implemented; do not duplicate artifacts or mark partially covered IDs Green.

**Blocker for T295:** create_playlist: expanded rollback, scope/owner authority and retry boundaries inventory is implemented and Green. The original cycle deferred some full negative catalogue cases until after the public adapter; the explicitly required complete before-adapter inventory chronology is not proven. Current Green and original narrower missing-tool Red do not recreate that history.

- [ ] T297 [US2] [TDD] Run the new create_playlist Jest file cases and nonempty generated BDD selection via bunx bddgen/Playwright; verify intended unsupported behavior Red in specs/003-mcp-support/tdd/cycle-log.md. Setup/missing-step failure is not Red.

**Blocker for T297:** Original create_playlist Red was invalid_scope setup. The corrected missing-tool Red was obtained after registration already existed and was withheld. It cannot prove original before-production chronology (ENV-023).

- [ ] T300 [US2] [TDD] Extend applicable existing TDD inventory artifacts for update_playlist: TDD-US2-034 rollback and TDD-US2-041 per-operation authority/validation; TDD-US2-038 current/missing/stale revision and atomic interface pairs, in test/mcp/integration/resource-operations.test.ts, test/mcp/integration/retries.test.ts and test/mcp/integration/revisions.test.ts as applicable. Add the actual per-verb negative/boundary cases before the adapter is implemented; do not duplicate artifacts or mark partially covered IDs Green.

**Blocker for T300:** update_playlist: expanded rollback, scope/owner authority, revisions and interface boundaries inventory is implemented and Green. The original cycle deferred some full negative catalogue cases until after the public adapter; the explicitly required complete before-adapter inventory chronology is not proven. Current Green and original narrower missing-tool Red do not recreate that history.

- [ ] T305 [US2] [TDD] Extend applicable existing TDD inventory artifacts for delete_playlist: TDD-US2-034 rollback and TDD-US2-041 per-operation authority/validation; TDD-US2-038 current/missing/stale revision and atomic interface pairs; TDD-US2-039 explicit delete scope and accurate risk hints, in test/mcp/integration/resource-operations.test.ts, test/mcp/integration/retries.test.ts and test/mcp/integration/revisions.test.ts as applicable. Add the actual per-verb negative/boundary cases before the adapter is implemented; do not duplicate artifacts or mark partially covered IDs Green.

**Blocker for T305:** delete_playlist: expanded rollback, scope/owner authority, revisions and delete-risk boundaries inventory is implemented and Green. The original cycle deferred some full negative catalogue cases until after the public adapter; the explicitly required complete before-adapter inventory chronology is not proven. Current Green and original narrower missing-tool Red do not recreate that history.

- [ ] T310 [US2] [TDD] Extend applicable existing TDD inventory artifacts for add_playlist_items: TDD-US2-034 rollback and TDD-US2-041 per-operation authority/validation; TDD-US2-038 current/missing/stale revision and atomic interface pairs, in test/mcp/integration/resource-operations.test.ts, test/mcp/integration/retries.test.ts and test/mcp/integration/revisions.test.ts as applicable. Add the actual per-verb negative/boundary cases before the adapter is implemented; do not duplicate artifacts or mark partially covered IDs Green.

**Blocker for T310:** add_playlist_items: expanded rollback, scope/owner authority, revisions and interface boundaries inventory is implemented and Green. The original cycle deferred some full negative catalogue cases until after the public adapter; the explicitly required complete before-adapter inventory chronology is not proven. Current Green and original narrower missing-tool Red do not recreate that history.

- [ ] T315 [US2] [TDD] Extend applicable existing TDD inventory artifacts for remove_playlist_items: TDD-US2-034 rollback and TDD-US2-041 per-operation authority/validation; TDD-US2-038 current/missing/stale revision and atomic interface pairs, in test/mcp/integration/resource-operations.test.ts, test/mcp/integration/retries.test.ts and test/mcp/integration/revisions.test.ts as applicable. Add the actual per-verb negative/boundary cases before the adapter is implemented; do not duplicate artifacts or mark partially covered IDs Green.

**Blocker for T315:** remove_playlist_items: expanded rollback, scope/owner authority, revisions and interface boundaries inventory is implemented and Green. The original cycle deferred some full negative catalogue cases until after the public adapter; the explicitly required complete before-adapter inventory chronology is not proven. Current Green and original narrower missing-tool Red do not recreate that history.

- [ ] T320 [US2] [TDD] Extend applicable existing TDD inventory artifacts for reorder_playlist_items: TDD-US2-034 rollback and TDD-US2-041 per-operation authority/validation; TDD-US2-038 current/missing/stale revision and atomic interface pairs, in test/mcp/integration/resource-operations.test.ts, test/mcp/integration/retries.test.ts and test/mcp/integration/revisions.test.ts as applicable. Add the actual per-verb negative/boundary cases before the adapter is implemented; do not duplicate artifacts or mark partially covered IDs Green.

**Blocker for T320:** reorder_playlist_items: expanded rollback, scope/owner authority, revisions and interface boundaries inventory is implemented and Green. The original cycle deferred some full negative catalogue cases until after the public adapter; the explicitly required complete before-adapter inventory chronology is not proven. Current Green and original narrower missing-tool Red do not recreate that history.

- [ ] T243 [TDD] Add failing cases for request cancellation (TDD-US4-020), 10-second dependency timeout, privacy retention cleanup and benchmark measurement in test/mcp/integration/runtime-boundaries.test.ts, recording Red before related production changes.

**Blocker for T243:** Cancellation, deadlines, retention and measurement pass. The first valid benchmark was already Green and required no performance production change. The explicitly required historical failing benchmark cannot be fabricated.

## Blocked external release acceptance

- [ ] T247 [BDD] Materialize BDD-US1-021 with all four real-host examples in test/bdd/features/mcp-support/client-release.feature and bind test/support/mcp/client-profiles.ts through test/bdd/steps/mcp-support.steps.ts after all resource/policy/activity cycles. Run ChatGPT web, Claude web, Codex CLI and custom client read+mutation, denied consent and immediate revoke journeys; record product/date/version/protocol/registration path and actual hint UI in test-results/mcp/client-matrix/. Missing prerequisites remain Blocked, not mocked Green.

**Blocker for T247:** ChatGPT web and Claude web need purpose-created connected test accounts and an isolated publicly reachable HTTPS deployment. Codex CLI needs authenticated MCP configuration targeting it; the custom AI host needs its actual connection profile. Those prerequisites are unavailable. Local official SDK/Chromium proofs do not replace four real-host journeys.

- [ ] T249 [GATE] Execute every required command/threshold from specs/003-mcp-support/plan.md and Quality Gate Results, including full regressions, real PostgreSQL races, coverage, lint/format/types, audit/security contracts, migration policy, build and action manifest. Record actual statuses and immutable evidence once in specs/003-mcp-support/test-traceability.md; unavailable evidence blocks release.

**Blocker for T249:** All local testing/thresholds and final formatting/report verification pass. Whole release evidence remains unavailable until T247 and the twelve historical before-production obligations are resolved. No full release Green is claimed.

### Approved consent refinement

- [x] T558 Replace flat consent with HeroUI creator, permissions and review steps using English copy.
- [x] T559 Persist and enforce independent creator scopes beneath the token scope ceiling.
- [x] T560 Add explicit feedback:create consent so Read cannot submit reports.
- [x] T561 Add provider-result handoff and remote callback recovery controls.
- [x] T562 Verify real HeroUI browser behavior, callback recovery and native OAuth regressions; resolve failures before publishing.

### Approved focused editing and prompt discovery

- [x] T563 Add strict overlay editing areas and narrow read/update façades using shared backend policy.
- [x] T564 Add strict gallery editing areas and narrow read/update façades using shared backend policy.
- [x] T565 Replace private source discovery with streaming-neutral get_overlay_link; preserve explicit secret scope.
- [x] T566 Register six optional MCP prompts, server guidance and user-facing English examples using HeroUI.
- [x] T567 Migrate the public catalogue, descriptions, activity labels, documentation and existing native test callers.
- [x] T568 Verify field preservation, invalid/cross-area patches, revisions, permission/plan boundaries and SDK prompt discovery; run scoped regression and focused BDD/ATDD evidence.
- [x] T569 Complete static/build checks, update Graphify and publish this refinement to the existing draft PR.
