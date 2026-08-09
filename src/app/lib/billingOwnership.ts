import { BillingProduct, type UserEntitlements } from "@types";

export function isProductOwnedByEntitlement(product: BillingProduct, entitlements: UserEntitlements) {
	if (product === BillingProduct.Pro) return entitlements.proAccess && !entitlements.reverseTrialActive;
	if (product === BillingProduct.RunnerSelfHosted) return entitlements.runnerAccess;
	return false;
}
