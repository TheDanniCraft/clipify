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
		features: [
			"Unlimited clips",
			"One overlay",
			"One playlist (up to 50 clips)",
			"Playlist overlay type",
			"Manual playlist curation",
			"Plug & Play setup",
			"Random playback mode",
			"Basic clip filtering",
			"Keeps your stream entertained",
			"Basic clip player for embedding in websites",
		],
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
			[FrequencyEnum.Yearly]: "20 EUR",
			[FrequencyEnum.Monthly]: "2 EUR",
		},
		discountedPrice: {
			[FrequencyEnum.Monthly]: "1 EUR",
			[FrequencyEnum.Yearly]: "10 EUR",
		},
		featured: false,
		features: [
			"Everything in Free",
			"Multiple overlays",
			"Unlimited playlists and playlist clips",
			"Auto import playlists with advanced filters",
			"Append or replace behavior on playlist import",
			"Channel points integration",
			"Control your overlay via chat",
			"Remote control panel for live playback control",
			"Add editors and managers to help run your overlays",
			"Advanced clip filtering",
			"Additional playback modes: Top and Smart Shuffle",
			"Theme Studio",
			"Advanced clip player for embedding in websites",
			"Priority support",
			"Access to beta and upcoming features",
			"Support an independent developer",
		],
		buttonText: "Get started",
		buttonColor: "primary",
		buttonVariant: "shadow",
	},
];
