import { FixtureBuilder } from "../auth-engine-rewrite/database";
export const actorFixture = new FixtureBuilder({ id: "auth-mcp-actor", email: "mcp@example.invalid", name: "MCP fixture", emailVerified: true });
export const creatorFixture = new FixtureBuilder({ id: "mcp-creator", organizationId: "mcp-creator-org", name: "Fixture creator", status: "active" });
export const agencyFixture = new FixtureBuilder({ organizationId: "mcp-agency-org", status: "active", permissionCeiling: ["creator:read", "overlay:read"] });
export const clientFixture = new FixtureBuilder({ client_name: "Controlled MCP client", redirect_uris: ["http://127.0.0.1:49999/callback"], application_type: "native", token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] });
