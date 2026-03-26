/** @jest-environment node */
export {};

const contactsCreate = jest.fn();
const contactsUpdate = jest.fn();
const useSendGet = jest.fn();
const UseSend = jest.fn().mockImplementation(() => ({
	contacts: {
		create: contactsCreate,
		update: contactsUpdate,
	},
    get: useSendGet,
}));
const tryRateLimit = jest.fn();
const verifyTurnstile = jest.fn();

jest.mock("usesend-js", () => ({
	UseSend: function UseSendCtor(...args: unknown[]) {
		return new UseSend(...args);
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
        process.env.USESEND_PRODUCT_UPDATES_CONTACT_BOOK_ID = "book-updates";
		process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
	});

	it("detects known email providers and falls back to custom", async () => {
		const { getEmailProvider } = await loadNewsletter();
		await expect(getEmailProvider("foo@gmail.com")).resolves.toBe("Google");
        await expect(getEmailProvider("user@outlook.com")).resolves.toBe("Microsoft");
        await expect(getEmailProvider("user@yahoo.com")).resolves.toBe("Yahoo");
        await expect(getEmailProvider("user@icloud.com")).resolves.toBe("Apple");
        await expect(getEmailProvider("user@protonmail.com")).resolves.toBe("ProtonMail");
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

    describe("syncProductUpdatesContact", () => {
        it("returns null if email is missing", async () => {
            const { syncProductUpdatesContact } = await loadNewsletter();
            const result = await syncProductUpdatesContact({ email: "", subscribed: true, userId: "u1", source: "explicit_opt_in" });
            expect(result).toBeNull();
        });

        it("updates contact by ID if provided", async () => {
            const { syncProductUpdatesContact } = await loadNewsletter();
            contactsUpdate.mockResolvedValue({ data: { id: "c1" } });
            const result = await syncProductUpdatesContact({ email: "u@t.com", subscribed: true, userId: "u1", source: "explicit_opt_in", contactId: "c1" });
            expect(result).toBe("c1");
            expect(contactsUpdate).toHaveBeenCalledWith("book-updates", "c1", expect.any(Object));
        });

        it("returns null if create response has no contactId", async () => {
            const { syncProductUpdatesContact } = await loadNewsletter();
            useSendGet.mockResolvedValue({ data: [] });
            contactsCreate.mockResolvedValue({ data: {} }); // no contactId
            const result = await syncProductUpdatesContact({ email: "new@t.com", subscribed: true, userId: "u1", source: "explicit_opt_in" });
            expect(result).toBeNull();
        });

        it("looks up existing contact by email if ID update fails or missing", async () => {
            const { syncProductUpdatesContact } = await loadNewsletter();
            useSendGet.mockResolvedValue({ data: [{ id: "c1", email: "u@t.com" }] });
            contactsUpdate.mockResolvedValue({ data: { id: "c1" } });
            const result = await syncProductUpdatesContact({ email: "u@t.com", subscribed: true, userId: "u1", source: "explicit_opt_in" });
            expect(result).toBe("c1");
            expect(useSendGet).toHaveBeenCalledWith(expect.stringContaining("emails=u%40t.com"));
        });

        it("creates contact if not found and subscribed is true", async () => {
            const { syncProductUpdatesContact } = await loadNewsletter();
            useSendGet.mockResolvedValue({ data: [] });
            contactsCreate.mockResolvedValue({ data: { contactId: "new-c" } });
            const result = await syncProductUpdatesContact({ email: "new@t.com", subscribed: true, userId: "u1", source: "explicit_opt_in" });
            expect(result).toBe("new-c");
            expect(contactsCreate).toHaveBeenCalledWith("book-updates", expect.any(Object));
        });

        it("does not create contact if not found and subscribed is false", async () => {
            const { syncProductUpdatesContact } = await loadNewsletter();
            useSendGet.mockResolvedValue({ data: [] });
            const result = await syncProductUpdatesContact({ email: "new@t.com", subscribed: false, userId: "u1", source: "explicit_opt_out" });
            expect(result).toBeNull();
            expect(contactsCreate).not.toHaveBeenCalled();
        });

        it("returns null on catch block", async () => {
            const { syncProductUpdatesContact } = await loadNewsletter();
            useSendGet.mockRejectedValue(new Error("Network Error"));
            const result = await syncProductUpdatesContact({ email: "u@t.com", subscribed: true, userId: "u1", source: "explicit_opt_in" });
            expect(result).toBeNull();
        });
    });

    describe("getProductUpdatesSubscriptionStatus", () => {
        it("returns status by contactId", async () => {
            const { getProductUpdatesSubscriptionStatus } = await loadNewsletter();
            useSendGet.mockResolvedValueOnce({ data: { id: "c1", subscribed: true } });
            const result = await getProductUpdatesSubscriptionStatus("c1");
            expect(result).toBe(true);
        });

        it("returns status by email if contactId lookup fails", async () => {
            const { getProductUpdatesSubscriptionStatus } = await loadNewsletter();
            useSendGet.mockResolvedValueOnce({ error: "not found" });
            useSendGet.mockResolvedValueOnce({ data: [{ id: "c1", email: "u@t.com", subscribed: false }] });
            const result = await getProductUpdatesSubscriptionStatus("c1", "u@t.com");
            expect(result).toBe(false);
        });

        it("returns status by email if no contactId provided", async () => {
            const { getProductUpdatesSubscriptionStatus } = await loadNewsletter();
            useSendGet.mockResolvedValueOnce({ data: [{ id: "c1", email: "u@t.com", subscribed: false }] });
            const result = await getProductUpdatesSubscriptionStatus(null, "u@t.com");
            expect(result).toBe(false);
        });

        it("returns null if contact not found", async () => {
            const { getProductUpdatesSubscriptionStatus } = await loadNewsletter();
            useSendGet.mockResolvedValueOnce({ data: [] });
            const result = await getProductUpdatesSubscriptionStatus(null, "u@t.com");
            expect(result).toBeNull();
        });

        it("returns null on error", async () => {
            const { getProductUpdatesSubscriptionStatus } = await loadNewsletter();
            useSendGet.mockRejectedValue(new Error("error"));
            const result = await getProductUpdatesSubscriptionStatus("c1");
            expect(result).toBeNull();
        });
    });
});
