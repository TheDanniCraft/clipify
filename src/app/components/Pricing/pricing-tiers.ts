import type { Tier } from "./pricing-types";

import { TiersEnum } from "./pricing-types";

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
		price: "$5 (Twitch Sub)",
		featured: false,
		features: ["Everything in Free", "Multiple overlays", "Channel points integration (coming soon)", "Priority support", "Support an independent developer"],
		buttonText: "Get started",
		buttonColor: "primary",
		buttonVariant: "shadow",
	},
];
