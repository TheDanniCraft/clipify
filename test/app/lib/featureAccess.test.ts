import type { AuthenticatedUser, UserEntitlements } from "@types";
import { Plan } from "@types";
import { getFeatureAccess, getTrialDaysLeft, isReverseTrialActive } from "@/app/lib/featureAccess";

type TestUser = Pick<AuthenticatedUser, "plan" | "createdAt" | "entitlements">;

function buildEntitlements(partial?: Partial<UserEntitlements>): UserEntitlements {
	return {
		effectivePlan: "free",
		isBillingPro: false,
		reverseTrialActive: false,
		trialEndsAt: null,
		hasActiveGrant: false,
		source: "billing",
		...partial,
	};
}

function buildUser(partial?: Partial<TestUser>): TestUser {
	return {
		plan: Plan.Free,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		entitlements: buildEntitlements(),
		...partial,
	};
}

describe("lib/featureAccess", () => {
	it("allows all features for effective pro entitlement", () => {
		const user = buildUser({
			entitlements: buildEntitlements({
				effectivePlan: "pro",
				source: "reverse_trial",
			}),
		});

		expect(getFeatureAccess(user, "chat_commands")).toEqual({ allowed: true, reason: "trial" });
		expect(getFeatureAccess(user, "advanced_filters")).toEqual({ allowed: true, reason: "trial" });
	});

	it("allows all features for billed pro users", () => {
		const user = buildUser({ plan: Plan.Pro });
		expect(getFeatureAccess(user, "editors")).toEqual({ allowed: true });
	});

	it("allows features while reverse trial is active", () => {
		const user = buildUser({
			entitlements: buildEntitlements({
				reverseTrialActive: true,
				effectivePlan: "free",
			}),
		});

		expect(isReverseTrialActive(user)).toBe(true);
		expect(getFeatureAccess(user, "chat_commands")).toEqual({ allowed: true, reason: "trial" });
	});

	it("returns correct free-plan denial reasons", () => {
		const user = buildUser();
		expect(getFeatureAccess(user, "multi_overlay")).toEqual({ allowed: false, reason: "free_limit" });
		expect(getFeatureAccess(user, "chat_commands")).toEqual({ allowed: false, reason: "trial_expired" });
	});

	it("calculates trial days left from entitlements date", () => {
		const user = buildUser({
			entitlements: buildEntitlements({
				trialEndsAt: "2026-01-05T00:00:00.000Z",
			}),
		});
		expect(getTrialDaysLeft(user, new Date("2026-01-03T12:00:00.000Z"))).toBe(2);
		expect(getTrialDaysLeft(user, new Date("2026-01-06T00:00:00.000Z"))).toBe(0);
	});
});
