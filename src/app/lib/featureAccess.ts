import type { AuthenticatedUser } from "@types";
import { Plan } from "@types";

export type FeatureKey = "multi_overlay" | "multi_playlist" | "chat_commands" | "advanced_filters" | "editors";
export type AccessContext = { allowed: boolean; reason?: "trial" | "free_limit" | "trial_expired" | "pro_required" };

export function isReverseTrialActive(user: Pick<AuthenticatedUser, "plan" | "createdAt" | "entitlements">) {
	return Boolean(user.entitlements?.reverseTrialActive);
}

export function getTrialDaysLeft(user: Pick<AuthenticatedUser, "plan" | "createdAt" | "entitlements">, now = new Date()) {
	if (user.entitlements?.trialEndsAt) {
		const trialEndMs = (user.entitlements.trialEndsAt instanceof Date ? user.entitlements.trialEndsAt : new Date(user.entitlements.trialEndsAt)).getTime();
		if (!Number.isFinite(trialEndMs)) return 0;
		const msLeft = trialEndMs - now.getTime();
		if (msLeft <= 0) return 0;
		return Math.ceil(msLeft / (24 * 60 * 60 * 1000));
	}
	return 0;
}

export function getFeatureAccess(user: Pick<AuthenticatedUser, "plan" | "createdAt" | "entitlements">, feature: FeatureKey): AccessContext {
	if (user.entitlements?.effectivePlan === "pro") {
		return { allowed: true, reason: user.entitlements.source === "reverse_trial" ? "trial" : undefined };
	}

	if (user.plan === Plan.Pro) {
		return { allowed: true };
	}

	if (isReverseTrialActive(user)) {
		return { allowed: true, reason: "trial" };
	}

	switch (feature) {
		case "multi_overlay":
		case "multi_playlist":
			return { allowed: false, reason: "free_limit" };
		case "chat_commands":
		case "advanced_filters":
		case "editors":
			return { allowed: false, reason: "trial_expired" };
		default:
			return { allowed: false, reason: "pro_required" };
	}
}
