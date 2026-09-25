/** @jest-environment node */

import { complianceScope } from "@lib/legal/scope";

describe("legal scope", () => {
	it("defines one scoped English EU and German document set", () => {
		expect(complianceScope.documentSets).toEqual([{ language: "en", regionalVariant: false }]);
		expect(complianceScope.baseline).toMatch(/EU\/EEA.*German/i);
		expect(complianceScope.futureReviewTriggers).toEqual(expect.arrayContaining(["local establishment or targeting", "statutory threshold", "materially new processing", "qualified legal advice"]));
		expect(complianceScope.worldwideComplianceGuaranteed).toBe(false);
	});
});
