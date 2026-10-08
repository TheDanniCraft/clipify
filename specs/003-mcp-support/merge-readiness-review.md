# MCP merge-readiness review — 2026-10-08

PR #496 is ready for review. The current code has no known unresolved failing
test or preview defect. This review proposes a feature-specific evidence
exception; approval is pending, and historical tasks remain unchecked until
approval is recorded.

## Proposed historical evidence exception

- Scope: T026, T243, T270, T275, T280, T295, T297, T300, T305, T310,
  T315 and T320 in feature 003 only; their dependent release-review task T249
  can close after approval. This does not change future test-first requirements.
- Rationale: the original raw provider-schema failure log is unavailable;
  some complete negative inventories were exercised after public adapters;
  the corrected playlist missing-tool failure cannot establish original
  chronology; the initial valid benchmark already passed. Additional preview
  runs cannot reconstruct these historical facts.
- Risk: reduced confidence in original test-first discipline and retention,
  rather than an identified current runtime defect. Existing historical
  disclosures and cycle logs remain retained, with no retrospective failure
  evidence invented.
- Compensating evidence: full CI on `0d981247b8fab73fe4f2542b9b2605373fad9373`
  ([run 37812676896](https://github.com/TheDanniCraft/clipify/actions/runs/37812676896))
  passes 436 Jest suites and 4,603 tests, existing coverage thresholds, BDD,
  ATDD, acceptance, formatting, lint, types, build, migration policy, CodeQL
  and CodeFactor. Eleven existing tests remain skipped. Code is identical to
  the separately verified `66e0ed7` checkpoint. Actual preview DCR/PKCE login,
  creator isolation, refresh rotation and 35 disposable create/edit/delete,
  retry, revision, validation and plan-limit checks passed. Originals were
  restored. See verification-2026-10-08.md and preview-testing.md.
- Owner: TheDanniCraft approves the scoped exception; Codex records the
  disposition and preserves the evidence references.
- Expiry: this exception ends with the merge decision for PR #496 and applies
  only to these historical obligations. It grants no exemption to runtime
  tests, CI thresholds, security checks, migration policy or future features.
- Follow-up: retain any recovered contemporaneous logs if available; no
  manufactured historical Red is required or permitted.

## Proposed deployment follow-up

T577 remains an external rollout check rather than a code merge prerequisite.
Its task already permits recording unavailable external access without blocking
local completion. Production collector configuration is external to this repo
and the new app fields are not yet deployed there. Actual Influx ingestion is
not claimed.

The full 81-panel Grafana v6 artifact imported successfully in disposable real
Grafana/Influx services, with 360 fixture queries accepted. The deployed
datasource also accepted all 12 MCP queries; its bucket currently has ordinary
health fields but no MCP fields. Before declaring monitoring rollout complete,
the collector operator must:

1. Deploy the app through the normal merge, schema and release workflows.
2. Apply the mapping in grafana/mcp-monitoring.md to the external collector,
   preserving numeric float types and stable per-process scrape tags.
3. Confirm real MCP fields and client slots in `clipify_monitor`, then validate
   the complete v6 dashboard against those points.

Owner: TheDanniCraft / the production collector operator. Due: first production
rollout of MCP metrics, before claiming production monitoring is operational.
The rollout check stays visibly open even if approved as nonblocking for merge.

## GitHub readiness

PR #496 was marked ready for review on 2026-10-08. GitHub reports the branch as
mergeable (no conflicts); all applicable reported checks pass at `0d98124`.
Inspection of the actual ruleset and review threads found one open CodeQL
`js/bad-code-sanitization` alert (#9), despite the successful CodeQL check.
The candidate fix removes filesystem-path interpolation from generated test
JavaScript, resolving the sibling output path statically through `import.meta.url`.
Both database-budget lanes pass (two tests, each running three fixture tests),
focused ESLint and diff checks pass, and ordinary/special-character path
resolution is preserved. GitHub must confirm the alert is fixed on the next
analysis before this security blocker can close; no alert dismissal is proposed.

Approval status: **pending explicit user approval** of the historical exception
and the monitoring rollout classification above.
