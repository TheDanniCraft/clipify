export const consentServices = [
	{
		id: "chatwoot",
		name: "Live support chat",
		category: "functionality",
		description: "Loads our support chat and remembers a conversation.",
	},
	{
		id: "sentry-replay",
		name: "Sentry Session Replay",
		category: "measurement",
		description: "Records a masked view of a sampled session to diagnose errors.",
	},
	{
		id: "sentry-rum",
		name: "Sentry performance measurement",
		category: "measurement",
		description: "Measures page loads and navigation performance in real browsers.",
	},
	{
		id: "affiliate-tracker",
		name: "Affiliate tracking",
		category: "marketing",
		description: "Attributes visits and referrals to our affiliate program.",
	},
] as const;

export type OptionalConsentCategory = (typeof consentServices)[number]["category"];

export const consentCategoryDetails = {
	necessary: {
		title: "Strictly necessary",
		description: "Remembers your privacy choice and enables security and core site features. Always active.",
	},
	functionality: {
		title: "Functionality",
		description: "Enables optional features such as live support chat.",
	},
	measurement: {
		title: "Measurement",
		description: "Helps us understand real-world performance and diagnose issues with masked session replay.",
	},
	marketing: {
		title: "Marketing",
		description: "Supports affiliate and referral attribution.",
	},
} as const;
