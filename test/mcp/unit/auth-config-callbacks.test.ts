/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

test("installed OAuth proxy preserves production state behind container origins", () => {
	execFileSync(process.execPath, ["--test", resolve("scripts/oauth-proxy-origin.test.mjs")], { stdio: "pipe" });
});

test("installed MCP provider resumes signed authorization through login and token exchange", () => {
	execFileSync(process.execPath, ["--test", resolve("scripts/mcp-login-continuation.test.mjs")], { stdio: "pipe" });
});

jest.mock("better-auth", () => ({ betterAuth: (options: unknown) => ({ options }) }));
jest.mock("better-auth/api", () => ({
	createAuthMiddleware: (callback: unknown) => callback,
	getSessionFromCtx: jest.fn(),
	getOAuthState: jest.fn(),
	APIError: class extends Error {
		constructor(_status: string, body: { message: string }) {
			super(body.message);
		}
	},
}));
jest.mock("better-auth/next-js", () => ({ nextCookies: () => ({ id: "next-cookies" }) }));
jest.mock("@/server/runner/provider-connections", () => ({ recordStreamingAccount: jest.fn(), disconnectStreamingConnectionsForAuthAccount: jest.fn() }));
jest.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: jest.fn(() => ({})) }));
jest.mock("better-auth/plugins", () => ({ magicLink: (options: unknown) => ({ id: "magic-link", options }), emailOTP: (options: unknown) => ({ id: "email-otp", options }), oAuthProxy: (options: unknown) => ({ id: "oauth-proxy", options }), organization: (options: unknown) => ({ id: "organization", options }) }));
jest.mock("@better-auth/passkey", () => ({ passkey: (options: unknown) => ({ id: "passkey", options }) }));
jest.mock("@/db/client", () => ({ db: { select: jest.fn(), update: jest.fn() } }));
jest.mock("@/auth/organization-access", () => ({ clipifyAccessControl: {}, betterAuthOrganizationRoles: { owner: {}, operations: {}, "content-manager": {}, analyst: {}, "billing-manager": {} } }));
jest.mock("@/auth/transactional-mail", () => ({ sendAuthOtp: jest.fn(), sendTeamInvitation: jest.fn() }));
jest.mock("@/auth/providers/twitch-refresh", () => ({ refreshTwitchAccessToken: jest.fn() }));
jest.mock("@/auth/mcp-options", () => ({ createMcpPlugins: jest.fn((options: unknown) => [{ id: "native-mcp", options }]) }));
jest.mock("@/server/mcp/config", () => ({ getMcpConfiguration: () => ({ valid: true }) }));
jest.mock("@/server/mcp/grants", () => ({ providerGrantOptions: {} }));
jest.mock("@/server/notifications/twitch-account-access", () => ({ restoreTwitchAccountAccess: jest.fn() }));
jest.mock("@/server/creator-onboarding", () => ({ completeTwitchSignIn: jest.fn(), syncCreatorProfile: jest.fn() }));
import { restoreTwitchAccountAccess } from "@/server/notifications/twitch-account-access";
import { completeTwitchSignIn, syncCreatorProfile } from "@/server/creator-onboarding";
jest.mock("@/server/notifications/identity-events", () => ({ queueIdentityEmail: jest.fn() }));
import { queueIdentityEmail } from "@/server/notifications/identity-events";
import { disconnectStreamingConnectionsForAuthAccount, recordStreamingAccount } from "@/server/runner/provider-connections";
import { getSessionFromCtx, getOAuthState } from "better-auth/api";
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
	jest.mocked(getOAuthState).mockResolvedValue(null);
	rows = [];
	(db.update as jest.Mock).mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }) });
	(db.select as jest.Mock).mockImplementation(() => {
		const result = rows.shift() ?? [];
		const query: any = { from: () => query, innerJoin: () => query, where: () => query, limit: async () => result, then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject) };
		return query;
	});
	(getSessionFromCtx as jest.Mock).mockResolvedValue({ user: { id: "actor" }, session: { activeOrganizationId: "creator-org" } });
});
const plugin = (id: string) => options.plugins.find((value: any) => value.id === id).options;
const context = (body: unknown = { memberId: "target", role: "operations" }, path = "/organization/update-member-role") => ({ path, body });

test("session creation records a linked creator's returning login", async () => {
	await options.databaseHooks.session.create.after({ userId: "returning-identity" });
	expect(db.update).toHaveBeenCalledWith(require("@/db/schema").usersTable);
	expect((db.update as jest.Mock).mock.results[0].value.set).toHaveBeenCalledWith({ lastLogin: expect.any(Date) });
});

test("Twitch account creation completes onboarding; token refresh alone does not", async () => {
	await options.databaseHooks.account.create.after({ providerId: "twitch", userId: "identity", accountId: "creator" }, undefined);
	expect(completeTwitchSignIn).toHaveBeenCalledWith("creator", "identity");
	(completeTwitchSignIn as jest.Mock).mockClear();
	await options.databaseHooks.account.create.after({ providerId: "credential", userId: "identity" }, undefined);
	await options.databaseHooks.account.update.after({ providerId: "twitch", userId: "identity", accountId: "creator" }, undefined);
	expect(completeTwitchSignIn).not.toHaveBeenCalled();
});

test("returning Twitch callback retries onboarding", async () => {
	await options.databaseHooks.account.update.after({ providerId: "twitch", userId: "identity", accountId: "creator" }, { path: "/callback/twitch" });
	expect(completeTwitchSignIn).toHaveBeenCalledWith("creator", "identity");
});

test("Runner channel linking records the destination without onboarding another creator", async () => {
	jest.mocked(getOAuthState).mockResolvedValue({ link: { userId: "identity" }, runnerConnectionIntent: { provider: "twitch" } } as never);
	const account = { id: "runner-account", providerId: "twitch", userId: "identity", accountId: "channel", scope: "channel:read:stream_key" };
	await options.databaseHooks.account.create.after(account, { path: "/callback/twitch" });
	expect(recordStreamingAccount).toHaveBeenCalledWith(account, { provider: "twitch" });
	expect(completeTwitchSignIn).not.toHaveBeenCalled();
	expect(restoreTwitchAccountAccess).not.toHaveBeenCalled();
});

test("account deletion cleans up Runner channel references after the account is deleted", async () => {
	const account = { id: "runner-account", providerId: "google", userId: "identity", accountId: "channel" };
	await expect(options.databaseHooks.account.delete.before(account)).resolves.toBeUndefined();
	await options.databaseHooks.account.delete.after(account, undefined);
	expect(disconnectStreamingConnectionsForAuthAccount).toHaveBeenCalledWith({ id: "runner-account", userId: "identity" });
});

test("account deletion refuses the creator's primary Twitch identity", async () => {
	rows.push([{ creatorId: "creator" }]);
	await expect(options.databaseHooks.account.delete.before({ id: "primary", providerId: "twitch", userId: "identity", accountId: "creator" })).rejects.toThrow("Your primary Twitch account is required for Clipify.");
	expect(disconnectStreamingConnectionsForAuthAccount).not.toHaveBeenCalled();
});

test("auth identity updates synchronize the linked creator through our function", async () => {
	await options.databaseHooks.user.update.after({ id: "identity", email: "current@example.test" }, undefined);
	expect(syncCreatorProfile).toHaveBeenCalledWith("identity");
});

test("provider configuration uses native MCP grant options", () => {
	expect(options.account.encryptOAuthTokens).toBe(true);
	expect(options.account.storeStateStrategy).toBe("database");
	expect(options.session.cookieCache.enabled).toBe(false);
	expect(plugin("oauth-proxy").productionURL).toBe("http://localhost:3000");
	expect(plugin("oauth-proxy").currentURL).toBe("http://localhost:3000");
	expect(plugin("passkey")).toMatchObject({ rpID: "localhost", origin: "http://localhost:3000" });
	expect(plugin("native-mcp")).toEqual({ origin: "http://localhost:3000", options: providerGrantOptions });
});
test.each([
	[undefined, undefined, false],
	["google-client", undefined, false],
	[undefined, "google-secret", false],
	["   ", "google-secret", false],
	["google-client", "   ", false],
	[" google-client ", " google-secret ", true],
])("Google proxy configuration requires both credentials (%p, %p)", (clientId, clientSecret, enabled) => {
	const previous = { ...process.env };
	try {
		delete process.env.YOUTUBE_CLIENT_ID;
		delete process.env.YOUTUBE_CLIENT_SECRET;
		if (clientId !== undefined) process.env.YOUTUBE_CLIENT_ID = clientId;
		if (clientSecret !== undefined) process.env.YOUTUBE_CLIENT_SECRET = clientSecret;
		process.env.NEXT_PUBLIC_BASE_URL = "https://clipify.us";
		process.env.OAUTH_PROXY_SECRET = "fixture-shared-oauth-proxy-secret-32chars";
		jest.isolateModules(() => {
			const configured = require("@/auth/config").auth.options;
			expect(configured.socialProviders.twitch).toEqual(options.socialProviders.twitch);
			expect(configured.account.accountLinking).toEqual(options.account.accountLinking);
			const proxy = configured.plugins.find((value: any) => value.id === "oauth-proxy").options;
			expect(proxy).toMatchObject({ currentURL: "https://clipify.us", productionURL: "https://clipify.us", secret: process.env.OAUTH_PROXY_SECRET });
			if (enabled) {
				expect(configured.socialProviders.google).toEqual({ clientId: "google-client", clientSecret: "google-secret", accessType: "offline", prompt: "consent", disableSignUp: true });
			} else {
				expect(configured.socialProviders.google).toBeUndefined();
			}
		});
	} finally {
		process.env = previous;
	}
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
test("all OTP types use the provider delivery callback", async () => {
	const ordinary = { email: "actor@example.invalid", otp: "fixture-otp", type: "sign-in" };
	await plugin("email-otp").sendVerificationOTP(ordinary);
	expect(sendAuthOtp).toHaveBeenCalledWith(ordinary);
	(sendAuthOtp as jest.Mock).mockClear();
	await plugin("email-otp").sendVerificationOTP({ ...ordinary, type: "change-email" });
	expect(sendAuthOtp).toHaveBeenCalledWith({ ...ordinary, type: "change-email" });
});

test.each(["https://preview.example.invalid", "https://clipify.us"])("configuration pins OAuth proxy current origin to %s", (origin) => {
	const previousBase = process.env.NEXT_PUBLIC_BASE_URL;
	const previousProxy = process.env.OAUTH_PROXY_SECRET;
	try {
		process.env.NEXT_PUBLIC_BASE_URL = origin;
		process.env.OAUTH_PROXY_SECRET = " isolated-preview-proxy-secret ";
		jest.isolateModules(() => {
			const preview = require("@/auth/config").auth.options;
			expect(preview.plugins.find((item: any) => item.id === "oauth-proxy").options).toMatchObject({ currentURL: origin, productionURL: "https://clipify.us", secret: "isolated-preview-proxy-secret" });
			expect(preview.plugins.find((item: any) => item.id === "passkey").options).toMatchObject({ rpID: new URL(origin).hostname, origin });
		});
	} finally {
		if (previousBase === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
		else process.env.NEXT_PUBLIC_BASE_URL = previousBase;
		if (previousProxy === undefined) delete process.env.OAUTH_PROXY_SECRET;
		else process.env.OAUTH_PROXY_SECRET = previousProxy;
	}
});

test("welcome is queued on account creation even before email verification, not profile updates", async () => {
	const user = { id: "new-user", email: "alex@example.test", name: "Alex", emailVerified: false };
	await options.databaseHooks.user.create.after(user);
	expect(queueIdentityEmail).toHaveBeenNthCalledWith(1, user.email, { type: "welcome", name: "Alex" }, "welcome:new-user");
	expect(queueIdentityEmail).toHaveBeenCalledTimes(1);
	(queueIdentityEmail as jest.Mock).mockClear();
	await options.databaseHooks.user.update.after(user, undefined);
	expect(queueIdentityEmail).not.toHaveBeenCalled();
});
test("passkey success queues a specific notice and unsuccessful deletion sends nothing", async () => {
	(getSessionFromCtx as jest.Mock).mockResolvedValue({ user: { id: "actor", email: "alex@example.test" } });
	await options.hooks.after({ path: "/passkey/verify-registration", context: { returned: { id: "passkey-1" } } });
	expect(queueIdentityEmail).toHaveBeenCalledWith("alex@example.test", { type: "security", change: "passkey-added" }, expect.any(String));
	(queueIdentityEmail as jest.Mock).mockClear();
	await options.hooks.after({ path: "/passkey/delete-passkey", context: { returned: { status: false } } });
	expect(queueIdentityEmail).not.toHaveBeenCalled();
	await options.hooks.after({ path: "/passkey/delete-passkey", context: { returned: { status: true } } });
	expect(queueIdentityEmail).toHaveBeenCalledWith("alex@example.test", { type: "security", change: "passkey-removed" }, expect.any(String));
});
test("membership hooks notify the affected member, not the administrator", async () => {
	await plugin("organization").organizationHooks.afterAcceptInvitation({ user: { email: "member@example.test" }, organization: { name: "Creator Agency" }, invitation: { id: "invite-1" } });
	await plugin("organization").organizationHooks.afterRemoveMember({ user: { email: "member@example.test" }, organization: { name: "Creator Agency" }, member: { id: "member-1" } });
	expect(queueIdentityEmail).toHaveBeenCalledWith("member@example.test", { type: "organization-membership", organizationName: "Creator Agency", status: "joined" }, "organization-joined:invite-1");
	expect(queueIdentityEmail).toHaveBeenCalledWith("member@example.test", { type: "organization-membership", organizationName: "Creator Agency", status: "removed" }, "organization-removed:member-1");
});

test("email changes notify both the old and new addresses; unchanged addresses do not send a notice", async () => {
	const user = { id: "actor", email: "new@example.test", name: "Alex", emailVerified: true };
	await options.databaseHooks.user.update.after(user, { context: { session: { user: { email: "old@example.test" } } } });
	expect(queueIdentityEmail).toHaveBeenCalledWith("old@example.test", { type: "security", change: "email-changed" }, expect.stringMatching(/:old$/));
	expect(queueIdentityEmail).toHaveBeenCalledWith("new@example.test", { type: "security", change: "email-changed" }, expect.stringMatching(/:new$/));
	(queueIdentityEmail as jest.Mock).mockClear();
	await options.databaseHooks.user.update.after(user, { context: { session: { user: { email: user.email } } } });
	expect(queueIdentityEmail).not.toHaveBeenCalled();
});

test("only the successful Twitch OAuth callback restores automatically disabled creator access", async () => {
	await options.databaseHooks.account.update.after({ providerId: "twitch", userId: "identity" }, { path: "/callback/twitch" });
	expect(restoreTwitchAccountAccess).toHaveBeenCalledWith("identity");
	(restoreTwitchAccountAccess as jest.Mock).mockClear();
	await options.databaseHooks.account.update.after({ providerId: "twitch", userId: "identity" }, { path: "/get-access-token" });
	expect(restoreTwitchAccountAccess).not.toHaveBeenCalled();
});

test("native parameterized Twitch callbacks also restore access on account creation", async () => {
	await options.databaseHooks.account.create.after({ providerId: "twitch", userId: "identity" }, { path: "/callback/:id", params: { id: "twitch" } });
	expect(restoreTwitchAccountAccess).toHaveBeenCalledWith("identity");
});

test("explicit linking permits different provider emails without merging users or changing the local profile", () => {
	expect(options.account.accountLinking).toMatchObject({ enabled: true, disableImplicitLinking: true, allowDifferentEmails: true, updateUserInfoOnLink: false });
	expect(options.plugins.at(-1).id).toBe("next-cookies");
});
test.each(["create", "update"])("%s account hook associates only the current user's explicit Runner intent", async (operation) => {
	const account = { id: "account", userId: "actor", providerId: "google", scope: "https://www.googleapis.com/auth/youtube.force-ssl" };
	jest.mocked(getOAuthState).mockResolvedValue({ link: { userId: "actor", email: "actor@example.invalid" }, runnerConnectionIntent: "intent" } as any);
	await options.databaseHooks.account[operation].after(account, { path: "/callback/:id/oauth-proxy" });
	expect(recordStreamingAccount).toHaveBeenCalledWith(account, "intent");
	jest.mocked(recordStreamingAccount).mockClear();
	jest.mocked(getOAuthState).mockResolvedValue({ link: { userId: "foreign", email: "foreign@example.invalid" }, runnerConnectionIntent: "intent" } as any);
	await options.databaseHooks.account[operation].after(account, { path: "/callback/:id" });
	expect(recordStreamingAccount).not.toHaveBeenCalled();
});
test("expected missing grants complete as a recoverable connection failure; unexpected storage failures remain visible", async () => {
	const { ProviderRequestError } = await import("@/server/runner/provider-api");
	jest.mocked(getOAuthState).mockResolvedValue({ link: { userId: "actor", email: "actor@example.invalid" }, runnerConnectionIntent: "intent" } as any);
	jest.mocked(recordStreamingAccount).mockRejectedValueOnce(new ProviderRequestError("RECONNECT_REQUIRED"));
	await expect(options.databaseHooks.account.create.after({ id: "account", userId: "actor", providerId: "google" }, { path: "/callback/:id" })).resolves.toBeUndefined();
	jest.mocked(recordStreamingAccount).mockRejectedValueOnce(new Error("ACCESS_DENIED"));
	await expect(options.databaseHooks.account.create.after({ id: "account", userId: "actor", providerId: "google" }, { path: "/callback/:id" })).resolves.toBeUndefined();
	jest.mocked(recordStreamingAccount).mockRejectedValueOnce(new Error("storage failed"));
	await expect(options.databaseHooks.account.create.after({ id: "account", userId: "actor", providerId: "google" }, { path: "/callback/:id" })).rejects.toThrow("storage failed");
});
test("ordinary login without a saved streaming grant keeps normal credential updates", async () => {
	await options.user.validateUserInfo({ user: { id: "actor" }, source: { action: "create-user", method: "oauth", oauth: { providerId: "twitch", profile: { sub: "42" } } } });
	await options.user.validateUserInfo({ user: { id: "actor" }, source: { action: "sign-in", method: "oauth", oauth: { providerId: "google", profile: { sub: "42" } } } });
	await options.user.validateUserInfo({ user: { id: "actor" }, source: { action: "sign-in", method: "oauth", oauth: { providerId: "twitch", profile: { sub: "42" } } } });
	const state = { callbackURL: "/dashboard", codeVerifier: "fixture", expiresAt: Date.now() + 1000 };
	jest.mocked(getOAuthState).mockResolvedValue(state);
	rows.push([{ scope: "openid,user:read:email" }]);
	await options.user.validateUserInfo({ user: { id: "actor" }, source: { action: "sign-in", method: "oauth", oauth: { providerId: "twitch", profile: { sub: "42" } } } });
	expect(state).not.toHaveProperty("serverContext");
	expect(await options.databaseHooks.account.update.before({ providerId: "twitch", accessToken: "new-token" }, { path: "/callback/:id" })).toBeUndefined();
	expect(await options.databaseHooks.account.update.before({ providerId: "google" }, { path: "/callback/:id" })).toBeUndefined();
	expect(await options.databaseHooks.account.update.before({ providerId: "twitch" }, { path: "/get-access-token" })).toBeUndefined();
});
