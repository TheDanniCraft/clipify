import { deriveRunnerCapabilities } from "@/server/runner/capabilities";

test("UX-C1: retired Runner-only access cannot unlock paid broadcasting or watermark removal", () => {
	const retiredInput = { proAccess: false, runnerAccess: true, runnerSource: "legacy" as const };
	expect(deriveRunnerCapabilities(retiredInput)).toMatchObject({ runnerPro: false, scheduling: false, customStandby: false, attributionRequired: true, maxTargets: 1, maxActiveBroadcasts: 1 });
});

test("UX-C2: the public entitlement and billing catalogs expose only Pro", async () => {
	const { Entitlement, BillingProduct } = await import("@types");
	expect(Object.values(Entitlement)).toEqual(["pro_access"]);
	expect(Object.values(BillingProduct)).toEqual(["pro"]);
});
