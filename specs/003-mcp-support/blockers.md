# MCP merge blockers and deployment follow-up

Updated: 2026-10-08. PR #496 is no longer draft.

## Current merge status

No known unresolved implementation defect remains. Preview OAuth, creator
isolation, refresh rotation and all 35 disposable create/edit/delete, retry,
revision, validation and plan-limit checks passed; original resources were
restored. Full CI passed at the retained checkpoint (436 suites / 4,603 tests,
11 existing skips). The CodeQL generated-test-path finding was fixed in
`ecae530`; GitHub confirms alert #9 is fixed and its review thread is resolved.
Fresh final-head CI must finish successfully before declaring GitHub merge-ready.

The user explicitly approved the twelve historical evidence exceptions and
their dependent T249 release disposition on 2026-10-08. See
[merge-readiness-review.md](merge-readiness-review.md) for scope, owner, risk,
compensating evidence and expiry. This does not establish original test-first
chronology or waive any runtime, security, coverage or migration check.

## Nonblocking production rollout check: T577

The external health collector must map and ingest the new MCP metrics after
production deployment. Real Grafana/Influx fixture validation accepted the full
81-panel v6 dashboard and 360 queries; the deployed datasource accepts all 12
new MCP queries. Its bucket currently has ordinary health fields but no MCP
fields. Actual production ingestion remains unverified.

Owner: TheDanniCraft / collector operator. Due: first MCP metrics production
rollout, before declaring monitoring operational. Follow
[grafana/mcp-monitoring.md](../../grafana/mcp-monitoring.md) and the deployment
checklist in merge-readiness-review.md. T577 remains unchecked and is explicitly
approved as nonblocking for code merge.

## Acceptance scope and historical record

The user accepted Codex-driven preview validation in place of the original
four-host matrix. ChatGPT/Claude/another host, physical runner playback and live
UI revocation are not claimed as preview-tested; automated protocol and
revocation contracts remain passing coverage. Marketplace submissions belong
to a later PR.

The pre-approval record is preserved in
[history/core/blockers-before-approval-2026-10-08.md](history/core/blockers-before-approval-2026-10-08.md).
Its outdated grant and host prerequisites are historical, superseded by the
successful full-scope preview acceptance and explicit approved disposition.
