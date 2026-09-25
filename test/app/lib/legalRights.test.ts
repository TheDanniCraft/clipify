/** @jest-environment node */

import { privacyRequestGuidance } from "@lib/legal/rights";

describe("privacy request guidance", () => {
	it("provides the complete request process without requiring an account", () => {
		expect(privacyRequestGuidance.intentions).toEqual(["access", "correction", "deletion", "portability", "restriction", "objection", "consent withdrawal", "complaint or privacy question"]);
		expect(privacyRequestGuidance.contact).toEqual(expect.objectContaining({ email: expect.stringMatching(/@clipify\.us$/), accountRequired: false }));
		expect(privacyRequestGuidance.processStages).toEqual(expect.arrayContaining(["submission", "identity verification", "assessment", "response"]));
		expect(privacyRequestGuidance.complaintRoutes.length).toBeGreaterThan(0);
	});

	it("requires safe and proportionate identity verification", () => {
		expect(privacyRequestGuidance.initialRequestDoNotInclude).toEqual(expect.arrayContaining(["passwords", "authentication secrets", "Twitch access or refresh tokens"]));
		expect(privacyRequestGuidance.verification).toMatch(/reasonably needed.*identity and authority/i);
		expect(privacyRequestGuidance.verification).toMatch(/do not require a passport/i);
	});

	it("qualifies rights and outcomes", () => {
		const guidance = privacyRequestGuidance.qualifications.join(" ");

		expect(guidance).toMatch(/legal requirements/i);
		expect(guidance).toMatch(/retained for tax/i);
		expect(privacyRequestGuidance.timing).toMatch(/within one month/i);
		expect(privacyRequestGuidance.costs).toMatch(/normally free/i);
	});
});
