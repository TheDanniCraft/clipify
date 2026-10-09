# MCP discovery launch preparation

Research date: 2026-10-09. Branch: `feature/mcp-discovery-launch`, based on
master `5911f82` (release v4.1.0).

This is a preparation plan, not a submitted listing or a production verification.
Production testing follows the Coolify update. All integrations use the same
Streamable HTTP endpoint, `https://clipify.us/mcp`, and existing Better Auth OAuth.

## Distribution targets

| Target                | Submission                                             | Result                                                                  |
| --------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| OpenAI                | Public plugin package and hosted MCP review            | Shared ChatGPT/Codex directory listing                                  |
| Anthropic             | Remote MCP connector; optionally a workflow plugin too | Claude connector discovery, with an optional packaged skills experience |
| Official MCP Registry | Remote-only `server.json` and publisher authentication | Searchable server metadata; separate from vendor approval               |

## Shared preparation work

Implemented locally: all 66 public tools now advertise the shared English activity
titles. All writes have conservative confirmation hints, including creation and
feedback; public publication and stream broadcasts also advertise external effects.
Native protocol discovery and the full schema risk catalog are covered by focused
tests. Titles, descriptions, permissions, publication flags and annotations now live
in `src/server/mcp/catalogue.ts`; schemas and handlers remain separate. Registration,
activity labels and authorization mappings derive from that catalog. Directory acceptance and production client UX still require verification.

1. Maintain every advertised tool's title, description, schemas and risk annotations.
   `src/server/mcp/tools.ts` now supplies shared English titles, with native
   `tools/list` coverage for focused and workflow tools as well as core tools.
2. Verify a documented annotation difference before submission: Anthropic asks
   for `destructiveHint: true` on modifications as well as deletions. Creates now
   carry this conservative hint too. Check the confirmation UX in both
   vendors. Anthropic also requires names of at most 64 characters and narrow
   descriptions. [Anthropic review checklist](https://claude.com/docs/connectors/building/review-criteria)
3. Prepare a public MCP setup guide, English listing copy, logo, support contact,
   privacy and terms links, and representative example prompts. Explain Free/Pro
   availability and existing backend limits accurately. Link to the actual tool
   catalog instead of duplicating a stale catalog in listing copy.
4. Prepare a dedicated populated reviewer account with disposable creators,
   overlays and playlists. Establish whether Twitch sign-in works without an
   interactive verification challenge for reviewers. This is an unresolved
   submission prerequisite, not evidence that OAuth itself is broken.
5. Preserve creator-specific consent, revocation and plan enforcement. Discovery
   packaging must not grant additional permissions or embed credentials.

## OpenAI: ChatGPT and Codex

Use the current plugin submission system: its public directory is shared by
ChatGPT and Codex. Upload a ZIP containing MCP configuration initially, resolve
automated findings, submit for review, then explicitly publish after approval.
Do not start with a skills-only ZIP if the listing needs MCP. Public packages
cannot use lifecycle hooks or app-reference configurations.
[OpenAI submission guide](https://developers.openai.com/plugins/deploy/submission)

Prepare a portable package with `plugin.json`, `mcp.json`, assets and optional
`skills/<workflow>/SKILL.md`. Point its Streamable HTTP configuration at the
production endpoint. Use workflow skills for practical guidance such as previewing
a clip import or changing an overlay theme; do not duplicate backend logic.
Validate against the current package schemas before making the upload ZIP.
[OpenAI package format](https://developers.openai.com/plugins/build/plugins)

The publisher needs individual or business identity verification and submission
permissions. Use a global-residency project. The hosted endpoint must be public,
and reviewers need a demo login without email/SMS/MFA verification. Supply logo,
privacy/company URLs and reproducible test prompts/results. Test on both advertised
surfaces. Review has no guaranteed turnaround. Tool hints must reflect actual
effects, including irreversible actions and external access.
[OpenAI MCP review requirements](https://developers.openai.com/plugins/deploy/app-review)

No domain challenge file was identified in these OpenAI requirements; follow any
additional ownership instructions shown by the submission portal. Custom MCP
connections and local plugin installation are useful tests, not public approval.

## Anthropic: Claude web and Claude Code

Submit **MCP connector** at <https://claude.ai/directory/manage>. Supply the HTTPS
endpoint, sync tools, complete listing/company/authentication/data-handling fields,
use cases and populated test credentials. A paid Claude plan is required for
submission. Plain tools do not need a custom UI or UI screenshots. Community and
Verified listings have different review paths; neither status is guaranteed.
[Connector submission guide](https://claude.com/docs/connectors/building/submission)

Keep DCR/CIMD rather than hardcoding vendor identities. Verify discovery, PKCE,
refresh rotation and revocation. CIMD needs the appropriate authorization-server
metadata. Test the web callback `https://claude.ai/api/mcp/auth_callback` and native
callbacks on both `localhost` and `127.0.0.1` with ephemeral ports. These tests must
use the registered redirect URI validation, not a permissive workaround.
[Anthropic authentication guide](https://claude.com/docs/connectors/building/authentication)

Optionally submit a **Plugin bundle** for packaged workflow skills. The portal
reads a GitHub repository, checks push access, and accepts a subfolder containing
`.claude-plugin/plugin.json`. Run `claude plugin validate` first. The repository
must be public before listing publication, and each revision is validated. A
plugin referencing our server still requires a separate connector submission.
Approved plugins can be used in chat, Cowork and Claude Code.
[Plugin submission guide](https://claude.com/docs/plugins/submit)

Plugins enabled on claude.ai can sync into Claude Code; locally installed Code
plugins do not automatically appear in the web account. Verify both entry paths
with the same Clipify account and their actual OAuth flows.
[Claude Code plugin management](https://code.claude.com/docs/en/discover-plugins)

## Official MCP Registry

Publish a remote-only entry using the current schema
`https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`.
Use a `remotes` entry with `type: streamable-http` and our production URL; no npm
package or local server distribution is required. Registry publication verifies
the name's namespace, not control of the endpoint. The Registry remains documented
as preview, and publishing there does not replace the two vendor submissions.
[Remote server publication](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/remote-servers.mdx)

Prefer the proposed domain namespace `us.clipify/clipify`, subject to availability.
Choose either DNS proof on the `clipify.us` apex or HTTP proof at
`https://clipify.us/.well-known/mcp-registry-auth`. The proof contains a public key;
the signing private key stays outside the repository. GitHub authentication is
an alternative, with a namespace derived from the authenticated account rather
than the Clipify domain. Publisher authentication is separate from customer OAuth.
[Registry ownership authentication](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/authentication.mdx)

Prepare `server.json` with name, title, a description of at most 100 characters,
version, repository and remote endpoint. Install the official `mcp-publisher`, run
`validate`, authenticate, then `publish` when authorized. Confirm the resulting
entry through the Registry API. Recheck current schemas at publication time.
[Registry publishing quickstart](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx)

## Execution order and acceptance gate

1. Prepare metadata fixes, listing material, package artifacts and reviewer data.
   Keep OpenAI and Claude manifests separate, while sharing descriptions/assets.
2. Deploy the released version through Coolify. Verify production OAuth discovery
   and `401` challenges, then initialize/list/call tools with an authorized client.
3. Test ChatGPT web, Codex, Claude web and Claude Code. Include fresh-user Twitch
   onboarding, per-creator Read/Write/Custom consent, refresh, revoked access,
   rejected permissions, plan limits and create/edit/delete on dedicated data.
   Capture expected and actual results for reviewer prompts.
4. Finish publisher verification, reviewer access and Registry ownership proof.
5. Submit the vendor listings and publish Registry metadata independently once
   their gates pass. Track approval separately from submission; publish approved
   listings and verify installation from each directory.

Suggested reviewer prompts: "List my overlays"; "Change this overlay's theme";
"Preview my Minecraft clips from yesterday before adding them to a playlist";
"Show what is playing and set the volume to 30%"; and a confirmed deletion of a
disposable overlay. Select prompts that match the account's permissions and plan.

Remaining external dependencies: production deployment; publisher portal access
and identity verification; a paid Claude submission account; usable reviewer login;
DNS or hosted public-key proof; and vendor review outcomes. None requires replacing
the MCP server or implementing a second OAuth system.
