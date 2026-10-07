# Research decisions

- Existing browser actions cannot be called under OAuth and must share trusted-principal services instead. Reuse authorizeLockedMutation and owner-bound queries.
- Websocket playback reports already exist; retain authenticated known fields in bounded shared state and report freshness.
- Galleries use Clipify Elements; unsupported raw iframe and /gallery/:id links must not be advertised.
- Runner access is independent of Pro. Preserve RunnerAccess/allocation entitlement and existing device-enrollment flow. Never project tokens/stream keys.
- New gallery/settings concurrency must also cover browser writers. Use schema-owned revision columns where absent; no generated migration files.
- Exact import preview must bind principal/grant and target revision, expire, and commit only its original IDs. Provider resolution occurs before resource locks; final commit revalidates authority and quota.
- Marketplace work is a later PR/release task.

Runner access is required for setup/creation/configuration/control, matching existing product policy. Existing record reads/deletion/unlink do not require an active add-on. Unlink retains the existing runner-credential:rotate permission; it never returns a credential.
