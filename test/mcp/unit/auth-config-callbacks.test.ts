/** @jest-environment node */
jest.mock("better-auth", () => ({ betterAuth: (options: unknown) => ({ options }) }));
jest.mock("better-auth/api", () => ({
	createAuthMiddleware: (callback: unknown) => callback,
	getSessionFromCtx: jest.fn(),
	APIError: class extends Error {
		constructor(_status: string, body: { message: string }) {
			super(body.message);
		}
	},
}));
jest.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: jest.fn(() => ({})) }));
jest.mock("better-auth/plugins", () => ({ magicLink: (options: unknown) => ({ id: "magic-link", options }), emailOTP: (options: unknown) => ({ id: "email-otp", options }), oAuthProxy: (options: unknown) => ({ id: "oauth-proxy", options }), organization: (options: unknown) => ({ id: "organization", options }) }));
jest.mock("@better-auth/passkey", () => ({ passkey: (options: unknown) => ({ id: "passkey", options }) }));
jest.mock("@/db/client", () => ({ db: { select: jest.fn() } }));
jest.mock("@/auth/organization-access", () => ({ clipifyAccessControl: {}, betterAuthOrganizationRoles: { owner: {}, operations: {}, "content-manager": {}, analyst: {}, "billing-manager": {} } }));
jest.mock("@/auth/transactional-mail", () => ({ sendAuthOtp: jest.fn(), sendTeamInvitation: jest.fn() }));
jest.mock("@/auth/providers/twitch-refresh", () => ({ refreshTwitchAccessToken: jest.fn() }));
jest.mock("@/auth/mcp-options", () => ({ createMcpPlugins: jest.fn((options: unknown) => [{ id: "native-mcp", options }]) }));
jest.mock("@/server/mcp/config", () => ({ getMcpConfiguration: () => ({ valid: true }) }));
jest.mock("@/server/mcp/grants", () => ({ providerGrantOptions: {} }));
import { getSessionFromCtx } from "better-auth/api";
import { db } from "@/db/client";
import { sendAuthOtp, sendTeamInvitation } from "@/auth/transactional-mail";
import { providerGrantOptions } from "@/server/mcp/grants";

const savedEnvironment = { ...process.env };
let options: any;
let rows: unknown[][];
beforeAll(() => {
	Object.assign(process.env, { APP_ENV: "test", NEXT_PUBLIC_BASE_URL: "http://localhost:3000", BETTER_AUTH_SECRET: "isolated-config-callback-secret-32chars", TWITCH_CLIENT_ID: "fixture-client", TWITCH_CLIENT_SECRET: "fixture-secret" });
	options = require("@/auth/config").auth.options;
});
afterAll(() => {
	process.env = { ...savedEnvironment };
});
beforeEach(() => {
	jest.clearAllMocks();
	rows = [];
	(db.select as jest.Mock).mockImplementation(() => {
		const result = rows.shift() ?? [];
		const query: any = { from: () => query, innerJoin: () => query, where: () => query, limit: async () => result, then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject) };
		return query;
	});
	(getSessionFromCtx as jest.Mock).mockResolvedValue({ user: { id: "actor" }, session: { activeOrganizationId: "creator-org" } });
});
const plugin = (id: string) => options.plugins.find((value: any) => value.id === id).options;
const context = (body: unknown = { memberId: "target", role: "operations" }, path = "/organization/update-member-role") => ({ path, body });

test("provider configuration uses native MCP grant options", () => {
	expect(options.account.encryptOAuthTokens).toBe(true);
	expect(options.session.cookieCache.enabled).toBe(false);
	expect(plugin("oauth-proxy").productionURL).toBe("http://localhost:3000");
	expect(plugin("passkey")).toMatchObject({ rpID: "localhost", origin: "http://localhost:3000" });
	expect(plugin("native-mcp")).toEqual({ origin: "http://localhost:3000", options: providerGrantOptions });
});
test("unrelated auth endpoints do not run role-assignment reads", async () => {
	await options.hooks.before(context({}, "/sign-in/social"));
	expect(getSessionFromCtx).not.toHaveBeenCalled();
	expect(db.select).not.toHaveBeenCalled();
});
test.each([{ role: null, memberId: "target" }, { role: ["operations", 42], memberId: "target" }, { role: "operations" }])("invalid role request %p does not query membership", async (body) => {
	await options.hooks.before(context(body));
	expect(db.select).not.toHaveBeenCalled();
});
test.each(["missing-session", "missing-organization", "missing-member"])("role hook %s does not perform assignment", async (mode) => {
	if (mode === "missing-session") (getSessionFromCtx as jest.Mock).mockResolvedValue(null);
	if (mode === "missing-organization") (getSessionFromCtx as jest.Mock).mockResolvedValue({ user: { id: "actor" }, session: {} });
	await expect(options.hooks.before(context())).resolves.toBeUndefined();
	expect(db.select).toHaveBeenCalledTimes(mode === "missing-member" ? 1 : 0);
});
test("owner can update a standard role after current actor and target lookup", async () => {
	rows.push([{ id: "actor-member", role: "owner" }], [{ id: "target" }]);
	await expect(options.hooks.before(context({ organizationId: "creator-org", memberId: "target", role: ["operations", "analyst"] }))).resolves.toBeUndefined();
	expect(db.select).toHaveBeenCalledTimes(2);
});
test("non-owner self role update is denied", async () => {
	rows.push([{ id: "actor-member", role: "operations" }], [{ id: "actor-member" }]);
	await expect(options.hooks.before(context())).rejects.toThrow("SELF_ROLE_UPDATE_DENIED");
});
test.each(["valid", "invalid-json"])("dynamic %s role permissions come from current organization rows", async (mode) => {
	rows.push([{ id: "actor-member", role: "owner" }], [{ id: "target" }], [{ role: "custom-reader", permission: mode === "valid" ? JSON.stringify({ overlay: ["read"] }) : "invalid" }]);
	await expect(options.hooks.before(context({ memberId: "target", role: "custom-reader" }))).resolves.toBeUndefined();
	expect(db.select).toHaveBeenCalledTimes(3);
});
test("invitation role escalation is denied without a target-member lookup", async () => {
	rows.push([{ id: "actor-member", role: "operations" }]);
	await expect(options.hooks.before(context({ role: "billing-manager" }, "/organization/invite-member"))).rejects.toThrow("ROLE_PERMISSION_ESCALATION_DENIED");
	expect(db.select).toHaveBeenCalledTimes(1);
});
test.each([undefined, {}, { invitationId: 42 }])("invitation delivery without valid metadata %p does nothing", async (metadata) => {
	await plugin("magic-link").sendMagicLink({ email: "target@example.invalid", url: "https://clipify.example/accept", metadata });
	expect(db.select).not.toHaveBeenCalled();
	expect(sendTeamInvitation).not.toHaveBeenCalled();
});
test.each([{ rows: [] }, { rows: [{ invitationEmail: "other@example.invalid", organizationName: "Other" }] }])("invitation delivery ignores missing or mismatched stored recipient", async ({ rows: result }) => {
	rows.push(result);
	await plugin("magic-link").sendMagicLink({ email: "target@example.invalid", url: "https://clipify.example/accept", metadata: { invitationId: "invite" } });
	expect(sendTeamInvitation).not.toHaveBeenCalled();
});
test("invitation delivery uses the stored case-insensitive recipient and organization", async () => {
	rows.push([{ invitationEmail: "Target@example.invalid", organizationName: "Creator team" }]);
	await plugin("magic-link").sendMagicLink({ email: "target@example.invalid", url: "https://clipify.example/accept", metadata: { invitationId: "invite" } });
	expect(sendTeamInvitation).toHaveBeenCalledWith({ email: "Target@example.invalid", invitationUrl: "https://clipify.example/accept", organizationName: "Creator team" });
});
test("ordinary OTP delegates to transactional delivery while change-email remains synchronous elsewhere", async () => {
	const ordinary = { email: "actor@example.invalid", otp: "fixture-otp", type: "sign-in" };
	await plugin("email-otp").sendVerificationOTP(ordinary);
	expect(sendAuthOtp).toHaveBeenCalledWith(ordinary);
	(sendAuthOtp as jest.Mock).mockClear();
	await plugin("email-otp").sendVerificationOTP({ ...ordinary, type: "change-email" });
	expect(sendAuthOtp).not.toHaveBeenCalled();
});

test("remote preview configuration uses production OAuth proxy with trimmed dedicated secret", () => {
	const previousBase = process.env.NEXT_PUBLIC_BASE_URL;
	const previousProxy = process.env.OAUTH_PROXY_SECRET;
	try {
		process.env.NEXT_PUBLIC_BASE_URL = "https://preview.example.invalid";
		process.env.OAUTH_PROXY_SECRET = " isolated-preview-proxy-secret ";
		jest.isolateModules(() => {
			const preview = require("@/auth/config").auth.options;
			expect(preview.plugins.find((item: any) => item.id === "oauth-proxy").options).toMatchObject({ productionURL: "https://clipify.us", secret: "isolated-preview-proxy-secret" });
			expect(preview.plugins.find((item: any) => item.id === "passkey").options).toMatchObject({ rpID: "preview.example.invalid", origin: "https://preview.example.invalid" });
		});
	} finally {
		if (previousBase === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
		else process.env.NEXT_PUBLIC_BASE_URL = previousBase;
		if (previousProxy === undefined) delete process.env.OAUTH_PROXY_SECRET;
		else process.env.OAUTH_PROXY_SECRET = previousProxy;
	}
});
