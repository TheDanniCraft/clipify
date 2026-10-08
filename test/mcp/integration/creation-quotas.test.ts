/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("TDD-US3 shared backend creation quota prerequisites", () => {
	test("20 independent session/OAuth creates share one Free owner quota", () => {
		const result = flowProbe("creation:free").createResult;
		expect(result.serviceAvailable).toBe(true);
		expect(result).toMatchObject({ successes: 1, resources: 1 });
		expect(result.denials).toHaveLength(19);
		expect(new Set(result.denials)).toEqual(new Set(["PLAN_LIMIT_REACHED"]));
	});
	test("the same shared backend permits all 20 creates for a current Pro owner", () => {
		const result = flowProbe("creation:pro").createResult;
		expect(result.serviceAvailable).toBe(true);
		expect(result).toMatchObject({ successes: 20, resources: 20, denials: [] });
	});
	test("a current partner entitlement grants Pro limits to a billing-Free owner", () => {
		const result = flowProbe("creation:grant").createResult;
		expect(result).toMatchObject({ serviceAvailable: true, successes: 20, resources: 20, denials: [] });
	});

	test("removing current membership denies both session and previously approved OAuth creation", () => {
		const result = flowProbe("creation:denied").createResult;
		expect(result).toMatchObject({ serviceAvailable: true, successes: 0, resources: 0 });
		expect(result.denials).toHaveLength(20);
		expect(new Set(result.denials)).toEqual(new Set(["ACCESS_DENIED"]));
	});
});

describe("shared backend playlist creation quota", () => {
	test("20 independent session/OAuth creates share one Free playlist allowance", () => {
		const result = flowProbe("creation:playlist-free").createResult;
		expect(result).toMatchObject({ serviceAvailable: true, successes: 1, resources: 1 });
		expect(result.denials).toHaveLength(19);
		expect(new Set(result.denials)).toEqual(new Set(["PLAN_LIMIT_REACHED"]));
	});
	test.each(["pro", "grant"])("20 creates are allowed for current %s entitlement", (variant) => {
		expect(flowProbe(`creation:playlist-${variant}`).createResult).toMatchObject({ serviceAvailable: true, successes: 20, resources: 20, denials: [] });
	});
	test("current membership removal denies session and OAuth playlist creation", () => {
		const result = flowProbe("creation:playlist-denied").createResult;
		expect(result).toMatchObject({ serviceAvailable: true, successes: 0, resources: 0 });
		expect(result.denials).toHaveLength(20);
		expect(new Set(result.denials)).toEqual(new Set(["ACCESS_DENIED"]));
	});
});
