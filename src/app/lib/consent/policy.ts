import { policyBuilder } from "@c15t/backend";
import { CONSENT_LIFETIME_DAYS } from "./lifetime";

const worldwideConsent = {
	model: "opt-in" as const,
	copyRevision: "statistics-product-analytics-v1",
	prompt: "choice" as const,
	validity: { choiceDays: CONSENT_LIFETIME_DAYS },
	scopeMode: "strict" as const,
	categories: ["functionality", "measurement"],
	preselectedCategories: [],
	actions: ["accept", "reject", "customize"] as ("accept" | "reject" | "customize")[],
	i18n: { language: "en" },
	proof: { storeIp: false, storeUserAgent: false, storeLanguage: true },
};

const fallback = policyBuilder.create({ id: "clipify_worldwide_unknown", fallback: true, ...worldwideConsent });

export const consentPolicyRules = [fallback, policyBuilder.create({ id: "clipify_worldwide", isDefault: true, ...worldwideConsent })];
