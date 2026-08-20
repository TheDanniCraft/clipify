import { FrequencyEnum, TiersEnum, type Tier } from "./pricing-types";
import type { PricingFeatures } from "./pricing-comparison-types";

export const frequencies = [
	{ key: FrequencyEnum.Yearly, label: "Pay Yearly", priceSuffix: "per year" },
	{ key: FrequencyEnum.Monthly, label: "Pay Monthly", priceSuffix: "per month" },
];

export const tiers: Tier[] = [
	{
		key: TiersEnum.Free,
		title: "Free",
		price: "Free",
		featured: false,
		mostPopular: false,
		description: "Everything you need to get your clips on stream and online.",
		summaryFeatures: ["Unlimited Twitch clips", "One overlay and one 50-clip playlist", "One branded website gallery", "A shareable Creator Page", "Basic website Clip Player", "Essential playback and filtering"],
		features: ["Unlimited clips", "One overlay", "One playlist (up to 50 clips)", "One branded clip gallery (up to 50 live clips)", "Shareable Creator Page for your Twitch clips", "Playlist overlay type", "Manual playlist curation", "Plug & Play setup", "Random playback mode", "Basic clip filtering", "Keeps your stream entertained", "Basic clip player for embedding in websites"],
		buttonText: "Start for Free",
	},
	{
		key: TiersEnum.Pro,
		title: "Pro",
		description: "Advanced control, customization, and insights for serious creators.",
		mostPopular: true,
		price: {
			[FrequencyEnum.Yearly]: "Unavailable",
			[FrequencyEnum.Monthly]: "Unavailable",
		},
		discountedPrice: {
			[FrequencyEnum.Monthly]: "1 EUR",
			[FrequencyEnum.Yearly]: "10 EUR",
		},
		featured: false,
		summaryFeatures: ["Unlimited overlays, playlists, and galleries", "Advanced filters and playback modes", "Theme Studio and website customization", "Remote controls, chat, and channel points", "Editors and managers", "Creator analytics and CSV export"],
		personalNote: "Your subscription directly supports an independent developer building Clipify.",
		features: [
			"Everything in Free",
			"Multiple overlays",
			"Unlimited playlists and playlist clips",
			"Unlimited clip galleries",
			"Advanced gallery filters and up to 100 live clips",
			"Saved gallery themes and runtime styling",
			"Creator Page analytics",
			"Creator analytics CSV export",
			"Creator Page social preview customization",
			"Auto import playlists with advanced filters",
			"Append or replace behavior on playlist import",
			"Channel points integration",
			"Control your overlay via chat",
			"Community page shoutout",
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
		buttonText: "Get Pro",
	},
];

export const runnerAddon = {
	title: "Self-hosted Runner",
	description: "Run Clipify from your own hardware for continuous playback or as an OBS failsafe.",
	availability: "Available with Free or Pro",
	prices: {
		[FrequencyEnum.Monthly]: "Unavailable",
		[FrequencyEnum.Yearly]: "Unavailable",
	},
};

export const pricingFeatures: PricingFeatures = [
	{
		title: "Clips and playback",
		items: [
			{ title: "Twitch clips", tiers: { free: "Unlimited", pro: "Unlimited" }, helpText: "Import and use your available Twitch clips throughout Clipify." },
			{ title: "Playback modes", tiers: { free: "Random", pro: "Random, Top, and Smart Shuffle" }, helpText: "Choose how Clipify selects the next clip. Pro adds ranking and repeat-aware playback." },
			{ title: "Clip filtering", tiers: { free: "Essential filters", pro: "Advanced filters" }, helpText: "Advanced filters include creator, category, duration, title, views, and date controls where supported." },
			{ title: "Channel points integration", tiers: { free: false, pro: true }, helpText: "Let viewers add clips to your Viewer Queue by redeeming a Twitch channel points reward." },
		],
	},
	{
		title: "Overlays and playlists",
		items: [
			{ title: "Overlays", tiers: { free: "1", pro: "Unlimited" }, helpText: "Create separate player configurations for different scenes, channels, or workflows." },
			{ title: "Playlists", tiers: { free: "1", pro: "Unlimited" }, helpText: "Curate reusable clip collections and control their playback order." },
			{ title: "Clips per playlist", tiers: { free: "Up to 50", pro: "Unlimited" }, helpText: "The maximum number of clips that can be stored in an individual playlist." },
			{ title: "Automatic playlist imports", tiers: { free: false, pro: true }, helpText: "Create or refresh a playlist in one action from a selected streamer and filters such as date, category, creator, and views." },
			{ title: "Append or replace imports", tiers: { free: false, pro: true }, helpText: "Choose whether an automatic import adds to the current playlist or replaces its contents." },
		],
	},
	{
		title: "Websites and galleries",
		items: [
			{ title: "Clip Player", tiers: { free: "Basic", pro: "Advanced" }, helpText: "Embed a Clipify-powered player on another website using an iframe or Clipify Elements." },
			{ title: "Clip galleries", tiers: { free: "1", pro: "Unlimited" }, helpText: "Publish responsive collections of clips that visitors can browse and play on your website." },
			{ title: "Gallery clip limit", tiers: { free: "Up to 50", pro: "Up to 100 live results" }, helpText: "The maximum number of clips resolved for a gallery, depending on its curated or live source." },
			{ title: "Curated and live galleries", tiers: { free: true, pro: true }, helpText: "Use a hand-picked playlist or automatically resolve newest and most-viewed clips." },
			{ title: "Advanced gallery filters", tiers: { free: false, pro: true }, helpText: "Refine live galleries by dates, categories, creators, views, duration, and titles." },
			{ title: "Clipify Elements", tiers: { free: true, pro: true }, helpText: "Install Clipify's custom elements once and place responsive players or galleries anywhere on a website." },
			{ title: "Gallery themes and runtime styling", tiers: { free: false, pro: true }, helpText: "Save gallery colors and surfaces, then apply supported styling variables from the host website." },
			{
				title: "Gallery attribution",
				tiers: { free: "Included", pro: "Optional" },
				helpText: 'Free galleries include a small "Made with Clipify" banner. It helps other creators discover Clipify and helps us keep growing. With Pro, you can choose whether to show it.',
			},
		],
	},
	{
		title: "Creator Page and analytics",
		items: [
			{ title: "Shareable Creator Page", tiers: { free: true, pro: true }, helpText: "Share one public Clipify profile where viewers can discover and browse your clips." },
			{ title: "Search and Clipify discovery controls", tiers: { free: true, pro: true }, helpText: "Control whether your Creator Page can appear in search engines and Clipify discovery surfaces." },
			{ title: "Creator Page analytics", tiers: { free: false, pro: true }, helpText: "See visits, pageviews, engagement metrics, and trends for your Creator Page." },
			{ title: "Acquisition, location, and technology breakdowns", tiers: { free: false, pro: true }, helpText: "Understand where visitors came from and which countries, devices, browsers, and operating systems they use." },
			{ title: "Analytics CSV export", tiers: { free: false, pro: true }, helpText: "Download Creator Page performance and breakdown data for reporting or further analysis." },
			{ title: "Social preview customization", tiers: { free: false, pro: true }, helpText: "Customize how your Creator Page appears when its link is shared on supported social platforms." },
		],
	},
	{
		title: "Collaboration and live control",
		items: [
			{ title: "Remote Control Panel", tiers: { free: false, pro: true }, helpText: "Control live playback from a phone, tablet, or second monitor without switching OBS scenes." },
			{ title: "Chat commands", tiers: { free: false, pro: true }, helpText: "Use configured Twitch chat commands to control playback while live." },
			{ title: "Editors and managers", tiers: { free: false, pro: true }, helpText: "Grant trusted collaborators access to help manage your Clipify setup without sharing your account." },
		],
	},
	{
		title: "Customization and support",
		items: [
			{ title: "Theme Studio", tiers: { free: false, pro: true }, helpText: "Customize overlay layouts, colors, typography, effects, timers, and progress elements." },
			{ title: "Priority support", tiers: { free: false, pro: true }, helpText: "Pro support requests are prioritized when you need help with Clipify." },
			{ title: "Beta and upcoming features", tiers: { free: false, pro: true }, helpText: "Get access to selected beta capabilities and upcoming Pro features as they become available." },
		],
	},
];
