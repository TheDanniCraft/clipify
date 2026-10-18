# PR519 security alert disposition

Baseline: b8b72b27, refs/pull/519/head. Status: static triage complete; fresh scanner verification pending. No alert dismissal or rule suppression applied.

## SHA256 classifications

The three high-severity alerts classify operating-system keyring secrets as passwords. These sites use SHA256 for opaque local identifiers or content integrity, not password authentication. Server enrollment generates bearer tokens with randomBytes(24). The original bearer is still required for API authentication; its local identifier is not an accepted credential.

| Alert                                                                     | Location                                       | Use                                                                                                  |
| ------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [#26](https://github.com/TheDanniCraft/clipify/security/code-scanning/26) | packages/runner/src/terminal-credentials.ts:62 | Local terminal-credential record identifier derived from runner, API origin and random bearer token. |
| [#25](https://github.com/TheDanniCraft/clipify/security/code-scanning/25) | packages/runner/src/schedule-cache.ts:226      | Content-addressed private schedule payload reference, checked before signed execution validation.    |
| [#24](https://github.com/TheDanniCraft/clipify/security/code-scanning/24) | packages/runner/src/index.ts:523               | In-memory cache identity for API origin and random bearer token.                                     |

SHA256 is appropriate for these high-entropy fingerprints and integrity references. Replacing it with a password KDF would change the wrong contract; removing it would weaken the current integrity checks. These findings still need an explicit reviewed disposition if CodeQL continues to report them.

## Test source construction

Twelve medium alerts cover three native media probes that previously constructed JavaScript modules by interpolating JSON-quoted local executable and home paths. Static triage finds developer-controlled local configuration, not an attacker-controlled browser or shell boundary. The cleanup nevertheless removes that generated module source: static dependency/OS modules now read a private JSON runtime file. Actual CLI/media checks must verify the replacement.

## Evidence and limits

The canonical structured triage report is stored through the Codex Security plugin at artifacts/triage/runner-pr-519.json in this repository’s plugin artifact directory. Baseline raw alert intake is retained as evidence/F1-review-codeql-before.json. These conclusions do not replace a fresh CodeQL analysis or the runtime and coverage gates.
