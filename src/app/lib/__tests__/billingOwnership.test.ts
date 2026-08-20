import { BillingProduct, type UserEntitlements } from "@types";
import { isProductOwnedByEntitlement } from "../billingOwnership";

function entitlements(overrides: Partial<UserEntitlements>): UserEntitlements {
	return { effectivePlan: "free", proAccess: false, runnerAccess: false, isBillingPro: false, reverseTrialActive: false, trialEndsAt: null, hasActiveGrant: false, source: "reverse_trial", ...overrides };
}

describe("billing ownership", () => {
	it("allows a reverse-trial user to purchase Pro", () => {
		expect(isProductOwnedByEntitlement(BillingProduct.Pro, entitlements({ effectivePlan: "pro", proAccess: true, reverseTrialActive: true }))).toBe(false);
	});

	it("does not sell Pro over paid or manually granted Pro access", () => {
		expect(isProductOwnedByEntitlement(BillingProduct.Pro, entitlements({ effectivePlan: "pro", proAccess: true, isBillingPro: true, source: "billing" }))).toBe(true);
		expect(isProductOwnedByEntitlement(BillingProduct.Pro, entitlements({ effectivePlan: "pro", proAccess: true, hasActiveGrant: true, source: "grant" }))).toBe(true);
	});
});
