jest.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "session=test" }) }));
jest.mock("@/auth/config", () => ({ auth: { api: { getSession: jest.fn(), sendVerificationOTP: jest.fn(), requestEmailChangeEmailOTP: jest.fn() } } }));

import { requestCurrentEmailChangeCode, requestNewEmailChangeCode } from "@/app/actions/account-security";
const { auth } = jest.requireMock("@/auth/config") as { auth: { api: { getSession: jest.Mock; sendVerificationOTP: jest.Mock; requestEmailChangeEmailOTP: jest.Mock } } };

describe("account security actions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		auth.api.getSession.mockResolvedValue({ user: { email: "Current@Example.com" } });
		auth.api.sendVerificationOTP.mockResolvedValue({ success: true });
		auth.api.requestEmailChangeEmailOTP.mockResolvedValue({ success: true });
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
});
