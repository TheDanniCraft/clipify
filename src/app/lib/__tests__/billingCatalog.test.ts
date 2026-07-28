import { BillingProduct } from "@types";
import { getBillingCatalog, getAllConfiguredPriceIds } from "../billingCatalog";

describe("billing catalog", () => {
	const originalAppEnv = process.env.APP_ENV;

	afterEach(() => {
		if (originalAppEnv === undefined) delete process.env.APP_ENV;
		else process.env.APP_ENV = originalAppEnv;
	});

	it("uses the live Runner prices in production", () => {
		process.env.APP_ENV = "production";
		const catalog = getBillingCatalog();
		expect(catalog[BillingProduct.RunnerSelfHosted]).toEqual({ monthly: "price_1TyChaB0sp7KYCWLCcW0BNTZ", yearly: "price_1TyChhB0sp7KYCWLBVMtucQJ" });
		expect(getAllConfiguredPriceIds()).toHaveLength(4);
	});

	it("keeps the development Runner prices in development", () => {
		process.env.APP_ENV = "development";
		expect(getBillingCatalog()[BillingProduct.RunnerSelfHosted]).toEqual({ monthly: "price_1TsLIKBg46KdNQq5wLcoek8z", yearly: "price_1TsLILBg46KdNQq5sJNQa1Ka" });
	});
});
