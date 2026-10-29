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
};

export const unavailableRuntimePricing: RuntimePricing = {
	pro: {
		[FrequencyEnum.Monthly]: { amount: null, currency: "EUR", formatted: "Unavailable" },
		[FrequencyEnum.Yearly]: { amount: null, currency: "EUR", formatted: "Unavailable" },
	},
};

export function resolveRuntimePricing(pricing?: RuntimePricing | null) {
	return pricing ?? unavailableRuntimePricing;
}

export function annualSavingsPercent(pricing?: RuntimePricing | null): number | null {
	if (!pricing) return null;
	const { monthly, yearly } = pricing.pro;
	if (monthly.currency !== yearly.currency || monthly.amount === null || yearly.amount === null || monthly.amount <= 0 || yearly.amount < 0) return null;
	const saving = Math.floor((1 - yearly.amount / (monthly.amount * 12)) * 100);
	return saving > 0 ? saving : null;
}

export function annualSavingsLabel(pricing?: RuntimePricing | null): string | null {
	const percent = annualSavingsPercent(pricing);
	if (percent === null || !pricing) return null;
	const months = 12 - pricing.pro.yearly.amount! / pricing.pro.monthly.amount!;
	const rounded = Math.round(months);
	return rounded > 0 && Math.abs(months - rounded) < 0.0001 ? `${rounded} ${rounded === 1 ? "month" : "months"} free` : `Save ${percent}%`;
}
