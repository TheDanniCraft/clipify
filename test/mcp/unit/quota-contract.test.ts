/** @jest-environment node */
export {};
let quota: any;
try {
	quota = require("@/server/resources/quota");
} catch {}
describe("shared creation quota primitives", () => {
	test.each(["overlay", "playlist"])("Free %s allows its first resource and rejects one or twenty existing resources", (kind) => {
		expect(quota?.assertCreationQuota).toEqual(expect.any(Function));
		expect(quota.assertCreationQuota("free", kind, 0)).toBeUndefined();
		for (const usage of [1, 20]) {
			try {
				quota.assertCreationQuota("free", kind, usage);
				throw new Error("unexpected acceptance");
			} catch (error) {
				expect(error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage, limit: 1 });
			}
		}
	});
	test.each(["overlay", "playlist"])("Pro %s has no count limit", (kind) => {
		expect(quota?.assertCreationQuota).toEqual(expect.any(Function));
		expect(quota.assertCreationQuota("pro", kind, 20)).toBeUndefined();
		expect(quota.assertCreationQuota("pro", kind, 100000)).toBeUndefined();
	});
	test.each([-1, NaN, Infinity, 0.1, "0"])("invalid stored usage %p fails closed", (usage) => {
		expect(quota?.assertCreationQuota).toEqual(expect.any(Function));
		expect(() => quota.assertCreationQuota("free", "overlay", usage)).toThrow("SERVICE_UNAVAILABLE");
	});
});
