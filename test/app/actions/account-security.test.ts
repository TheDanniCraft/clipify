jest.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "session=test" }) }));
jest.mock("@/auth/config", () => ({ auth: { api: { getSession: jest.fn(), createVerificationOTP: jest.fn(), requestEmailChangeEmailOTP: jest.fn(), getVerificationOTP: jest.fn() } } }));
jest.mock("@/auth/transactional-mail", () => ({ sendAuthOtp: jest.fn() }));

import { requestCurrentEmailChangeCode, requestNewEmailChangeCode } from "@/app/actions/account-security";

const { auth } = jest.requireMock("@/auth/config") as { auth: { api: { getSession: jest.Mock; createVerificationOTP: jest.Mock; requestEmailChangeEmailOTP: jest.Mock; getVerificationOTP: jest.Mock } } };
const { sendAuthOtp } = jest.requireMock("@/auth/transactional-mail") as { sendAuthOtp: jest.Mock };
const { getSession, createVerificationOTP, requestEmailChangeEmailOTP, getVerificationOTP } = auth.api;

describe("account security actions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getSession.mockResolvedValue({ user: { email: "Current@Example.com" } });
		createVerificationOTP.mockResolvedValue("123456");
		requestEmailChangeEmailOTP.mockResolvedValue({ success: true });
		getVerificationOTP.mockResolvedValue({ otp: "654321" });
		sendAuthOtp.mockResolvedValue(undefined);
	});

	it("sends the current-address code synchronously", async () => {
		await requestCurrentEmailChangeCode();

		expect(sendAuthOtp).toHaveBeenCalledWith({ email: "current@example.com", otp: "123456", type: "email-verification" });
	});

	it("propagates provider delivery failures to the caller", async () => {
		sendAuthOtp.mockRejectedValueOnce(new Error("provider rejected sender"));

		await expect(requestCurrentEmailChangeCode()).rejects.toThrow("provider rejected sender");
	});

	it("verifies the current address and sends the new-address code", async () => {
		await requestNewEmailChangeCode(" New@Example.com ", " 123456 ");

		expect(requestEmailChangeEmailOTP).toHaveBeenCalledWith(expect.objectContaining({ body: { newEmail: "new@example.com", otp: "123456" } }));
		expect(getVerificationOTP).toHaveBeenCalledWith({ query: { email: "current@example.com-new@example.com", type: "change-email" } });
		expect(sendAuthOtp).toHaveBeenCalledWith({ email: "new@example.com", otp: "654321", type: "change-email" });
	});
});
