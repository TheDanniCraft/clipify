import { policyBuilder } from "@c15t/backend";
import { CONSENT_LIFETIME_DAYS } from "./lifetime";

const worldwideConsent = {
	model: "opt-in" as const,
	expiryDays: CONSENT_LIFETIME_DAYS,
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
