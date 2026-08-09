import { BillingProduct } from "@types";
import { getBillingCatalog, getAllConfiguredPriceIds, getPriceLookupKey, getPriceLookupKeys } from "../billingCatalog";

describe("billing catalog", () => {
	const mutableEnv = process.env as Record<string, string | undefined>;
	const originalAppEnv = process.env.APP_ENV;
	const originalNodeEnv = process.env.NODE_ENV;

	afterEach(() => {
		if (originalAppEnv === undefined) delete process.env.APP_ENV;
		else process.env.APP_ENV = originalAppEnv;
		if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
		else mutableEnv.NODE_ENV = originalNodeEnv;
	});

	it("uses the live Runner prices in production", () => {
		process.env.APP_ENV = "production";
		const catalog = getBillingCatalog();
		expect(catalog[BillingProduct.RunnerSelfHosted]).toEqual({ monthly: "price_1TyChaB0sp7KYCWLCcW0BNTZ", yearly: "price_1TyChhB0sp7KYCWLBVMtucQJ" });
		expect(getAllConfiguredPriceIds()).toHaveLength(4);
	});

	it("accepts the prod alias for the production catalog", () => {
		process.env.APP_ENV = "prod";
		expect(getBillingCatalog()[BillingProduct.RunnerSelfHosted]).toEqual({ monthly: "price_1TyChaB0sp7KYCWLCcW0BNTZ", yearly: "price_1TyChhB0sp7KYCWLBVMtucQJ" });
	});

	it("uses the production catalog when APP_ENV is unset in production", () => {
		delete process.env.APP_ENV;
		mutableEnv.NODE_ENV = "production";
		expect(getBillingCatalog()[BillingProduct.RunnerSelfHosted]).toEqual({ monthly: "price_1TyChaB0sp7KYCWLCcW0BNTZ", yearly: "price_1TyChhB0sp7KYCWLBVMtucQJ" });
	});

	it("keeps the development Runner prices in development", () => {
		process.env.APP_ENV = "development";
		expect(getBillingCatalog()[BillingProduct.RunnerSelfHosted]).toEqual({ monthly: "price_1TsLIKBg46KdNQq5wLcoek8z", yearly: "price_1TsLILBg46KdNQq5sJNQa1Ka" });
	});

	it("uses stable lookup keys for purchasable products", () => {
		expect(getPriceLookupKey(BillingProduct.Pro, "monthly")).toBe("clipify_pro_monthly");
		expect(getPriceLookupKey(BillingProduct.RunnerSelfHosted, "yearly")).toBe("clipify_runner_yearly");
		expect(getPriceLookupKeys(BillingProduct.Pro, "monthly")).toEqual(["clipify_pro_monthly"]);
	});
});
