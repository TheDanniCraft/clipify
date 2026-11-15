/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("better-auth/api", () => ({
	createAuthMiddleware: (value: unknown) => value,
	APIError: class extends Error {
		constructor(_status: string, body: { error: string }) {
			super(body.error);
		}
	},
}));
jest.mock("@better-auth/oauth-provider", () => ({ getOAuthProviderApi: jest.fn() }));
jest.mock("better-auth/plugins", () => ({ jwt: (options: unknown) => ({ id: "jwt", options }) }));
jest.mock("@better-auth/mcp", () => ({ mcp: (options: unknown) => ({ id: "provider", options }) }));
jest.mock("@better-auth/cimd", () => ({ cimd: (options: unknown) => ({ id: "cimd", options }) }));
jest.mock("@better-auth/cimd/node", () => ({ fetchClientMetadataResource: jest.fn() }));
jest.mock("@/auth/session", () => ({ getAuthActorContext: jest.fn() }));
jest.mock("@/db/client", () => ({ db: { select: jest.fn() } }));
import { createMcpPlugins } from "@/auth/mcp-options";
import { getAuthActorContext } from "@/auth/session";
import { db } from "@/db/client";
const origin = "https://clipify.test";
const resource = `${origin}/api/connected-apps`;
const provider = (options: Record<string, unknown> = {}) => createMcpPlugins({ origin, options } as never).find((item) => item.id === "provider")!.options as Record<string, any>;

test("adds a scope-bounded machine resource while preserving existing grants and registration", () => {
	const options = provider();
	expect(options.grantTypes).toEqual(["authorization_code", "refresh_token", "client_credentials"]);
	expect(options.resources).toContainEqual({ identifier: resource, allowedScopes: ["creator:read"], accessTokenTtl: 300 });
	expect(options.clientRegistrationDefaultResources).toBeUndefined();
	expect(options.clientRegistrationAllowedResources).toBeUndefined();
	expect(options.allowDynamicClientRegistration).toBe(true);
});

test("stamps only machine tokens for the exact application resource", async () => {
	const claims = provider().customAccessTokenClaims;
	await expect(claims({ user: undefined, scopes: ["creator:read"], resources: [resource] })).resolves.toEqual({ clipify_application: true });
});

test.each([
	["no audience", { resources: undefined }],
	["MCP audience", { resources: [`${origin}/mcp`] }],
	["foreign audience", { resources: ["https://other.test/api/connected-apps"] }],
	["multiple audiences", { resources: [resource, `${origin}/mcp`] }],
	["empty scopes", { scopes: [] }],
	["extra scope", { scopes: ["creator:read", "overlay:update"] }],
	["user grant reference", { referenceId: "user-grant" }],
	["deleted user", { user: null }],
	["user token", { user: { id: "user" } }],
])("rejects a machine claim with %s", async (_label, overrides) => {
	await expect(provider().customAccessTokenClaims({ user: undefined, scopes: ["creator:read"], resources: [resource], ...overrides })).rejects.toThrow("invalid_grant");
});
test("retains the configured user/MCP grant callback and ordinary user claims", async () => {
	const callback = jest.fn().mockResolvedValue({ clipify_grant_id: "user-grant", clipify_grant_generation: 2 });
	const info = { user: { id: "user" }, referenceId: "user-grant", scopes: ["creator:read"], resources: [`${origin}/mcp`] };
	await expect(provider({ customAccessTokenClaims: callback }).customAccessTokenClaims(info)).resolves.toEqual({ clipify_grant_id: "user-grant", clipify_grant_generation: 2 });
	expect(callback).toHaveBeenCalledWith(info);
});

test("machine scope provisioning requires an independently verified administrator", async () => {
	const options = provider();
	await expect(options.clientPrivileges({ headers: new Headers(), action: "configure-client-credentials-scopes" })).resolves.toBe(false);
});

test("ordinary MCP client creation retains existing access", async () => {
	await expect(provider().clientPrivileges({ headers: new Headers(), action: "create" })).resolves.toBe(true);
});
test("protected resource administration fails closed without an admin", async () => {
	await expect(provider().resourcePrivileges({ headers: new Headers(), action: "create" })).resolves.toBe(false);
});
test("additional configured privilege denials remain effective", async () => {
	const deny = jest.fn().mockResolvedValue(false);
	await expect(provider({ clientPrivileges: deny }).clientPrivileges({ headers: new Headers(), action: "create" })).resolves.toBe(false);
	expect(deny).toHaveBeenCalledTimes(1);
});

test("verified own-identity admins can provision machine scopes and link resources", async () => {
	jest.mocked(getAuthActorContext).mockResolvedValue({ authUserId: "admin-auth", accountStatus: "active", user: { id: "admin-creator", role: "admin", disabled: false } } as never);
	const query = { from: () => query, where: () => query, limit: async () => [{ creatorId: "admin-creator" }] };
	jest.mocked(db.select).mockReturnValue(query as never);
	const options = provider();
	await expect(options.clientPrivileges({ headers: new Headers(), action: "configure-client-credentials-scopes" })).resolves.toBe(true);
	await expect(options.resourcePrivileges({ headers: new Headers(), action: "link", resourceId: resource })).resolves.toBe(true);
});
