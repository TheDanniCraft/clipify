jest.mock("@/server/primary-twitch-account", () => ({ isPrimaryTwitchAccount: jest.fn().mockResolvedValue(false) }));
jest.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "session=test" }) }));
jest.mock("@/auth/config", () => ({ auth: { api: { getSession: jest.fn(), listUserAccounts: jest.fn(), getAccessToken: jest.fn(), unlinkAccount: jest.fn(), sendVerificationOTP: jest.fn(), requestEmailChangeEmailOTP: jest.fn() } } }));

import { isPrimaryTwitchAccount } from "@/server/primary-twitch-account";
import { disconnectLinkedAccount, requestCurrentEmailChangeCode, requestNewEmailChangeCode } from "@/app/actions/account-security";
const { auth } = jest.requireMock("@/auth/config") as { auth: { api: { getSession: jest.Mock; listUserAccounts: jest.Mock; getAccessToken: jest.Mock; unlinkAccount: jest.Mock; sendVerificationOTP: jest.Mock; requestEmailChangeEmailOTP: jest.Mock } } };
const nativeFetch = global.fetch;

describe("account security actions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.mocked(isPrimaryTwitchAccount).mockResolvedValue(false);
		auth.api.getSession.mockResolvedValue({ user: { id: "identity", email: "Current@Example.com" }, session: { createdAt: new Date() } });
		auth.api.listUserAccounts.mockResolvedValue([
			{ id: "google-account", providerId: "google" },
			{ id: "twitch-account", providerId: "twitch" },
		]);
		auth.api.getAccessToken.mockResolvedValue({ accessToken: "private-access-token" });
		auth.api.unlinkAccount.mockResolvedValue({ status: true });
		auth.api.sendVerificationOTP.mockResolvedValue({ success: true });
		auth.api.requestEmailChangeEmailOTP.mockResolvedValue({ success: true });
		global.fetch = jest.fn().mockResolvedValue({ ok: true });
	});
	afterAll(() => {
		global.fetch = nativeFetch;
	});
	it("uses Better Auth to generate, store and deliver the current-address code", async () => {
		await requestCurrentEmailChangeCode();
		expect(auth.api.sendVerificationOTP).toHaveBeenCalledWith(expect.objectContaining({ headers: expect.any(Headers), body: { email: "current@example.com", type: "email-verification" } }));
	});
	it("uses the native email-change endpoint to verify the old address and deliver the new code", async () => {
		await requestNewEmailChangeCode(" New@Example.com ", " 123456 ");
		expect(auth.api.requestEmailChangeEmailOTP).toHaveBeenCalledWith(expect.objectContaining({ headers: expect.any(Headers), body: { newEmail: "new@example.com", otp: "123456" } }));
	});
	it("requires a signed-in identity before requesting codes", async () => {
		auth.api.getSession.mockResolvedValue(null);
		await expect(requestCurrentEmailChangeCode()).rejects.toThrow("AUTHENTICATION_REQUIRED");
		await expect(requestNewEmailChangeCode("new@example.com", "123456")).rejects.toThrow("AUTHENTICATION_REQUIRED");
		expect(auth.api.sendVerificationOTP).not.toHaveBeenCalled();
		expect(auth.api.requestEmailChangeEmailOTP).not.toHaveBeenCalled();
	});
	it("keeps the primary Twitch identity and tokens without attempting provider revocation", async () => {
		jest.mocked(isPrimaryTwitchAccount).mockResolvedValue(true);
		expect(await disconnectLinkedAccount("twitch-account")).toMatchObject({ success: false, code: "PRIMARY_ACCOUNT_REQUIRED" });
		expect(global.fetch).not.toHaveBeenCalled();
		expect(auth.api.getAccessToken).not.toHaveBeenCalled();
		expect(auth.api.unlinkAccount).not.toHaveBeenCalled();
	});

	it("revokes provider access before unlinking the account", async () => {
		expect(await disconnectLinkedAccount("google-account")).toEqual({ success: true, providerId: "google" });
		expect(global.fetch).toHaveBeenCalledWith("https://oauth2.googleapis.com/revoke", expect.objectContaining({ method: "POST", body: expect.any(URLSearchParams) }));
		expect(auth.api.unlinkAccount).toHaveBeenCalledWith(expect.objectContaining({ body: { accountId: "google-account" } }));
		expect((global.fetch as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(auth.api.unlinkAccount.mock.invocationCallOrder[0]);
	});
	it("requires recent authentication before revoking anything", async () => {
		auth.api.getSession.mockResolvedValue({ user: { id: "identity", email: "Current@Example.com" }, session: { createdAt: new Date(Date.now() - 6 * 60_000) } });
		expect(await disconnectLinkedAccount("google-account")).toEqual(expect.objectContaining({ success: false, code: "REAUTHENTICATION_REQUIRED", reauthProvider: "google" }));
		expect(global.fetch).not.toHaveBeenCalled();
		expect(auth.api.unlinkAccount).not.toHaveBeenCalled();
	});
	it("turns a late Better Auth freshness rejection into reauthentication", async () => {
		auth.api.unlinkAccount.mockRejectedValue({ body: { code: "SESSION_NOT_FRESH", message: "Session is not fresh" } });
		expect(await disconnectLinkedAccount("google-account")).toEqual({ success: false, code: "REAUTHENTICATION_REQUIRED", error: "Sign in again before disconnecting this account.", reauthProvider: "google" });
	});
	it("preserves the linked account when provider revocation fails", async () => {
		global.fetch = jest.fn().mockResolvedValue({ ok: false });
		expect(await disconnectLinkedAccount("google-account")).toEqual(expect.objectContaining({ success: false, code: "REVOCATION_FAILED" }));
		expect(auth.api.unlinkAccount).not.toHaveBeenCalled();
	});
	it("allows the final social account to be removed because email-code sign-in remains available", async () => {
		auth.api.listUserAccounts.mockResolvedValue([{ id: "google-account", providerId: "google" }]);
		expect(await disconnectLinkedAccount("google-account")).toEqual({ success: true, providerId: "google" });
		expect(auth.api.unlinkAccount).toHaveBeenCalled();
	});
	it("does not expose the action as a way to remove non-social credentials", async () => {
		auth.api.listUserAccounts.mockResolvedValue([{ id: "credential-account", providerId: "credential" }]);
		expect(await disconnectLinkedAccount("credential-account")).toEqual(expect.objectContaining({ success: false, code: "ACCOUNT_NOT_FOUND" }));
		expect(auth.api.unlinkAccount).not.toHaveBeenCalled();
	});
});
