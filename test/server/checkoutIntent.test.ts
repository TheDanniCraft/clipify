/** @jest-environment node */

import { BillingProduct } from "@types";

const cookieSet = jest.fn();
const cookieGet = jest.fn();

jest.mock("next/headers", () => ({
	cookies: jest.fn(async () => ({ get: cookieGet, set: cookieSet })),
}));

describe("checkout intent", () => {
	const originalSecret = process.env.JWT_SECRET;

	beforeEach(() => {
		jest.clearAllMocks();
		process.env.JWT_SECRET = "checkout-intent-test-secret";
	});

	afterAll(() => {
		if (originalSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = originalSecret;
	});

	it("signs and validates a checkout selection without an application expiry", async () => {
		const { decodeCheckoutIntent, encodeCheckoutIntent } = await import("@/server/checkoutIntent");
		const encoded = encodeCheckoutIntent({ products: [{ product: BillingProduct.Pro, billingCycle: "yearly" }], source: "pricing_page", entrypoint: "direct_cta", nonce: "nonce-1" });
		const decoded = decodeCheckoutIntent(encoded);

		expect(decoded).toEqual({ v: 1, products: [{ product: BillingProduct.Pro, billingCycle: "yearly" }], source: "pricing_page", entrypoint: "direct_cta", nonce: "nonce-1" });
		expect(JSON.parse(Buffer.from(encoded.split(".")[1], "base64url").toString())).not.toHaveProperty("exp");
	});

	it("writes a browser-session cookie without Max-Age or Expires", async () => {
		const { CHECKOUT_INTENT_COOKIE, writeCheckoutIntent } = await import("@/server/checkoutIntent");
		await writeCheckoutIntent({ products: [{ product: BillingProduct.Pro, billingCycle: "monthly" }], source: "pricing_page", entrypoint: "plan_builder" });

		expect(cookieSet).toHaveBeenCalledWith(CHECKOUT_INTENT_COOKIE, expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }));
		const options = cookieSet.mock.calls[0][2];
		expect(options).not.toHaveProperty("maxAge");
		expect(options).not.toHaveProperty("expires");
	});

	it("consumes and clears the intent before checkout continuation", async () => {
		const { CHECKOUT_INTENT_COOKIE, consumeCheckoutIntent, encodeCheckoutIntent } = await import("@/server/checkoutIntent");
		const encoded = encodeCheckoutIntent({ products: [{ product: BillingProduct.Pro, billingCycle: "yearly" }], source: "pricing_page", entrypoint: "direct_cta", nonce: "consume-once" });
		cookieGet.mockReturnValueOnce({ value: encoded });

		await expect(consumeCheckoutIntent()).resolves.toMatchObject({ nonce: "consume-once" });
		expect(cookieSet).toHaveBeenCalledWith(CHECKOUT_INTENT_COOKIE, "", expect.objectContaining({ maxAge: 0, path: "/" }));
	});

	it("rejects tampered and unsupported payloads", async () => {
		const { decodeCheckoutIntent, encodeCheckoutIntent } = await import("@/server/checkoutIntent");
		const encoded = encodeCheckoutIntent({ products: [{ product: BillingProduct.RunnerSelfHosted, billingCycle: "monthly" }], source: "pricing_page", entrypoint: "runner_addon" });
		expect(decodeCheckoutIntent(`${encoded}x`)).toBeNull();
		expect(() => encodeCheckoutIntent({ products: [] as never[], source: "pricing_page", entrypoint: "direct_cta" })).toThrow("Invalid checkout intent");
	});
});
