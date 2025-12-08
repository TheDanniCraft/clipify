import type { Tier } from "./pricing-types";

import { TiersEnum, Frequency, FrequencyEnum } from "./pricing-types";

export const frequencies: Array<Frequency> = [
	{ key: FrequencyEnum.Yearly, label: "Pay Yearly", priceSuffix: "per year" },
	{ key: FrequencyEnum.Monthly, label: "Pay Monthly", priceSuffix: "per month" },
];

export const tiers: Array<Tier> = [
	{
		key: TiersEnum.Free,
		title: "Free",
		price: "Free",
		featured: false,
		mostPopular: false,
		description: "Perfect for getting started and keeping your stream active.",
		features: ["Unlimited clips", "One overlay", "Plug & Play setup", "Control which clips play", "Keeps your stream entertained"],
		buttonText: "Start for Free",
		buttonColor: "default",
		buttonVariant: "solid",
	},
	{
		key: TiersEnum.Pro,
		title: "Pro",
		description: "Unlock advanced features for professional streamers.",
		mostPopular: true,
		price: {
			[FrequencyEnum.Yearly]: "20€",
			[FrequencyEnum.Monthly]: "2€",
		},
		discountedPrice: {
			[FrequencyEnum.Monthly]: "1€",
			[FrequencyEnum.Yearly]: "10€",
		},
		featured: false,
		features: ["Everything in Free", "Multiple overlays", "Channel points integration", "Priority support", "Control your overlay via chat", "Access to beta features", "Access to all upcoming features", "Support an independent developer"],
		buttonText: "Get started",
		buttonColor: "primary",
		buttonVariant: "shadow",
	},
];
