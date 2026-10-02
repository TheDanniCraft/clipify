/** @jest-environment node */

jest.mock("usesend-js", () => {
	const send = jest.fn();
	return { UseSend: jest.fn().mockImplementation(() => ({ emails: { send } })), __mockSend: send };
});

import { sendAuthOtp, sendTeamInvitation, UseSendTransactionalMailAdapter } from "@/auth/transactional-mail";

const { UseSend: mockUseSend, __mockSend: mockSend } = jest.requireMock("usesend-js") as { UseSend: jest.Mock; __mockSend: jest.Mock };

describe("TDD-US3-007 UseSend transactional mail adapter", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.USESEND_API_KEY = "test-api-key";
		process.env.USESEND_BASE_URL = "https://mail.example.test///";
		process.env.USESEND_TRANSACTIONAL_FROM = "Clipify <auth@clipify.us>";
		process.env.USESEND_TRANSACTIONAL_REPLY_TO = "contact@clipify.us";
		mockSend.mockResolvedValue({ data: { emailId: "email-1" }, error: null });
	});

	afterAll(() => {
		delete process.env.USESEND_API_KEY;
		delete process.env.USESEND_BASE_URL;
		delete process.env.USESEND_TRANSACTIONAL_FROM;
		delete process.env.USESEND_TRANSACTIONAL_REPLY_TO;
	});

	it.each(["USESEND_API_KEY", "USESEND_BASE_URL"])('requires the Infisical setting "%s" when constructing the adapter', (setting) => {
		delete process.env[setting];
		expect(() => new UseSendTransactionalMailAdapter()).toThrow(`${setting} must be injected by Infisical`);
	});

	it("sends an OTP with the sign-in subject, redacted infrastructure configuration, and idempotency key", async () => {
		await sendAuthOtp({ email: "creator@example.test", otp: "123456", type: "sign-in" });
		expect(mockUseSend).toHaveBeenCalledWith("test-api-key", "https://mail.example.test");
		expect(mockSend).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "creator@example.test",
				from: "Clipify <auth@clipify.us>",
				replyTo: "contact@clipify.us",
				subject: "Your Clipify sign-in code",
				text: expect.stringContaining("123456"),
			}),
			expect.objectContaining({ idempotencyKey: expect.stringMatching(/^auth-otp:/) }),
		);
	});

	it("uses the verification subject for non-sign-in OTP purposes", async () => {
		await sendAuthOtp({ email: "member@example.test", otp: "654321", type: "email-verification" });
		expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ subject: "Verify your Clipify email" }), expect.any(Object));
	});

	it("renders and sends a team invitation", async () => {
		await sendTeamInvitation({ email: "member@example.test", invitationUrl: "https://clipify.us/accept-invitation?id=1", organizationName: "Creator Team" });
		expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: "member@example.test", subject: expect.stringContaining("Creator Team"), html: expect.stringContaining("accept-invitation") }), expect.objectContaining({ idempotencyKey: expect.stringMatching(/^team-invitation:/) }));
	});

	it("returns null when the provider succeeds without an email identifier", async () => {
		mockSend.mockResolvedValueOnce({ data: {}, error: null });
		await expect(new UseSendTransactionalMailAdapter().send("member@example.test", { subject: "Subject", text: "Text", html: "<p>Text</p>", templateVersion: "identity-security-v1" }, "dedupe-1")).resolves.toBeNull();
	});

	it("fails closed when the sender identity is missing or UseSend rejects delivery", async () => {
		const adapter = new UseSendTransactionalMailAdapter();
		delete process.env.USESEND_TRANSACTIONAL_FROM;
		await expect(adapter.send("member@example.test", { subject: "Subject", text: "Text", html: "<p>Text</p>", templateVersion: "identity-security-v1" }, "dedupe-1")).rejects.toThrow("USESEND_TRANSACTIONAL_FROM must be injected by Infisical");

		process.env.USESEND_TRANSACTIONAL_FROM = "Clipify <auth@clipify.us>";
		mockSend.mockResolvedValueOnce({ data: null, error: { message: "provider failure" } });
		await expect(adapter.send("member@example.test", { subject: "Subject", text: "Text", html: "<p>Text</p>", templateVersion: "identity-security-v1" }, "dedupe-2")).rejects.toThrow("Transactional email delivery failed: provider failure");

		mockSend.mockResolvedValueOnce({ data: null, error: { error: { code: "DOMAIN_NOT_VERIFIED", message: "Sender domain is not verified" } } });
		await expect(adapter.send("member@example.test", { subject: "Subject", text: "Text", html: "<p>Text</p>", templateVersion: "identity-security-v1" }, "dedupe-3")).rejects.toThrow("Transactional email delivery failed: Sender domain is not verified");
	});
});
