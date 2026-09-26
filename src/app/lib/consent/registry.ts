export const consentServices = [
	{
		id: "chatwoot",
		name: "Live support chat",
		category: "functionality",
		description: "Loads our support chat and remembers a conversation.",
		purpose: "Provide user-requested live support and preserve the conversation between visits.",
		provider: "Chatwoot (self-hosted)",
		dataCategories: ["Support messages", "Contact details", "Technical identifiers"],
		recipient: "Clipify support through its self-hosted Chatwoot service",
		hostingRegions: ["European Union"],
		retention: "Until the support conversation is resolved or deletion is requested, subject to applicable retention duties.",
		legalBasis: "Consent for optional support functionality; contract steps when support is requested.",
		consentRequired: true,
		revocation: "Stops loading Chatwoot on subsequent page loads and removes removable Chatwoot browser storage.",
		policyReferences: ["privacy:communications-and-support", "cookies:functionality"],
		auditFlows: ["public:functionality-enabled"],
		networkOrigins: ["https://chat.cloud.thedannicraft.de"],
		storageDeclarations: [
			{ type: "cookie", name: "cw_conversation" },
			{ type: "localStorage", pattern: "^chatwoot_(available_agents|campaigns)_[A-Za-z0-9_-]{1,64}(?::ts)?$" },
		],
		storage: "Cookie and local storage",
		scope: "External domain",
	},
	{
		id: "sentry-replay",
		name: "Sentry Session Replay",
		category: "measurement",
		description: "Records a masked view of a sampled session to diagnose errors.",
		purpose: "Diagnose browser errors with a sampled, masked reconstruction of user-visible interactions.",
		provider: "Sentry",
		dataCategories: ["Masked interaction data", "Browser and device metadata", "Error context"],
		recipient: "Functional Software, Inc. (Sentry)",
		hostingRegions: ["European Union"],
		retention: "According to the configured Sentry project retention period.",
		legalBasis: "Consent.",
		consentRequired: true,
		revocation: "Stops new replay recording and clears removable replay browser state.",
		policyReferences: ["privacy:analytics-observability-and-logs", "cookies:measurement"],
		auditFlows: ["public:measurement-enabled"],
		networkOrigins: ["https://ingest.de.sentry.io"],
		storageDeclarations: [{ type: "sessionStorage", name: "sentryReplaySession" }],
		storage: "Session storage",
		scope: "Third-party service",
	},
	{
		id: "sentry-rum",
		name: "Sentry performance measurement",
		category: "measurement",
		description: "Measures page loads and navigation performance in real browsers.",
		purpose: "Measure real-world page-load and navigation performance and correlate browser failures.",
		provider: "Sentry",
		dataCategories: ["Performance timings", "Browser and device metadata", "Request and route metadata"],
		recipient: "Functional Software, Inc. (Sentry)",
		hostingRegions: ["European Union"],
		retention: "According to the configured Sentry project retention period.",
		legalBasis: "Consent.",
		consentRequired: true,
		revocation: "Stops new browser performance events after the consent choice is applied.",
		policyReferences: ["privacy:analytics-observability-and-logs", "cookies:measurement"],
		auditFlows: ["public:measurement-enabled"],
		networkOrigins: ["https://browser.sentry-cdn.com"],
		storage: "No cookies",
		scope: "Third-party service",
	},
] as const;

export const necessaryConsentServices = [
	{
		id: "clipify-authentication",
		name: "Clipify authentication",
		category: "necessary",
		description: "Secures sign-in, the active account session, and short-lived authentication redirects.",
		purpose: "Authenticate account access and protect OAuth and administrator session transitions.",
		provider: "Clipify",
		dataCategories: ["Account identifier", "Session claims", "Authentication nonce"],
		recipient: "Clipify",
		hostingRegions: ["European Union"],
		retention: "Authentication nonces expire after ten minutes; account sessions expire after two hours; administrator-view cookies are limited to their active session.",
		legalBasis: "Contract performance and legitimate interest in secure account access.",
		consentRequired: false,
		necessityRationale: "The user-requested sign-in and authenticated application cannot operate securely without short-lived authentication state.",
		revocation: "Signing out removes the active account session; short-lived authentication state expires automatically.",
		policyReferences: ["privacy:security-and-consent-records", "cookies:necessary"],
		auditFlows: ["authenticated:legal", "public:protected-form"],
		networkOrigins: ["https://clipify.us"],
		storageDeclarations: [
			{ type: "cookie", name: "token" },
			{ type: "cookie", name: "auth_nonce" },
			{ type: "cookie", name: "admin_view" },
			{ type: "cookie", name: "admin_view_session" },
		],
		storage: "Cookies",
		scope: "First-party",
	},
	{
		id: "consent-storage",
		name: "Privacy preferences",
		category: "necessary",
		description: "Stores your privacy choice so Clipify can apply it across visits.",
		purpose: "Remember and demonstrate the visitor's privacy choices.",
		provider: "Clipify / c15t",
		dataCategories: ["Consent choices", "Consent metadata", "Language"],
		recipient: "Clipify and its self-hosted consent service",
		hostingRegions: ["European Union"],
		retention: "Six months, followed by renewal of the consent choice.",
		legalBasis: "Legal obligation and legitimate interest in recording privacy choices.",
		consentRequired: false,
		necessityRationale: "User-requested privacy choices cannot be applied or evidenced without this record.",
		revocation: "The necessary preference record remains available so later choices can be applied.",
		policyReferences: ["privacy:security-and-consent-records", "cookies:necessary"],
		auditFlows: ["public:default"],
		networkOrigins: ["https://clipify.us"],
		storageDeclarations: [
			{ type: "cookie", name: "c15t" },
			{ type: "localStorage", name: "c15t" },
		],
		storage: "Cookie and local storage",
		scope: "First-party",
	},
	{
		id: "cloudflare-turnstile",
		name: "Cloudflare Turnstile",
		category: "necessary",
		description: "Protects forms from automated abuse without advertising or cross-site tracking.",
		purpose: "Protect forms and authentication entry points from automated abuse.",
		provider: "Cloudflare",
		dataCategories: ["Security signals", "Browser and device metadata", "Network metadata"],
		recipient: "Cloudflare, Inc.",
		hostingRegions: ["European Union and Cloudflare network locations"],
		retention: "According to Cloudflare's Turnstile security retention configuration.",
		legalBasis: "Legitimate interest in service security and abuse prevention.",
		consentRequired: false,
		necessityRationale: "Security-critical abuse prevention protects the form or authentication flow requested by the visitor.",
		revocation: "Always active only on protected flows; no optional consent is claimed.",
		policyReferences: ["privacy:security-and-consent-records", "cookies:necessary"],
		auditFlows: ["public:protected-form"],
		networkOrigins: ["https://challenges.cloudflare.com"],
		storageDeclarations: [{ type: "localStorage", pattern: "^cf\\.turnstile\\.[A-Za-z0-9._-]{1,80}$" }],
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
} as const;

export type StorageDeclarationInput = { type: string; name?: string; pattern?: string };

export function findConsentServicesForOrigin(origin: string) {
	return [...necessaryConsentServices, ...consentServices].filter((service) => service.networkOrigins.some((candidate) => candidate === origin));
}

function isBoundedStoragePattern(pattern: string): boolean {
	return pattern.startsWith("^") && pattern.endsWith("$") && pattern.length <= 200 && !pattern.includes(".*") && !pattern.includes(".+");
}

export function matchesStorageDeclaration(declaration: StorageDeclarationInput, observedName: string): boolean {
	if (declaration.name) return declaration.name === observedName;
	if (!declaration.pattern || !isBoundedStoragePattern(declaration.pattern)) return false;

	try {
		return new RegExp(declaration.pattern).test(observedName);
	} catch {
		return false;
	}
}

export function validateConsentServiceDeclaration(service: { storage: string; storageDeclarations?: readonly StorageDeclarationInput[] }): string[] {
	const errors: string[] = [];
	if (service.storage === "No cookies" && service.storageDeclarations?.some((entry) => (entry.type === "cookie" || entry.type === "localStorage" || entry.type === "sessionStorage") && entry.name)) {
		errors.push("A no-storage service cannot declare cookie or web-storage keys.");
	}
	if (service.storageDeclarations?.some((entry) => entry.pattern && !isBoundedStoragePattern(entry.pattern))) errors.push("Storage patterns must be anchored and bounded.");

	return errors;
}
