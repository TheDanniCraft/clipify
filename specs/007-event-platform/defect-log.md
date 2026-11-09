# Defect Log

## Summary

Zero confirmed product defects at planning. No risk exceptions accepted.

## Severity and priority

Critical/high: authorization leaks, wrong winners, lost submissions/votes, broken core show. Block completion. Medium: recoverable broken required flow; fix before release. Low: cosmetic issue not blocking operation.

## Defect details and triage

None yet. Environment failures recorded separately with exact commands and expected/actual outcome.

## Verification and release impact

Each discovered issue records reproduction, fix, verifying evidence and closure. No Go until required boundaries pass.

## ENV-001 — Sandbox TypeScript subprocess output

Command: whole-file Jest for existing consentOrigins and new event policy. Expected: baseline tests, then missing events module. Actual: Next cannot parse empty TypeScript --showConfig subprocess output before Jest executes. Not a product Red. Node 26.13.0 is available and direct compiler output works. Retrying same scoped command outside sandbox; no configuration or threshold changes.

ENV-001 resolved: same existing suite passes 3/3 outside sandbox using Node 26.13.0. Commands must use escalated execution in this workspace for Next subprocess capture.

FIXTURE-001: PGlite event fixture omitted schema `defaultRandom()` equivalent; corrected to `DEFAULT gen_random_uuid()`. No production defect or relaxed assertion.
