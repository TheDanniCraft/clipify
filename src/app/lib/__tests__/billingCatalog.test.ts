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

	it("uses the live Pro prices in production", () => {
		process.env.APP_ENV = "production";
		const catalog = getBillingCatalog();
		expect(catalog[BillingProduct.Pro]).toEqual({ monthly: "price_1S83PSB0sp7KYCWLzhUkxodR", yearly: "price_1S83Y2B0sp7KYCWL0YDGoqjG" });
		expect(getAllConfiguredPriceIds()).toHaveLength(2);
	});

	it("accepts the prod alias for the production catalog", () => {
		process.env.APP_ENV = "prod";
		expect(getBillingCatalog()[BillingProduct.Pro]).toEqual({ monthly: "price_1S83PSB0sp7KYCWLzhUkxodR", yearly: "price_1S83Y2B0sp7KYCWL0YDGoqjG" });
	});

	it("uses the production catalog when APP_ENV is unset in production", () => {
		delete process.env.APP_ENV;
		mutableEnv.NODE_ENV = "production";
		expect(getBillingCatalog()[BillingProduct.Pro]).toEqual({ monthly: "price_1S83PSB0sp7KYCWLzhUkxodR", yearly: "price_1S83Y2B0sp7KYCWL0YDGoqjG" });
	});

	it("keeps the development Pro prices in development", () => {
		process.env.APP_ENV = "development";
		expect(getBillingCatalog()[BillingProduct.Pro]).toEqual({ monthly: "price_1SnM3MBg46KdNQq5MjHMYyYw", yearly: "price_1SnMAsBg46KdNQq5k8cI6Y8M" });
	});

	it("uses stable lookup keys for purchasable products", () => {
		expect(getPriceLookupKey(BillingProduct.Pro, "monthly")).toBe("clipify_pro_monthly");
		expect(getPriceLookupKey(BillingProduct.Pro, "yearly")).toBe("clipify_pro_yearly");
		expect(getPriceLookupKeys(BillingProduct.Pro, "monthly")).toEqual(["clipify_pro_monthly"]);
	});
});
