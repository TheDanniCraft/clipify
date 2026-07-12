import { BillingProduct } from "@types";

export type BillingCycle = "monthly" | "yearly";

type ProductPrices = Record<BillingCycle, string>;

const PRODUCTS: Record<"dev" | "prod", Record<BillingProduct, ProductPrices>> = {
	dev: {
		[BillingProduct.Pro]: {
			monthly: "price_1SnM3MBg46KdNQq5MjHMYyYw",
			yearly: "price_1SnMAsBg46KdNQq5k8cI6Y8M",
		},
		[BillingProduct.RunnerSelfHosted]: {
			monthly: "price_1TsLIKBg46KdNQq5wLcoek8z",
			yearly: "price_1TsLILBg46KdNQq5sJNQa1Ka",
		},
	},
	prod: {
		[BillingProduct.Pro]: {
			monthly: "price_1S83PSB0sp7KYCWLzhUkxodR",
			yearly: "price_1S83Y2B0sp7KYCWL0YDGoqjG",
		},
		[BillingProduct.RunnerSelfHosted]: {
			monthly: process.env.STRIPE_RUNNER_MONTHLY_PRICE_ID ?? "",
			yearly: process.env.STRIPE_RUNNER_YEARLY_PRICE_ID ?? "",
		},
	},
};

export function getBillingCatalog() {
	return PRODUCTS[process.env.NODE_ENV === "production" ? "prod" : "dev"];
}

export function getPriceId(product: BillingProduct, cycle: BillingCycle) {
	const priceId = getBillingCatalog()[product]?.[cycle];
	if (!priceId) throw new Error(`Missing Stripe price for ${product}:${cycle}`);
	return priceId;
}

export function getProductForPrice(priceId: string) {
	for (const [product, prices] of Object.entries(getBillingCatalog()) as Array<[BillingProduct, ProductPrices]>) {
		if (Object.values(prices).includes(priceId)) return product;
	}
	return null;
}

export function getAllConfiguredPriceIds() {
	return Object.values(getBillingCatalog())
		.flatMap((prices) => Object.values(prices))
		.filter(Boolean);
}
