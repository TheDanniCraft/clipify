# Research decisions

- Use Better Auth machine credentials and a separate operation resource; existing /mcp grants require a user and must stay unchanged. Installed provider supports client_credentials, resource policy and explicit client scope ceilings. Registration alone is not a creator grant.
- Provision with a real verified admin session (operator CLI reads a session-cookie file). Never fabricate a session or impersonate creator. Client/resource privilege hooks guard machine/resource administration while retaining existing MCP behaviour.
- Shared cached clip search is extracted from the existing search_clips implementation, preserving pagination and completeness. Only search_clips is exposed to machines.
- SDK is a versioned independent package consumed by tarball in the Awards context; no imports of private application modules. Its existing provider/token protocol is hidden behind clips.search.
- Milestone is headless; no material product-page change and no Mobbin/UI design work. Existing show branch/source untouched.
- Awards PostgreSQL checks connectivity but needs no schema or application data for this milestone. Compose has no PostgreSQL ports and no shared Clipify database network. HTTP exists only for local fixtures; production SDK requires HTTPS.
