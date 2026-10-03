import { decideRetainedResourceAccess } from "@/server/entitlements/resource-policy";

describe("TDD-US5-013 retained resource capability enforcement", () => {
	it.each(["overlay", "playlist", "gallery"])("keeps every retained %s readable and deletable without granting paid mutation or runtime access", (kind) => {
		expect(decideRetainedResourceAccess({ effectivePlan: "free", resourceId: `${kind}-2`, freeResourceIds: [`${kind}-1`] })).toEqual({ effectivePlan: "free", read: true, delete: true, update: false, runtime: false, withinFreeAllowance: false });
	});

	it.each(["overlay", "playlist", "gallery"])("keeps the oldest %s inside the Free allowance active", (kind) => {
		expect(decideRetainedResourceAccess({ effectivePlan: "free", resourceId: `${kind}-1`, freeResourceIds: [`${kind}-1`] })).toMatchObject({ update: true, runtime: true, withinFreeAllowance: true });
	});

	it("does not restrict resources while Pro access is effective", () => {
		expect(decideRetainedResourceAccess({ effectivePlan: "pro", resourceId: "overlay-99", freeResourceIds: [] })).toMatchObject({ read: true, delete: true, update: true, runtime: true });
	});
});
