export enum TiersEnum {
	Free = "free",
	Pro = "pro",
}

export enum FrequencyEnum {
	Yearly = "yearly",
	Monthly = "monthly",
}

export type Frequency = {
	key: FrequencyEnum;
	label: string;
	priceSuffix: string;
};

export type Tier = {
	key: TiersEnum;
	title: string;
	price:
		| {
				[FrequencyEnum.Yearly]: string;
				[FrequencyEnum.Monthly]: string;
		  }
		| string;
	discountedPrice?: {
		[FrequencyEnum.Yearly]?: string;
		[FrequencyEnum.Monthly]?: string;
	};
	description?: string;
	mostPopular?: boolean;
	featured?: boolean;
	features?: string[];
	summaryFeatures?: string[];
	personalNote?: string;
	buttonText: string;
};

export type RuntimePrice = { amount: number | null; currency: string; formatted: string };
export type RuntimePricing = {
	pro: Record<FrequencyEnum, RuntimePrice>;
	runner: Record<FrequencyEnum, RuntimePrice>;
};

export const unavailableRuntimePricing: RuntimePricing = {
	pro: {
		[FrequencyEnum.Monthly]: { amount: null, currency: "EUR", formatted: "Unavailable" },
		[FrequencyEnum.Yearly]: { amount: null, currency: "EUR", formatted: "Unavailable" },
	},
	runner: {
		[FrequencyEnum.Monthly]: { amount: null, currency: "EUR", formatted: "Unavailable" },
		[FrequencyEnum.Yearly]: { amount: null, currency: "EUR", formatted: "Unavailable" },
	},
};

export function resolveRuntimePricing(pricing?: RuntimePricing | null) {
	return pricing ?? unavailableRuntimePricing;
}
