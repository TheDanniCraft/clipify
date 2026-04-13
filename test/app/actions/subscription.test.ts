/** @jest-environment node */
export {};

const stripeCtor = jest.fn();
const subscriptionsList = jest.fn();
const customersCreate = jest.fn();
const checkoutCreate = jest.fn();
const promotionCodesList = jest.fn();
const portalCreate = jest.fn();

const validateAuth = jest.fn();
const getBaseUrl = jest.fn();
const cookies = jest.fn();
const getActiveCampaignOffer = jest.fn();

const updateExecute = jest.fn();

const updateBuilder = {
	set: jest.fn(),
	where: jest.fn(),
	returning: jest.fn(),
	execute: (...args: unknown[]) => updateExecute(...args),
};

updateBuilder.set.mockImplementation(() => updateBuilder);
updateBuilder.where.mockImplementation(() => updateBuilder);
updateBuilder.returning.mockImplementation(() => updateBuilder);

const db = {
	update: jest.fn(() => updateBuilder),
};

jest.mock("stripe", () => ({
	__esModule: true,
	default: function StripeMock(...args: unknown[]) {
		return stripeCtor(...args);
	},
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => validateAuth(...args),
}));

jest.mock("@actions/utils", () => ({
	getBaseUrl: (...args: unknown[]) => getBaseUrl(...args),
}));

jest.mock("next/headers", () => ({
	cookies: (...args: unknown[]) => cookies(...args),
}));

jest.mock("@/db/client", () => ({
	db,
}));

jest.mock("@lib/campaignOffers", () => ({
	getActiveCampaignOffer: (...args: unknown[]) => getActiveCampaignOffer(...args),
}));

async function loadSubscription() {
	jest.resetModules();
	return import("@/app/actions/subscription");
}

describe("actions/subscription", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.STRIPE_SECRET_KEY = "sk_test_123";
		getBaseUrl.mockResolvedValue(new URL("https://clipify.us"));
		validateAuth.mockResolvedValue({
			id: "user-1",
			email: "alice@example.com",
			stripeCustomerId: null,
		});
		getActiveCampaignOffer.mockResolvedValue(null);
		cookies.mockResolvedValue({
			get: () => undefined,
		});
		updateExecute.mockResolvedValue([{ id: "user-1" }]);
		stripeCtor.mockReturnValue({
			subscriptions: { list: (...args: unknown[]) => subscriptionsList(...args) },
			customers: { create: (...args: unknown[]) => customersCreate(...args) },
			checkout: { sessions: { create: (...args: unknown[]) => checkoutCreate(...args) } },
			promotionCodes: { list: (...args: unknown[]) => promotionCodesList(...args) },
			billingPortal: { sessions: { create: (...args: unknown[]) => portalCreate(...args) } },
		});
	});

	it("resolves plan ids by environment", async () => {
		process.env = { ...process.env, NODE_ENV: "production" };
		const { getPlans } = await loadSubscription();
		const prodPlans = await getPlans();
		expect(prodPlans.monthly).toBe("price_1S83PSB0sp7KYCWLzhUkxodR");

		process.env = { ...process.env, NODE_ENV: "development" };
		const devPlans = await getPlans();
		expect(devPlans.monthly).toBe("price_1SnM3MBg46KdNQq5MjHMYyYw");
	});

	it("checks existing subscriptions based on blocking statuses", async () => {
		const { checkIfSubscriptionExists } = await loadSubscription();
		const user = { id: "user-1", stripeCustomerId: null } as never;
		await expect(checkIfSubscriptionExists(user)).resolves.toBe(false);

		validateAuth.mockResolvedValue({
			id: "user-1",
			email: "alice@example.com",
			stripeCustomerId: "cus_123",
		});
		subscriptionsList.mockResolvedValue({
			data: [{ status: "canceled" }, { status: "active" }],
		});
		await expect(checkIfSubscriptionExists({ id: "user-1" } as never)).resolves.toBe(true);
	});

	it("creates a checkout session and persists customer id when needed", async () => {
		customersCreate.mockResolvedValue({ id: "cus_new" });
		checkoutCreate.mockResolvedValue({ url: "https://checkout.stripe.test/session-1" });

		const { generatePaymentLink } = await loadSubscription();
		const result = await generatePaymentLink(
			{
				id: "user-1",
				email: "alice@example.com",
				stripeCustomerId: null,
			} as never,
			"monthly",
			"/dashboard/settings",
			undefined,
			"upgrade_modal",
		);

		expect(customersCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				email: "alice@example.com",
				metadata: expect.objectContaining({ userId: "user-1" }),
			}),
		);
		expect(db.update).toHaveBeenCalled();
		expect(checkoutCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				customer: "cus_new",
				cancel_url: "https://clipify.us/dashboard/settings",
			}),
		);
		expect(result).toBe("https://checkout.stripe.test/session-1");
	});

	it("retries checkout without promo discount when code is not redeemable", async () => {
		validateAuth.mockResolvedValue({
			id: "user-1",
			email: "alice@example.com",
			stripeCustomerId: "cus_existing",
		});
		cookies.mockResolvedValue({
			get: (name: string) => (name === "offer" ? { value: "PROMO1" } : undefined),
		});
		promotionCodesList.mockResolvedValue({
			data: [{ id: "promo_1" }],
		});
		checkoutCreate
			.mockRejectedValueOnce({
				code: "promotion_code_not_redeemable",
				message: "promotion code cannot be redeemed",
			})
			.mockResolvedValueOnce({ url: "https://checkout.stripe.test/session-fallback" });

		const { generatePaymentLink } = await loadSubscription();
		const result = await generatePaymentLink(
			{
				id: "user-1",
				email: "alice@example.com",
				stripeCustomerId: "cus_existing",
			} as never,
			"yearly",
		);

		expect(checkoutCreate).toHaveBeenCalledTimes(2);
		expect(checkoutCreate.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ discounts: [{ promotion_code: "promo_1" }] }));
		expect(checkoutCreate.mock.calls[1]?.[0]).toEqual(expect.objectContaining({ allow_promotion_codes: true }));
		expect(result).toBe("https://checkout.stripe.test/session-fallback");
	});

	it("returns portal links and enforces customer requirement", async () => {
		const { getPortalLink } = await loadSubscription();
		await expect(getPortalLink({ id: "user-1", stripeCustomerId: null } as never)).rejects.toThrow(
			"User does not have a Stripe customer ID",
		);

		validateAuth.mockResolvedValue({
			id: "user-1",
			email: "alice@example.com",
			stripeCustomerId: "cus_123",
		});
		portalCreate.mockResolvedValue({ url: "https://billing.stripe.test/portal" });
		await expect(getPortalLink({ id: "user-1", stripeCustomerId: "cus_123" } as never)).resolves.toBe(
			"https://billing.stripe.test/portal",
		);
	});
});
