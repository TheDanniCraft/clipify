import { policyBuilder } from "@c15t/backend";

const worldwideConsent = {
	model: "opt-in" as const,
	expiryDays: 180,
	scopeMode: "strict" as const,
	categories: ["necessary", "functionality", "measurement", "marketing"],
	preselectedCategories: ["necessary"],
	uiMode: "banner" as const,
	banner: { allowedActions: ["accept", "reject", "customize"] as ("accept" | "reject" | "customize")[] },
	dialog: { allowedActions: ["accept", "reject", "customize"] as ("accept" | "reject" | "customize")[] },
	i18n: { language: "en" },
	proof: { storeIp: false, storeUserAgent: false, storeLanguage: true },
};

const fallback = policyBuilder.create({ id: "clipify_worldwide_unknown", ...worldwideConsent });

export const consentPolicyPacks = [{ ...fallback, match: { fallback: true } }, policyBuilder.create({ id: "clipify_worldwide", isDefault: true, ...worldwideConsent })];
