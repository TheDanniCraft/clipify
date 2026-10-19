# Plan

Reuse existing account-wide destinations, server-action authorization and calendar occurrence identity. Keep provider grants separate from Clipify sign-in. Persist encrypted grants and one-use OAuth state; use provider-owned channel identity, never browser-supplied channel IDs. Add typed per-destination event metadata and dispatch records per occurrence. Preserve metadata across recurrence splitting. Apply only at the occurrence start, not during seven-day schedule-cache authorization. No generated migrations on this branch.

Tests precede implementation. Run whole-file scoped checks during development, affected suites/browser journeys at slice completion, final application/Runner gates before release. Live provider approval and real accounts remain deployment verification; local tests use deterministic provider responses and disposable loopback PostgreSQL.
