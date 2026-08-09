/** @jest-environment node */

import { BillingProduct } from "@types";
import { clearBillingCatalogCacheForTests, resolveBillingCatalog, resolveBillingProductForPrice } from "@/server/billingCatalog";

describe("server billing catalog", () => {
	beforeEach(() => clearBillingCatalogCacheForTests());

	it("resolves current prices by lookup key and caches the result", async () => {
		const list = jest.fn().mockResolvedValue({
			data: [
				{ id: "price_pro_m", lookup_key: "clipify_pro_monthly", active: true, unit_amount: 200, currency: "eur", product: { id: "prod_pro" } },
				{ id: "price_pro_y", lookup_key: "clipify_pro_yearly", active: true, unit_amount: 2000, currency: "eur", product: { id: "prod_pro" } },
				{ id: "price_runner_m", lookup_key: "clipify_runner_monthly", active: true, unit_amount: 300, currency: "eur", product: { id: "prod_runner" } },
				{ id: "price_runner_y", lookup_key: "clipify_runner_yearly", active: true, unit_amount: 3000, currency: "eur", product: { id: "prod_runner" } },
			],
		});
		const stripe = { prices: { list } } as never;

		const first = await resolveBillingCatalog(stripe);
		const second = await resolveBillingCatalog(stripe);
		expect(first[BillingProduct.Pro].yearly).toEqual(expect.objectContaining({ priceId: "price_pro_y", productId: "prod_pro", amount: 20, currency: "EUR" }));
		expect(second).toBe(first);
		expect(list).toHaveBeenCalledTimes(1);
	});

	it("maps an old price through its stable Stripe product", async () => {
		const list = jest.fn().mockResolvedValue({
			data: [
				{ id: "price_current_pro_m", lookup_key: "clipify_pro_monthly", unit_amount: 200, currency: "eur", product: { id: "prod_pro" } },
				{ id: "price_current_pro_y", lookup_key: "clipify_pro_yearly", unit_amount: 2000, currency: "eur", product: { id: "prod_pro" } },
			],
		});
		const retrieve = jest.fn().mockResolvedValue({ id: "price_retired", product: { id: "prod_pro" }, unit_amount: 150, currency: "eur" });
		const stripe = { prices: { list, retrieve } } as never;

		await expect(resolveBillingProductForPrice("price_retired", stripe)).resolves.toBe(BillingProduct.Pro);
	});

	it("does not turn a Stripe lookup failure into an unknown billing product", async () => {
		const stripe = {
			prices: {
				retrieve: jest.fn().mockResolvedValue({ id: "price_new", product: { id: "prod_pro" }, unit_amount: 200, currency: "eur" }),
				list: jest.fn().mockRejectedValue(new Error("Stripe unavailable")),
			},
		} as never;

		await expect(resolveBillingProductForPrice("price_new", stripe)).rejects.toThrow("Stripe unavailable");
	});
});
