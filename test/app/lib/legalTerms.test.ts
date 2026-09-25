/** @jest-environment node */

import { termsSections } from "@lib/legal/terms";

describe("service terms", () => {
	it("contains every required terms topic", () => {
		expect(termsSections.map((section) => section.id)).toEqual(["acceptance", "provider", "eligibility", "service-scope", "accounts", "external-platforms", "acceptable-use", "user-content", "intellectual-property", "billing", "cancellation", "runner-responsibilities", "availability-and-changes", "suspension-and-termination", "disclaimers", "mandatory-law-liability", "changes-to-terms", "governing-law", "severability"]);
		expect(termsSections.every((section) => section.title && section.summary)).toBe(true);
		expect(termsSections.flatMap(({ details = [], items = [] }) => [...details, ...items]).length).toBeGreaterThan(30);
	});
});
