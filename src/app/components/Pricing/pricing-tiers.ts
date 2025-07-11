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
		buttonVariant: "ghost",
	},
	{
		key: TiersEnum.Pro,
		title: "Pro",
		description: "Unlock advanced features for professional streamers.",
		mostPopular: true,
		price: {
			[FrequencyEnum.Yearly]: "$10",
			[FrequencyEnum.Monthly]: "$1",
		},
		featured: false,
		features: ["Everything in Free", "Multiple overlays", "Channel points integration (coming soon)", "Priority support", "Support an independent developer"],
		buttonText: "Get started",
		buttonColor: "primary",
		buttonVariant: "shadow",
	},
];
