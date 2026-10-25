# Defect Log: User tours

[Plan](plan.md) · [Traceability](test-traceability.md)

## Severity and Priority Policy

Critical: data/security loss; High: broken acceptance/accessibility; Medium: partial workflow with workaround; Low: cosmetic. Critical/High block release without explicit accepted exception.

## Defect Summary

Zero known defects at planning. Intended test-first red runs are evidence, not defects. Unexpected failures will be recorded with reproduction, source, severity, resolution and verification.

## Defect Details

None yet.

## Open Defect Review

No accepted risks or deferred defects.

## Verification and Regression Closure

Pending execution.

## Defect Metrics

Total 0; open critical/high 0; deferred 0; reopened 0; escaped 0.

## DEF-US1-001 — Incorrect JSX ternary during integration

Severity Medium, priority High. Detected by editor regression and typecheck; overlay editor could not compile. Expected successful save reports; actual SWC syntax error at new Keep saved settings ternary. Fixed misplaced closing brace. Verification pending the rerun; no exception accepted.

## DEF-US1-002 — Launcher occluded by existing feedback and consent UI

Severity High, priority High. Browser BDD-TOUR-US1-001 screenshot showed the launcher underneath Sentry feedback and the privacy banner; click waited until timeout. Fix: reserve feedback space and observe consent-banner geometry to place launcher above it, including responsive banner height. Verification pending browser rerun. Browser dependency setup failures are environment evidence, not product defects.

## DEF-US1-003 — Escape closed spotlight without pausing progress

Severity High, priority High. Browser BDD-TOUR-US1-014 failed focus/paused-state assertion. Adapter test independently reproduced a missing Escape handler. Fix: explicitly capture Escape outside application dialogs and route both Escape and close through Clipify pause; cleanup remains Driver-owned. Verification pending browser rerun. DEF-US1-002 verified by BDD-TOUR-US1-001 and BDD-TOUR-US1-002. DEF-US1-001 verified by editor tests and successful build.

## Baseline dependency audit

The high-severity audit reports the same three advisories in HEAD and feature lockfiles (follow-redirects and transitive zod). Driver.js adds none. Existing dependency remediation is outside this feature; the security gate remains blocked, with no exception accepted.

## DEF-US1-004 — Preview opened before clips finished loading

Severity Medium, priority High. BDD-TOUR-US1-003 found that the initial click could see zero clips even though the visible preview subsequently populated. Added an owner-scoped checkpoint that observes nonempty clips only while preview is open. Provider test reproduced missing checkpoint before implementation. Verification pending browser rerun.

## DEF-US2-005 — Delayed theme anchor was not observed

Severity High, priority High. BDD-TOUR-US2-018/019 found the appearance pointer absent while owner access loaded. The target attribute is added after permission loading; observer watched child insertion only. Stable-callback adapter tests reproduced missing attribute observation. Fix observes allowlisted anchor/role attributes and checks again at timeout.

## DEF-US3-006 — Spotlight blocked playlist clip-selection dialog

Severity High, priority High. BDD-TOUR-US3-020 found Driver overlay intercepting checkbox clicks. HeroUI dialog omitted aria-modal; previous detector required it. Adapter test reproduced missing pause. Fix recognizes application role=dialog while excluding Driver’s own popover, including dialogs already open at tour mount.

## Browser harness corrections

BDD-TOUR-US1-007 now waits for the dashboard create control to finish loading before injecting its controlled failed action. BDD-TOUR-US1-016 now waits for the lazy spotlight before pausing. BDD-TOUR-US3-022 uses the real accessible Overlay Type button name, which includes selected value. These were fixture/selector races rather than application defects.

Native select handoff: distinguished React Aria popovers from full modal dialogs, preserved menu pointer/keyboard interaction and paused only full dialogs. Playlist browser timing: await the mounted spotlight before opening its menu and await saved progress after the second mutation. Both final playlist scenarios pass. Audio-only theme saves no longer count as visual customization; existing volume-boundary tests prove the guard.

## UX revision regressions

The prior guide-only Save replacements have been removed by product request; the earlier syntax defect is historical and the current controls compile. Checklist default visibility, direct in-progress resume, separate skip state, next-task handoff and actual style/copy/filter anchors have regression coverage. Access-locked filter spotlight red failed 1/8 adapter tests; the guard now preserves disabled interaction. Revised affected suites pass 17/17 and 443/443 tests.

The first revised browser attempt exposed a test setup race with the delayed privacy banner: 1 passed, 2 failed, 1 interrupted, 28 unrun. The guide correctly yielded. Browser setup now rejects optional services through the installed consent UI and waits for its reload before beginning task actions. No application consent policy was weakened.

The complete revised sweep found welcome-panel overlap on normal editors (three failures), an initial Playlists tab timing race, and an optional-section test helper treating an empty open attribute as closed. The welcome panel now minimizes on inactive editor entry/navigation; task rows preserve direct resume and completed handoffs. The adapter observes actual selected-tab state and restores guidance after expected clip dialogs. Checkbox controls also have an explicit visible border for dark-mode affordance. Final source unit evidence: 17 suites / 448 tests pass.
