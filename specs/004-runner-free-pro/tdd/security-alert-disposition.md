# PR519 security alert disposition

Current reviewed source: 4be68ca38f0057eb783685894ad7f02e0ae2c091, refs/pull/519/head. Fresh CodeQL confirms all 12 generated-source alerts cleared. Three SHA256 classifications remain open:24,26,27. Static triage finds each not actionable with high confidence. No alert state changed and no scanner rule was suppressed.

## SHA256 classifications

The three high-severity alerts classify operating-system keyring secrets as passwords. These sites use SHA256 for opaque local identifiers or content integrity, not password authentication. Server enrollment generates bearer tokens with randomBytes(24). The original bearer is still required for API authentication; its local identifier is not an accepted credential.

| Alert                                                                     | Location                                       | Use                                                                                                  |
| ------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [#26](https://github.com/TheDanniCraft/clipify/security/code-scanning/26) | packages/runner/src/terminal-credentials.ts:62 | Local terminal-credential record identifier derived from runner, API origin and random bearer token. |
| [#27](https://github.com/TheDanniCraft/clipify/security/code-scanning/27) | packages/runner/src/schedule-cache.ts:227      | Content-addressed private schedule payload reference, checked before signed execution validation.    |
| [#24](https://github.com/TheDanniCraft/clipify/security/code-scanning/24) | packages/runner/src/index.ts:590               | In-memory cache identity for API origin and random bearer token.                                     |

SHA256 is appropriate for these high-entropy fingerprints and integrity references. Replacing it with a password KDF would change the wrong contract; removing it would weaken the current integrity checks. These findings still need an explicit reviewed disposition if CodeQL continues to report them.

## Test source construction

Twelve medium alerts cover three native media probes that previously constructed JavaScript modules by interpolating JSON-quoted local executable and home paths. Static triage finds developer-controlled local configuration, not an attacker-controlled browser or shell boundary. The cleanup nevertheless removes that generated module source: static dependency/OS modules now read a private JSON runtime file. The actual five-scenario native multistream owner passes after the replacement, and the complete native owner passes450 cases on f75e1091. Follow-up native refactors require refreshed qualification.

## Evidence and limits

The canonical structured triage report is stored through the Codex Security plugin at artifacts/triage/runner-pr-519.json in this repository’s plugin artifact directory. Baseline raw alert intake is retained as evidence/F1-review-codeql-before.json. These conclusions do not replace a fresh CodeQL analysis or the runtime and coverage gates.

## Exact GitHub disposition proposal

Fresh analysis assigns #27 to the extracted restorePrivateJob content-address check previously reported as #25. The security contract is unchanged: retain hashes the serialized private payload, restore checks its content address, and usable jobs still require separately verified signed manifest/execution bindings. The current structured triage is evidence/F1-review-final-security-triage.json; its canonical plugin artifact is artifacts/triage/runner-pr-519-final.json (SHA256 9dc705d73a520c1fbb01989646c83eb2217ab01330f9a2d99944798ef8b25182).

The concrete proposal in github-disposition-proposal.json changes only alerts #24, #26 and #27 to dismissed with reason false positive and an individual evidence comment. It leaves the hashing, bearer authentication, signed payload validation and scanner rules intact. Dismissal removes those records from the open alert queue; this is a reviewed classification decision, not a claim that password KDFs are unnecessary for real passwords.

Automatic approval review rejected that external security-state mutation as outside current authorization. No PATCH request executed, and a read-only recheck confirms all three records remain open. Obtain the user's explicit approval for these exact dispositions before writeback; do not retry or use an indirect workaround. Until then QG-11 and the five story/full-validation gates remain blocked.
