/** @jest-environment node */
import { getAnalyticsIdentity } from "@/app/actions/analytics";
const principal = jest.fn();
const user = jest.fn();
const entitlements = jest.fn();
const sign = jest.fn().mockResolvedValue("signed-proof");
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: () => principal() }));
jest.mock("@actions/auth", () => ({ validateAuth: () => user() }));
jest.mock("@lib/entitlements", () => ({ resolveUserEntitlements: () => entitlements() }));
jest.mock("@lib/consent/backend", () => ({ getConsentServerKey: () => "signing-key" }));
jest.mock("@c15t/node-sdk", () => ({ createIdentityToken: (...args: unknown[]) => sign(...args) }));

beforeEach(() => {
	jest.clearAllMocks();
	principal.mockResolvedValue({ authUserId: "verified-auth-id" });
	user.mockResolvedValue({ id: "twitch-id" });
	entitlements.mockResolvedValue({ effectivePlan: "pro", source: "reverse_trial", isBillingPro: false });
});
it("returns only verified authentication identity and coarse access context", async () => {
	await expect(getAnalyticsIdentity()).resolves.toEqual({ id: "verified-auth-id", identityToken: "signed-proof", plan: "pro", access_source: "reverse_trial", is_paying: false });
	expect(sign).toHaveBeenCalledWith({ externalId: "verified-auth-id" }, { signingKey: "signing-key", ttlSeconds: 300 });
});
it("does not identify an unauthenticated visitor or administrator impersonation", async () => {
	principal.mockResolvedValueOnce(null);
	await expect(getAnalyticsIdentity()).resolves.toBeNull();
	user.mockResolvedValueOnce({ id: "other", adminView: { actorId: "admin" } });
	await expect(getAnalyticsIdentity()).resolves.toBeNull();
	expect(sign).not.toHaveBeenCalled();
});
