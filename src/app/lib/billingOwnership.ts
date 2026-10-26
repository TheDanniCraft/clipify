import { BillingProduct, type UserEntitlements } from "@types";

export function isProductOwnedByEntitlement(product: BillingProduct, entitlements: UserEntitlements) {
	if (product === BillingProduct.Pro) return entitlements.proAccess && !entitlements.reverseTrialActive;
	return false;
}
