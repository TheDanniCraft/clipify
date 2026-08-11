/** @jest-environment node */

describe("Stripe server client", () => {
	const originalKey = process.env.STRIPE_SECRET_KEY;

	beforeEach(() => {
		jest.resetModules();
	});

	afterEach(() => {
		if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
		else process.env.STRIPE_SECRET_KEY = originalKey;
	});

	it("reports a missing secret key explicitly", async () => {
		delete process.env.STRIPE_SECRET_KEY;
		const { getStripe } = await import("@/server/stripe");

		expect(() => getStripe()).toThrow("STRIPE_SECRET_KEY is not configured");
	});

	it("reuses the configured client", async () => {
		process.env.STRIPE_SECRET_KEY = "sk_test_123";
		const { getStripe } = await import("@/server/stripe");

		expect(getStripe()).toBe(getStripe());
	});
});
