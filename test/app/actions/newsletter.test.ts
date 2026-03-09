/** @jest-environment node */
export {};

const contactsCreate = jest.fn();
const UseSend = jest.fn().mockImplementation(() => ({
	contacts: {
		create: (...args: unknown[]) => contactsCreate(...args),
	},
}));
const tryRateLimit = jest.fn();
const verifyTurnstile = jest.fn();

jest.mock("usesend-js", () => ({
	UseSend: function UseSendCtor(...args: unknown[]) {
		return UseSend(...args);
	},
}));

jest.mock("@actions/rateLimit", () => ({
	tryRateLimit: (...args: unknown[]) => tryRateLimit(...args),
}));

jest.mock("nextjs-turnstile", () => ({
	verifyTurnstile: (...args: unknown[]) => verifyTurnstile(...args),
}));

async function loadNewsletter() {
	jest.resetModules();
	return import("@/app/actions/newsletter");
}

describe("actions/newsletter", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.USESEND_BASE_URL = "https://usesend.example.com/";
		process.env.USESEND_API_KEY = "usesend-key";
		process.env.USESEND_CONTACT_BOOK_ID = "book-1";
		process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
	});

	it("detects known email providers and falls back to custom", async () => {
		const { getEmailProvider } = await loadNewsletter();
		await expect(getEmailProvider("foo@gmail.com")).resolves.toBe("Google");
		await expect(getEmailProvider("bar@unknown.tld")).resolves.toBe("custom");
	});

	it("returns RateLimitError when rate limiter rejects the request", async () => {
		tryRateLimit.mockResolvedValue({ success: false });
		const { subscribeToNewsletter } = await loadNewsletter();
		const result = await subscribeToNewsletter("user@example.com", "captcha-token");
		expect(result).toEqual(expect.objectContaining({ name: "RateLimitError" }));
		expect(contactsCreate).not.toHaveBeenCalled();
	});

	it("throws when captcha validation fails", async () => {
		tryRateLimit.mockResolvedValue({ success: true });
		verifyTurnstile.mockResolvedValue(false);
		const { subscribeToNewsletter } = await loadNewsletter();
		const result = await subscribeToNewsletter("user@example.com", "bad-captcha");
		expect(result).toEqual(expect.objectContaining({ message: "Invalid CAPTCHA" }));
		expect(contactsCreate).not.toHaveBeenCalled();
	});

	it("subscribes contact with optional fields when checks pass", async () => {
		tryRateLimit.mockResolvedValue({ success: true });
		verifyTurnstile.mockResolvedValue(true);
		contactsCreate.mockResolvedValue({
			data: { id: "contact-1", email: "user@example.com" },
		});

		const { subscribeToNewsletter } = await loadNewsletter();
		const result = await subscribeToNewsletter("user@example.com", "captcha-ok", {
			firstName: "Alice",
			properties: { source: "landing" },
		});

		expect(UseSend).toHaveBeenCalledWith("usesend-key", "https://usesend.example.com");
		expect(contactsCreate).toHaveBeenCalledWith(
			"book-1",
			expect.objectContaining({
				email: "user@example.com",
				firstName: "Alice",
				properties: { source: "landing" },
				subscribed: true,
			}),
		);
		expect(result).toEqual({ id: "contact-1", email: "user@example.com" });
	});

	it("throws when UseSend responds with an error payload", async () => {
		tryRateLimit.mockResolvedValue({ success: true });
		verifyTurnstile.mockResolvedValue(true);
		contactsCreate.mockResolvedValue({
			error: { message: "already subscribed" },
		});
		const { subscribeToNewsletter } = await loadNewsletter();
		await expect(subscribeToNewsletter("user@example.com", "captcha-ok")).rejects.toThrow("already subscribed");
	});

	it("throws when UseSend env configuration is missing", async () => {
		delete process.env.USESEND_API_KEY;
		const { subscribeToNewsletter } = await loadNewsletter();
		await expect(subscribeToNewsletter("user@example.com", "captcha-ok")).rejects.toThrow(
			"Missing useSend configuration in environment variables",
		);
	});
});
