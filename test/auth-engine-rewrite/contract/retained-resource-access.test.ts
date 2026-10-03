import { decideRetainedResourceAccess } from "@/server/entitlements/resource-policy";

describe("TDD-US5-013 retained resource capability enforcement", () => {
	it("keeps every resource readable and deletable without granting paid mutation or runtime access", () => {
		expect(decideRetainedResourceAccess({ effectivePlan: "free", resourceId: "overlay-2", freeResourceIds: ["overlay-1"] })).toEqual({ effectivePlan: "free", read: true, delete: true, update: false, runtime: false, withinFreeAllowance: false });
	});

	it("keeps the oldest resource inside the Free allowance active", () => {
		expect(decideRetainedResourceAccess({ effectivePlan: "free", resourceId: "overlay-1", freeResourceIds: ["overlay-1"] })).toMatchObject({ update: true, runtime: true, withinFreeAllowance: true });
	});

	it("does not restrict resources while Pro access is effective", () => {
		expect(decideRetainedResourceAccess({ effectivePlan: "pro", resourceId: "overlay-99", freeResourceIds: [] })).toMatchObject({ read: true, delete: true, update: true, runtime: true });
	});
});
