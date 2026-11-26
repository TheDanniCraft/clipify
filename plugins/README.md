# Clipify assistant plugins

The `clipify/` directory contains one plugin for both OpenAI and Claude Code.
Both connect to the production MCP endpoint `https://clipify.us/mcp` using
OAuth discovery with dynamic client registration. Permissions are selected in
Clipify's consent UI. The package version describes the plugin, independently
of app releases. Keep both manifests on the same version.

| File                                                      | Used by                 |
| --------------------------------------------------------- | ----------------------- |
| `clipify/plugin.json`, `clipify/mcp.json`                 | OpenAI                  |
| `clipify/.claude-plugin/plugin.json`, `clipify/.mcp.json` | Claude Code             |
| `clipify/assets/logo.png`                                 | Both                    |
| `../.claude-plugin/marketplace.json`                      | Claude Code marketplace |

## Claude Code

The repository root is a Claude Code marketplace named `clipify`. Users install with:

```text
/plugin install clipify --marketplace TheDanniCraft/clipify
```

or, in two steps, `/plugin marketplace add TheDanniCraft/clipify` followed by
`/plugin install clipify@clipify`. After installing, `/mcp` starts the Clipify
sign-in. Claude Code uses a loopback `http://localhost:<port>/callback` redirect,
which Clipify's client registration accepts.

The Validate Claude Plugin workflow runs `claude plugin validate --strict` on
the plugin and the marketplace, and checks that both manifests share a version.
To check locally:

```sh
npx -y @anthropic-ai/claude-code plugin validate ./plugins/clipify --strict
npx -y @anthropic-ai/claude-code plugin validate . --strict
```

To list the plugin in Anthropic's directory (claude.ai, Cowork, and Claude Code
as `clipify@synced`), a paid Claude plan submits it at
https://claude.ai/directory/manage under **Submit new → Plugin bundle**, pointing
at the public `plugins/clipify` folder on `master`. Anthropic runs automated
validation, a safety scan, and a human review. The directory reads the listing
fields (`icon`, `documentationUrl`, `supportUrl`, `privacyPolicyUrl`,
`termsOfServiceUrl`) from `.claude-plugin/plugin.json`. Listing the MCP server
as a claude.ai connector is a separate **MCP connector** submission in the same
portal.

Claude Code documentation:

- https://code.claude.com/docs/en/plugins/manifest-reference
- https://code.claude.com/docs/en/plugins/create-marketplace
- https://code.claude.com/docs/en/plugins/publish

## OpenAI

The OpenAI Plugin workflow validates the manifests against the vendored Agent
Plugins 1.0.0 schemas and builds a ZIP with its manifests at the archive root.
Download the workflow artifact, extract the artifact wrapper, then upload
`clipify-openai-plugin.zip`. The workflow runs when package-related changes
reach master, or through manual dispatch. It does not publish or submit the plugin.

To build locally, install `jsonschema==4.26.0` in a Python virtual environment
and run `python scripts/package-openai-plugin.py /tmp/clipify-openai-plugin.zip`.

Before submission, complete publisher verification, domain verification,
reviewer access, a walkthrough video, and five positive plus three negative
review test cases in the portal. Credentials must never be included in the ZIP.
The [OpenAI review guide](openai-review-guide.md) contains the agreed test cases,
recording steps, reviewer sign-in instructions, and package release notes.
The automated checks validate package structure, not OpenAI review approval or
the live server's OAuth behavior.

Schema sources:

- https://agent-plugins.org/schemas/1.0.0/plugin.schema.json
- https://agent-plugins.org/schemas/1.0.0/mcp.schema.json

OpenAI packaging and submission documentation:

- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/submission

The published MCP 1.0.0 schema does not allow server extensions, although
OpenAI documentation shows an auth extension. Keep the portable MCP manifest
schema-compatible and select OAuth with automatic registration in the portal.
