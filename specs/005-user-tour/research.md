# Research

## Decision: Native checklist plus Driver.js

Driver.js is installed at 1.10.2. It supplies spotlight geometry, target interaction, keyboard handling and placement. React owns tasks/progress and domain-success events. Rationale: three fixed journeys do not need a hosted authoring service. Alternatives: Usertour adds SDK/service/CSP and account configuration; hand-written geometry duplicates a mature renderer. Reviewed https://driverjs.com/docs/configuration and https://driverjs.com/docs/installation plus repository dependencies. Skill-directed read-only research agent independently recommended this split.

## Decision: Account-scoped local progress

Versioned localStorage stores IDs and task status only; no URL secrets, names or clip content. Storage errors retain usable in-memory progress. Cross-device sync deferred. Existing content-state table could support it later, but its action allowlist deliberately excludes arbitrary keys.

## Decision: Success events, opt-in spotlight

Existing handlers report success after resolved mutations, clipboard writes and nonempty preview. No automatic clicks/creation. Stable data-tour anchors avoid CSS-layout coupling. Close, Escape, missing target and unrelated navigation pause without marking completion. OBS is external: offer inline instructions and confirmation rather than trying to spotlight another application. Modal/popover compatibility requires real browser verification.
