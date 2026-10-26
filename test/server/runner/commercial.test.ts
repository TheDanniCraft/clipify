/** @jest-environment node */
import { BillingProduct } from "@types";
import { flowProbe } from "../../support/mcp/probe";

jest.mock("server-only", () => ({}));
jest.mock("next/navigation", () => ({ redirect: (url: string) => redirectTo(url) }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const agencyBilling = {
	organizationId: "org_fixture_agency",
	stripeCustomerId: "cus_fixture_agency",
	stripeSubscriptionId: "sub_fixture_agency",
	creatorSeatPriceId: "price_fixture_creator",
	creatorSeatItemId: "si_fixture_creator",
	creatorSeatQuantity: 5,
	creatorSeatMinimum: 0,
	pendingCreatorSeatQuantity: null,
	runnerSeatPriceId: "price_fixture_runner",
	runnerSeatItemId: "si_fixture_runner",
	runnerSeatQuantity: 2,
	runnerSeatMinimum: 0,
	pendingRunnerSeatQuantity: null,
	collectionMethod: "charge_automatically",
};
const billingRead = jest.fn();
const databaseUpdate = jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(async () => undefined) })) }));
const databaseSelect = jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => ({ limit: billingRead })), innerJoin: jest.fn(() => ({ where: jest.fn(async () => []) })) })) }));
const redirectTo = jest.fn((url: string): never => {
	throw new Error(`TEST_REDIRECT:${url}`);
});
const cookieGet = jest.fn();
const cookieSet = jest.fn();
const checkoutCreate = jest.fn();
const customerCreate = jest.fn();
const customerRetrieve = jest.fn();
const stripe = {
	prices: { list: jest.fn(), retrieve: jest.fn() },
	subscriptions: { list: jest.fn(), update: jest.fn(), create: jest.fn(), retrieve: jest.fn() },
	subscriptionSchedules: { update: jest.fn(), create: jest.fn() },
	checkout: { sessions: { create: checkoutCreate } },
	customers: { create: customerCreate, retrieve: customerRetrieve },
	promotionCodes: { list: jest.fn() },
};

jest.mock("@/server/stripe", () => ({ getStripe: () => stripe }));
jest.mock("@actions/auth", () => ({ validateAuth: jest.fn(async () => ({ id: "fixture-commercial-owner", email: "commercial@example.invalid", stripeCustomerId: "cus_fixture_commercial" })) }));
jest.mock("@actions/utils", () => ({ getBaseUrl: jest.fn(async () => new URL("https://clipify.example.invalid")) }));
jest.mock("next/headers", () => ({ cookies: jest.fn(async () => ({ get: cookieGet, set: cookieSet })) }));
jest.mock("@lib/campaignOffers", () => ({ getActiveCampaignOffer: jest.fn(async () => null) }));
jest.mock("@lib/entitlements", () => ({ resolveUserEntitlements: jest.fn(async () => ({ proAccess: false, reverseTrialActive: false })), getActiveEntitlementGrant: jest.fn(async () => null) }));
jest.mock("@actions/rateLimit", () => ({ tryRateLimit: jest.fn(async () => ({ success: true })) }));
jest.mock("@/db/client", () => ({ db: { update: databaseUpdate, select: databaseSelect } }));
jest.mock("@/server/agencies/database", () => ({ requireAgencyMember: jest.fn(async () => ({ account: { organizationId: "org_fixture_agency" } })) }));
jest.mock("@/server/agencies/billing-sync", () => ({ syncAgencyStripeSubscription: jest.fn() }));
jest.mock("@/server/account-lifecycle/database", () => ({}));
jest.mock("@/auth/transactional-mail", () => ({ sendAccountDataExport: jest.fn() }));
jest.mock("@/auth/account-data-export-token", () => ({ ACCOUNT_DATA_EXPORT_TTL_MS: 1, createAccountDataExportToken: jest.fn() }));

const previousStripeKey = process.env.STRIPE_SECRET_KEY;
beforeEach(async () => {
	jest.clearAllMocks();
	cookieGet.mockReturnValue(undefined);
	cookieSet.mockImplementation(() => undefined);
	billingRead.mockResolvedValue([{ ...agencyBilling }]);
	stripe.subscriptions.update.mockResolvedValue({});
	stripe.prices.retrieve.mockResolvedValue({ id: "price_unknown_fixture", product: null });
	process.env.STRIPE_SECRET_KEY = "sk_test_commercial_fixture";
	(await import("@/server/billingCatalog")).clearBillingCatalogCacheForTests();
	stripe.prices.list.mockResolvedValue({
		data: [
			{ id: "price_fixture_pro_monthly", lookup_key: "clipify_pro_monthly", unit_amount: 200, currency: "eur", product: "prod_fixture_pro" },
			{ id: "price_fixture_pro_yearly", lookup_key: "clipify_pro_yearly", unit_amount: 2000, currency: "eur", product: "prod_fixture_pro" },
			{ id: "price_fixture_runner_monthly", lookup_key: "clipify_runner_monthly", unit_amount: 300, currency: "eur", product: "prod_fixture_runner" },
			{ id: "price_fixture_runner_yearly", lookup_key: "clipify_runner_yearly", unit_amount: 3000, currency: "eur", product: "prod_fixture_runner" },
		],
	});
	stripe.subscriptions.list.mockResolvedValue({ data: [] });
	checkoutCreate.mockResolvedValue({ url: "https://checkout.example.invalid/fixture" });
	customerRetrieve.mockResolvedValue({ id: "cus_fixture_agency", deleted: false, metadata: { clipifyAgencyOrganizationId: "org_fixture_agency" } });
});
afterAll(() => {
	if (previousStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
	else process.env.STRIPE_SECRET_KEY = previousStripeKey;
});

test("TDD-US5-CON014: existing Pro checkout keeps its current price and mocked Stripe boundary", async () => {
	const { generatePaymentLink } = await import("@/app/actions/subscription");
	expect(await generatePaymentLink("monthly")).toBe("https://checkout.example.invalid/fixture");
	expect(checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({ line_items: [{ price: "price_fixture_pro_monthly", quantity: 1 }], metadata: expect.objectContaining({ products: BillingProduct.Pro }) }));
	expect(customerCreate).not.toHaveBeenCalled();
});

test("TDD-US5-FR020: retired Runner checkout is rejected before Stripe writes", async () => {
	const actions = await import("@/app/actions/subscription");
	expect(actions).not.toHaveProperty("generateRunnerPaymentLink");
	expect(await actions.generateCheckout(["runner_self_hosted" as BillingProduct])).toMatchObject({ success: false, code: "INVALID_PRODUCT" });
	expect(checkoutCreate).not.toHaveBeenCalled();
	expect(customerCreate).not.toHaveBeenCalled();
});

test.each(["runner=true&cycle=monthly", "plan=pro&runner=true&cycle=monthly", "runner=true&runnerCycle=yearly"])("TDD-US5-OPT065: Runner query rejection never commits a signed checkout intent (%s)", async (query) => {
	const previousSecret = process.env.JWT_SECRET;
	process.env.JWT_SECRET = "commercial-intent-fixture-not-production";
	try {
		const { NextRequest } = await import("next/server");
		const { GET } = await import("@/app/checkout/start/route");
		const response = await GET(new NextRequest(`https://clipify.example.invalid/checkout/start?${query}`));
		expect(response.headers.get("location")).toBe("https://clipify.example.invalid/pricing");
		expect(cookieSet).not.toHaveBeenCalled();
		expect(checkoutCreate).not.toHaveBeenCalled();
		expect(customerCreate).not.toHaveBeenCalled();
	} finally {
		if (previousSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = previousSecret;
	}
});

test("TDD-US5-CON014: Pro-only public checkout still writes its intended selection", async () => {
	const previousSecret = process.env.JWT_SECRET;
	process.env.JWT_SECRET = "commercial-intent-fixture-not-production";
	try {
		const { NextRequest } = await import("next/server");
		const { GET } = await import("@/app/checkout/start/route");
		const { decodeCheckoutIntent } = await import("@/server/checkoutIntent");
		const response = await GET(new NextRequest("https://clipify.example.invalid/checkout/start?plan=pro&cycle=monthly"));
		expect(response.headers.get("location")).toBe("https://clipify.example.invalid/checkout/continue");
		expect(cookieSet).toHaveBeenCalledTimes(1);
		expect(decodeCheckoutIntent(cookieSet.mock.calls[0][1])?.products).toEqual([{ product: BillingProduct.Pro, billingCycle: "monthly" }]);
		expect(checkoutCreate).not.toHaveBeenCalled();
	} finally {
		if (previousSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = previousSecret;
	}
});

test("TDD-US5-OPT064: included Runner limits are represented in the existing two-plan comparison", async () => {
	const { pricingFeatures, tiers } = await import("@/app/components/Pricing/pricing-catalog");
	expect(tiers.map((tier) => tier.key)).toEqual(["free", "pro"]);
	const runner = pricingFeatures.find((section) => section.title === "Runner and broadcasting");
	expect(runner?.items).toEqual(expect.arrayContaining([expect.objectContaining({ title: "Streaming hours", tiers: { free: "Unlimited", pro: "Unlimited" } }), expect.objectContaining({ title: "Active broadcasts", tiers: { free: "1", pro: "Unlimited" } }), expect.objectContaining({ title: "Destinations per broadcast", tiers: { free: "1", pro: "Multiple" } }), expect.objectContaining({ title: "Scheduled broadcasts", tiers: { free: false, pro: true } })]));
});

test("TDD-US5-OPT066: billing options do not select a new Runner product", async () => {
	const { getBillingProductOptions } = await import("@/app/actions/subscription");
	const result = await getBillingProductOptions(BillingProduct.Pro);
	expect(result.options.map((option) => option.key)).toEqual([BillingProduct.Pro]);
	expect(result.options.find((option) => option.key === BillingProduct.Pro)).toMatchObject({ owned: false, required: true });
	expect(checkoutCreate).not.toHaveBeenCalled();
	expect(customerCreate).not.toHaveBeenCalled();
});

test("TDD-US5-OPT066: retired Runner items never reappear in billing options", async () => {
	stripe.subscriptions.list.mockResolvedValue({ data: [{ id: "sub_fixture_historical_runner", status: "active", items: { data: [{ price: { id: "price_fixture_runner_monthly", product: "prod_fixture_runner", recurring: { interval: "month" } } }] } }] });
	const { getBillingProductOptions } = await import("@/app/actions/subscription");
	const result = await getBillingProductOptions(BillingProduct.Pro);
	expect(result.options.map((option) => option.key)).toEqual([BillingProduct.Pro]);
	expect(checkoutCreate).not.toHaveBeenCalled();
	expect(customerCreate).not.toHaveBeenCalled();
});

test("TDD-US5-OPT067: current upgrade requests contain only Pro", async () => {
	const { getBillingProductOptions } = await import("@/app/actions/subscription");
	const result = await getBillingProductOptions(BillingProduct.Pro);
	expect(result.primaryProduct).toBe(BillingProduct.Pro);
	expect(result.options.map((option) => option.key)).toEqual([BillingProduct.Pro]);
});

test("TDD-US5-CON014: creator-seat increases retain the existing Stripe write contract", async () => {
	const { changeAgencySeatQuantity } = await import("@/server/agencies/billing");
	expect(await changeAgencySeatQuantity("creator", 6)).toMatchObject({ kind: "increase", quantity: 6 });
	expect(databaseUpdate).toHaveBeenCalledTimes(1);
	expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_fixture_agency", expect.objectContaining({ items: [{ id: "si_fixture_creator", quantity: 6 }] }));
});

test("TDD-US5-CON014 U273: Runner-seat increases return included access before database or Stripe writes", async () => {
	const { changeAgencySeatQuantity } = await import("@/server/agencies/billing");
	expect(await changeAgencySeatQuantity("runner" as never, 3)).toMatchObject({ kind: "invalid", error: "INVALID_AGENCY_SEAT_KIND" });
	expect(databaseUpdate).not.toHaveBeenCalled();
	expect(stripe.subscriptions.update).not.toHaveBeenCalled();
	expect(checkoutCreate).not.toHaveBeenCalled();
});

test("TDD-US5-CON014: agency checkout bills only creator seats", async () => {
	billingRead.mockResolvedValue([{ ...agencyBilling, stripeSubscriptionId: null }]);
	checkoutCreate.mockResolvedValue({ url: "https://checkout.example.invalid" });
	const { createAgencyBillingStart } = await import("@/server/agencies/billing");
	expect(await createAgencyBillingStart()).toMatchObject({ kind: "checkout" });
	expect(checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({ line_items: [{ price: "price_fixture_creator", quantity: 5 }] }), expect.anything());
});

test("TDD-US5-CON014: agency form presents included access instead of reporting an unchanged purchase", async () => {
	const { changeAgencySeatQuantityFormAction } = await import("@/app/actions/agency");
	const form = new FormData();
	form.set("kind", "runner");
	form.set("quantity", "3");
	await expect(changeAgencySeatQuantityFormAction(form)).rejects.toThrow(`TEST_REDIRECT:/dashboard/agency?billingError=${encodeURIComponent("INVALID_AGENCY_SEAT_KIND")}`);
	expect(redirectTo).toHaveBeenCalledTimes(1);
	expect(databaseUpdate).not.toHaveBeenCalled();
	expect(stripe.subscriptions.update).not.toHaveBeenCalled();
});

test("TDD-US5-CON014: agency creator checkout form redirects to its checkout", async () => {
	billingRead.mockResolvedValue([{ ...agencyBilling, stripeSubscriptionId: null }]);
	checkoutCreate.mockResolvedValue({ url: "https://checkout.example.invalid" });
	const { startAgencyBillingFormAction } = await import("@/app/actions/agency");
	await expect(startAgencyBillingFormAction()).rejects.toThrow("TEST_REDIRECT:https://checkout.example.invalid");
});

test("TDD-US5-CON014: creator-only agency checkout remains available without a Runner line item", async () => {
	billingRead.mockResolvedValue([{ ...agencyBilling, stripeSubscriptionId: null, runnerSeatQuantity: 0 }]);
	const { createAgencyBillingStart } = await import("@/server/agencies/billing");
	expect(await createAgencyBillingStart()).toEqual({ kind: "checkout", url: "https://checkout.example.invalid/fixture" });
	expect(checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({ line_items: [{ price: "price_fixture_creator", quantity: 5 }] }), expect.any(Object));
});

test("TDD-US5-CON014: unchanged historical Runner quantity performs no mutation", async () => {
	const { changeAgencySeatQuantity } = await import("@/server/agencies/billing");
	expect(await changeAgencySeatQuantity("runner" as never, 2)).toMatchObject({ kind: "invalid", error: "INVALID_AGENCY_SEAT_KIND" });
	expect(databaseUpdate).not.toHaveBeenCalled();
	expect(stripe.subscriptions.update).not.toHaveBeenCalled();
});

test("TDD-US5-CON014: creator seat reduction retains its next-period Stripe schedule", async () => {
	stripe.subscriptions.retrieve.mockResolvedValue({
		id: "sub_fixture_agency",
		schedule: "sched_fixture_agency",
		items: {
			data: [
				{ id: "si_fixture_creator", quantity: 5, price: { id: "price_fixture_creator", recurring: { interval: "month" } }, current_period_start: 1700000000, current_period_end: 1702592000 },
				{ id: "si_fixture_runner", quantity: 2, price: { id: "price_fixture_runner", recurring: { interval: "month" } }, current_period_start: 1700000000, current_period_end: 1702592000 },
			],
		},
	});
	const { changeAgencySeatQuantity } = await import("@/server/agencies/billing");
	expect(await changeAgencySeatQuantity("creator", 4)).toEqual({ kind: "decrease", quantity: 4, effective: "next_period" });
	expect(stripe.subscriptions.update).not.toHaveBeenCalled();
	expect(stripe.subscriptionSchedules.update).toHaveBeenCalledWith(
		"sched_fixture_agency",
		expect.objectContaining({
			phases: [
				expect.objectContaining({
					items: [
						{ price: "price_fixture_creator", quantity: 5 },
						{ price: "price_fixture_runner", quantity: 2 },
					],
				}),
				expect.objectContaining({
					items: [
						{ price: "price_fixture_creator", quantity: 4 },
						{ price: "price_fixture_runner", quantity: 2 },
					],
					proration_behavior: "none",
				}),
			],
		}),
	);
	expect(databaseUpdate).toHaveBeenCalledTimes(1);
});

test.each([
	["dev", "price_1TsLIKBg46KdNQq5wLcoek8z"],
	["dev", "price_1TsLILBg46KdNQq5sJNQa1Ka"],
	["prod", "price_1TyChaB0sp7KYCWLCcW0BNTZ"],
	["prod", "price_1TyChhB0sp7KYCWLBVMtucQJ"],
])("TDD-US5-CON014 U274: historical Runner webhook price remains decodable (%s/%s)", async (environment, priceId) => {
	const previousEnvironment = process.env.APP_ENV;
	process.env.APP_ENV = environment;
	try {
		const { resolveBillingProductForPrice } = await import("@/server/billingCatalog");
		expect(await resolveBillingProductForPrice(priceId)).toBeNull();
		expect(stripe.prices.retrieve).toHaveBeenCalledWith(priceId, expect.anything());
		expect(stripe.prices.list).not.toHaveBeenCalled();
		expect(checkoutCreate).not.toHaveBeenCalled();
	} finally {
		if (previousEnvironment === undefined) delete process.env.APP_ENV;
		else process.env.APP_ENV = previousEnvironment;
	}
});

test.each(["product-keys", "per-product-cycles"])("TDD-US5-CON014 U150: mixed %s checkout cannot charge Pro alongside a retired Runner purchase", async (selectionType) => {
	const { generateCheckout } = await import("@/app/actions/subscription");
	const products =
		selectionType === "product-keys"
			? [BillingProduct.Pro, "runner_self_hosted" as BillingProduct]
			: [
					{ product: BillingProduct.Pro, billingCycle: "yearly" as const },
					{ product: "runner_self_hosted" as BillingProduct, billingCycle: "monthly" as const },
				];
	expect(await generateCheckout(products)).toMatchObject({ success: false, code: "INVALID_PRODUCT" });
	expect(checkoutCreate).not.toHaveBeenCalled();
	expect(customerCreate).not.toHaveBeenCalled();
	expect(stripe.prices.list).not.toHaveBeenCalled();
	expect(databaseUpdate).not.toHaveBeenCalled();
});

test("TDD-US5-CON014: an old signed Runner intent is consumed once and cannot create a checkout", async () => {
	const previousSecret = process.env.JWT_SECRET;
	process.env.JWT_SECRET = "commercial-intent-fixture-not-production";
	try {
		const { CHECKOUT_INTENT_COOKIE } = await import("@/server/checkoutIntent");
		const token = (await import("jsonwebtoken")).default.sign({ v: 1, products: [{ product: "runner_self_hosted", billingCycle: "monthly" }], source: "pricing_page", entrypoint: "runner_addon", nonce: "historical-commercial-intent" }, process.env.JWT_SECRET!, { issuer: "clipify-checkout", audience: "clipify-checkout" });
		cookieGet.mockReturnValue({ value: token });
		cookieSet.mockImplementation((name: string, value: string) => {
			if (name === CHECKOUT_INTENT_COOKIE && value === "") cookieGet.mockReturnValue(undefined);
		});
		const { GET } = await import("@/app/checkout/continue/route");
		const response = await GET();
		expect(response.headers.get("location")).toBe("https://clipify.example.invalid/pricing");
		expect(cookieSet).toHaveBeenCalledWith(CHECKOUT_INTENT_COOKIE, "", expect.objectContaining({ maxAge: 0 }));
		expect((await GET()).headers.get("location")).toBe("https://clipify.example.invalid/pricing");
		expect(checkoutCreate).not.toHaveBeenCalled();
		expect(customerCreate).not.toHaveBeenCalled();
		expect(stripe.prices.list).not.toHaveBeenCalled();
	} finally {
		if (previousSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = previousSecret;
	}
});

test("TDD-US5-DEC013: reference templates and home FAQ describe included unlimited Runner without a third product", async () => {
	const { readFileSync } = await import("node:fs");
	const { renderLlmsFullText } = await import("@/app/lib/llmsContent");
	const faqs = (await import("@/app/components/LandingPage/faqs")).default;
	const short = readFileSync("src/app/llms.txt/llms.txt", "utf8");
	const full = renderLlmsFullText(readFileSync("src/app/llms-full.txt/llms-full.txt", "utf8"));
	for (const text of [short, full]) {
		expect(text).toMatch(/Runner is included with Free and Pro/);
		expect(text).toMatch(/unlimited streaming hours/i);
		expect(text).not.toMatch(/Runner access is a separate optional product|Pro and Runner prices|separate Runner access/);
	}
	expect(full).toMatch(/Runner and broadcasting/);
	expect(full).toMatch(/Advanced Runner features require effective Pro.*valid Pro grants, trials, and agency creator seats/);
	expect(full).not.toMatch(/Existing active Runner grants provide advanced Runner benefits/);
	const runnerFaq = faqs.find((faq) => faq.title === "What is the self-hosted Runner?");
	expect(runnerFaq?.content).toMatch(/broadcasts clips from your Windows, Linux, or macOS computer/);
	expect(runnerFaq?.content).not.toMatch(/3 EUR|30 EUR|add-on/);
});

test("TDD-US5-FR021: lifetime Pro grants resolve individually and in batches without leaking owner scope", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:commercial_service_lifetime");
	expect(result.individual).toMatchObject({ effectivePlan: "pro", proAccess: true });
	expect(result.batch).toEqual(result.individual);
	expect(result.ungranted).toMatchObject({ effectivePlan: "free", proAccess: false });
	expect(result.capabilities).toMatchObject({ basicAccess: true, runnerPro: true, scheduling: true, customStandby: true, attributionRequired: false, maxActiveBroadcasts: null, maxTargets: null, validUntil: null });
	expect(result.grantLifetime).toEqual([{ ends_at: null, revoked_at: null }]);
});

test("TDD-US5-OPT068: a bounded active Pro grant preserves scoped capabilities in both resolvers", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:commercial_service_active");
	expect(result.individual).toMatchObject({ effectivePlan: "pro", proAccess: true });
	expect(result.batch).toEqual(result.individual);
	expect(result.ungranted).not.toHaveProperty("runnerAccess");
	expect(result.capabilities).toMatchObject({ runnerPro: true, scheduling: true, customStandby: true, attributionRequired: false });
	expect(new Date(result.grantLifetime[0].ends_at).getTime()).toBeGreaterThan(Date.now());
	expect(result.grantLifetime[0].revoked_at).toBeNull();
});

test("TDD-US5-OPT069: an expired scoped Pro support grant receives no Partner grace and leaves basic Runner available", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:commercial_service_expired");
	expect(result.individual).toMatchObject({ effectivePlan: "free", proAccess: false });
	expect(result.batch).toEqual(result.individual);
	expect(result.capabilities).toMatchObject({ basicAccess: true, runnerPro: false, scheduling: false, customStandby: false, attributionRequired: true, maxActiveBroadcasts: 1, maxTargets: 1 });
	expect(new Date(result.grantLifetime[0].ends_at).getTime()).toBeLessThan(Date.now());
	expect(new Date(result.grantLifetime[0].ends_at).getTime()).toBeGreaterThan(Date.now() - 2 * 86400000);
	expect(result.grantLifetime[0].revoked_at).toBeNull();
});

test("TDD-US5-OPT070: revocation removes only advanced Runner access before the unexpired grant deadline", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:commercial_service_revoked");
	expect(result.individual).toMatchObject({ effectivePlan: "free", proAccess: false });
	expect(result.batch).toEqual(result.individual);
	expect(result.capabilities).toMatchObject({ basicAccess: true, runnerPro: false, scheduling: false, attributionRequired: true });
	expect(new Date(result.grantLifetime[0].ends_at).getTime()).toBeGreaterThan(Date.now());
	expect(new Date(result.grantLifetime[0].revoked_at).getTime()).toBeLessThan(Date.now());
});

test("TDD-US5-OPT071: an active agency creator allocation grants Pro Runner benefits in both resolvers", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:commercial_service_agency_active");
	expect(result.individual).toMatchObject({ effectivePlan: "pro", proAccess: true });
	expect(result.batch).toEqual(result.individual);
	expect(result.ungranted).toMatchObject({ proAccess: false });
	expect(result.capabilities).toMatchObject({ runnerPro: true, scheduling: true, customStandby: true, attributionRequired: false, maxActiveBroadcasts: null });
	expect(result.grantLifetime).toEqual([]);
	expect(result.agencyLifetime).toHaveLength(1);
	expect(result.agencyLifetime[0].status).toBe("active");
	expect(new Date(result.agencyLifetime[0].ends_at).getTime()).toBeGreaterThan(Date.now());
});

test.each(["agency_ended", "agency_ended_status"])("TDD-US5-OPT072: ended agency Runner allocation %s denies advanced benefits in both resolvers", (state) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:commercial_service_${state}`);
	expect(result.individual).toMatchObject({ effectivePlan: "free", proAccess: false });
	expect(result.batch).toEqual(result.individual);
	expect(result.capabilities).toMatchObject({ basicAccess: true, runnerPro: false, scheduling: false, customStandby: false, attributionRequired: true });
	expect(result.grantLifetime).toEqual([]);
	expect(result.agencyLifetime).toHaveLength(1);
	expect(result.agencyLifetime[0].status).toBe(state === "agency_ended_status" ? "ended" : "removal_scheduled");
	if (state === "agency_ended_status") expect(new Date(result.agencyLifetime[0].ends_at).getTime()).toBeGreaterThan(Date.now());
	else expect(new Date(result.agencyLifetime[0].ends_at).getTime()).toBeLessThan(Date.now());
});

test.each(["pro", "trial", "pro_grant", "agency_creator"])("TDD-US5-FR021 supplemental: effective Pro source %s includes Runner without fabricating a legacy Runner grant", (state) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:commercial_service_${state}`);
	expect(result.individual).toMatchObject({ effectivePlan: "pro", proAccess: true });
	expect(result.batch).toEqual(result.individual);
	expect(result.ungranted).toMatchObject({ proAccess: false });
	expect(result.capabilities).toMatchObject({ runnerPro: true, scheduling: true, customStandby: true, attributionRequired: false, maxActiveBroadcasts: null, maxTargets: null });
	expect(result.grantLifetime).toHaveLength(state === "trial" || state === "pro_grant" ? 1 : 0);
});
