/** @jest-environment node */

import { termsSections } from "@lib/legal/terms";

describe("service terms", () => {
	it("contains every required terms topic", () => {
		expect(termsSections.map((section) => section.id)).toEqual(["service-scope", "eligibility", "accounts", "external-platforms", "acceptable-use", "user-content", "billing", "cancellation", "runner-responsibilities", "availability-and-changes", "suspension-and-termination", "mandatory-law-liability", "governing-law", "disputes"]);
		expect(termsSections.every((section) => section.title && section.summary)).toBe(true);
	});
});
