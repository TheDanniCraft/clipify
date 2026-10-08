# MCP product workflow extension

> Consolidated MCP server scope: 66 tools on `feature/mcp-support`. The original foundation, workflow expansion, feedback and focused editing tools belong to this one feature/PR. Marketplace submission remains out of scope. Expansion task IDs are T406–T541; original IDs and blockers are preserved. Historical workflow records are in [history/workflows/README.md](history/workflows/README.md). Workflow requirement/scenario identities use the `WF-` documentation namespace to distinguish them from the original IDs; executable Gherkin IDs and retained logs are unchanged.

User-requested extension recorded 2026-10-07. This document defines upcoming work; it does not claim that the extension is implemented or tested and does not change the original implementation evidence.

## Existing baseline

At initial expansion planning, the 15-tool catalogue supported creators/capabilities, overlay configuration including theme fields, playlist CRUD and playlist item management. Adding playlist items currently requires clip IDs. That foundation used broad overlay updates. The approved focused refinement now exposes 66 tools, including dedicated theme reads/updates; see contracts/tool-index.md.

## Requested scope and implementation order

1. **Complete existing remote-control feature parity:** expose playback state, current clip, elapsed progress, connection health, play/resume, pause, skip, visibility, live volume, queue inspection, adding moderator clips, and existing queue-clear operations. Inventory the actual controller before finalizing the catalogue. Reuse existing command transport and player reports; identify overlay-specific versus creator-wide effects explicitly. Return timestamps and stale/offline state, and distinguish command acceptance from observed application. Preserve current remote-control Pro entitlement in shared backend policy and require explicit control scopes. Queue clearing receives destructive annotations. Do not invent seek/replay or other controls absent from the product without a separate requirement.
2. **Clip resolution and discovery:** accept validated Twitch clip links and IDs; resolve titles using bounded discovery within the authorized creator's clips, returning candidates for ambiguous titles. Support time intervals, explicit timezone, category, title query, view/duration filters, sorting and pagination. Use existing Twitch fetching and category metadata; do not pretend titles are unique or that all search results are exhaustive. Clearly report partial pagination/provider failures.
3. **Preview then import:** support requests such as “add all my Minecraft clips from yesterday.” Preview the exact matched clips with titles/links, duplicates, excluded items, remaining quota and proposed additions. Commit an immutable, expiring selection scoped to the creator and playlist, bound to filters and target revision, with idempotency and authorization/entitlement/quota revalidation. Never silently add newer matches beyond the preview. Let the host present the preview and obtain the user's requested confirmation; a preview identifier alone does not prove human approval. Distinguish one-off bulk import from persistent automatic-import configuration, preserving each existing feature's entitlement.
4. **Galleries and embeds:** authorized gallery reads/creation/update/deletion, publication configuration, public preview and appropriate embed snippets/URLs. Reuse existing gallery services and backend limits. Public website embeds must not expose private overlay/controller credentials. Where OBS/browser-source URLs are required, return them only through explicitly authorized operations and label their sensitive purpose. A coding agent may integrate snippets into its authorized workspace; MCP alone cannot modify an arbitrary website.
5. **Creator Pages:** expose existing editable branding, content and publication settings after inventorying the actual product fields and entitlements. Provide preview/public URLs, revision-aware writes and explicit publication actions.
6. **Runner workflows:** check Pro before setup; provide official platform-appropriate download/install instructions, enrollment guidance and runner registration status. Preserve human installation/enrollment steps and the existing secure enrollment flow. Add authorized runner/session listing, configuration, desired stream start/stop, observed status and current preview snapshot, with freshness/availability metadata. Reuse runner heartbeat/preview/session services; distinguish desired state from observed streaming. Keep runner tokens, stream keys and provider credentials out of ordinary tool output and audit payloads; sensitive configuration requires a specifically designed input flow. Starting a broadcast is a consequential action requiring distinct consent scope and clear tool description. Local installation is only possible when the host independently has user-authorized machine access.

## Deferred scope

Team administration, billing/subscription changes and account/security mutation tools are undecided and excluded from this extension. Read-only plan/capability information already supports entitlement-aware workflows. Revisit these areas only with concrete user workflows and separately scoped authority.

## Cross-cutting requirements

- Use the current official MCP SDK and Better Auth OAuth integration, extending existing scopes and consent descriptions; existing approvals do not silently acquire new authority.
- Apply the same resource permissions, current creator plan, limits, lifecycle checks, revisions, idempotency and audit policy to browser and MCP operations.
- Inventory existing feature behavior before deriving formal requirements and tasks. Follow test-first planning and focused validation; keep original test totals and historical blockers distinct from extension evidence.
- Add acceptance coverage for wrong creator/scope, revoked access, Free/Pro boundaries, stale previews/state, concurrency, duplicate retries and credential-free results.
- Update capabilities/tool documentation, llms content, relevant pricing feature descriptions and Graphify after implementation. Pricing must describe actual entitlements; inclusion of MCP does not make Pro-only workflows Free.

## Next workflow

Fold this extension into the feature specification, derive architecture and dependency-ordered test-first tasks, then implement the requested phases. Do not mark extension tasks complete based on the original 15-tool validation.

## Consolidation

This accepted expansion is implemented within `003-mcp-support`; see canonical tasks T406–T541 and the workflow sections in spec.md, plan.md and contracts/tools.md. Historical separate artifacts are preserved in history/workflows/.
