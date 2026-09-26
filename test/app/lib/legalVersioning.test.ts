/** @jest-environment node */

import { classifyLegalChange } from "@lib/legal/versioning";

describe("legal versioning", () => {
	it.each(["broadened-purpose", "new-data-category", "new-recipient", "legal-basis-change", "new-transfer", "optional-to-necessary", "category-move", "longer-retention", "sale-or-sharing", "behavioral-advertising", "profiling"] as const)("requires review for material change %s", (change) => {
		expect(classifyLegalChange(change)).toEqual({ classification: "material", requiresVersionChange: true, requiresConsentOrNoticeDecision: true });
	});

	it.each(["typographical", "display-only", "restrictive-pattern"] as const)("keeps meaning-preserving change %s editorial", (change) => {
		expect(classifyLegalChange(change)).toEqual({ classification: "editorial", requiresVersionChange: false, requiresConsentOrNoticeDecision: false });
	});
});
