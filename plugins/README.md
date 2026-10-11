# Clipify OpenAI package

The `clipify/` directory contains the portable plugin uploaded to OpenAI's
Plugins dashboard. Its version describes the package, independently of app releases.
It connects to the production MCP endpoint using OAuth discovery configured in the submission portal. Permissions are selected in Clipify's consent UI.

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
