export const consentServices = [
	{
		id: "chatwoot",
		name: "Live support chat",
		category: "functionality",
		description: "Loads our support chat and remembers a conversation.",
		provider: "Chatwoot (self-hosted)",
		storage: "Cookie and local storage",
		scope: "External domain",
	},
	{
		id: "sentry-replay",
		name: "Sentry Session Replay",
		category: "measurement",
		description: "Records a masked view of a sampled session to diagnose errors.",
		provider: "Sentry",
		storage: "Session storage",
		scope: "Third-party service",
	},
	{
		id: "sentry-rum",
		name: "Sentry performance measurement",
		category: "measurement",
		description: "Measures page loads and navigation performance in real browsers.",
		provider: "Sentry",
		storage: "No cookies",
		scope: "Third-party service",
	},
	{
		id: "affiliate-tracker",
		name: "Affiliate tracking",
		category: "marketing",
		description: "Attributes visits and referrals to our affiliate program.",
		provider: "Clipify Affiliate",
		storage: "Cookie",
		scope: "External domain",
	},
] as const;

export const necessaryConsentServices = [
	{
		id: "consent-storage",
		name: "Privacy preferences",
		description: "Stores your privacy choice so Clipify can apply it across visits.",
		provider: "Clipify / c15t",
		storage: "Local storage",
		scope: "First-party",
	},
	{
		id: "cloudflare-turnstile",
		name: "Cloudflare Turnstile",
		description: "Protects forms from automated abuse without advertising or cross-site tracking.",
		provider: "Cloudflare",
		storage: "Local storage",
		scope: "Third-party service",
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
