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
		expect(privacyRequestGuidance.initialRequestDoNotInclude).toEqual(["passwords", "authentication secrets", "Twitch tokens", "full payment credentials"]);
		expect(privacyRequestGuidance.verification).toMatch(/sufficient identity and authority.*before.*disclos|delet/i);
	});

	it("qualifies rights and outcomes", () => {
		const guidance = privacyRequestGuidance.qualifications.join(" ");

		expect(guidance).toMatch(/where applicable/i);
		expect(guidance).toMatch(/lawful exception/i);
		expect(guidance).toMatch(/retention obligation/i);
		expect(guidance).toMatch(/extension|refusal/i);
	});
});
