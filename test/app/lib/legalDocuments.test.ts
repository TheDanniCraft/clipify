/** @jest-environment node */

import { legalDocuments } from "@lib/legal/documents";

describe("legal document manifest", () => {
	it("exposes exactly the five required unique local routes", () => {
		const routes = legalDocuments.map((document) => document.route);

		expect(routes).toEqual(["/legal/privacy", "/legal/cookies", "/legal/terms", "/legal/privacy-requests", "/legal/imprint"]);
		expect(new Set(routes).size).toBe(routes.length);
		for (const route of routes) {
			expect(route).toMatch(/^\/(?!\/)/);
		}
	});

	it("provides publishable metadata for every legal document", () => {
		for (const document of legalDocuments) {
			expect(document.title).toEqual(expect.any(String));
			expect(document.title.trim()).not.toBe("");
			expect(document.version).toMatch(/^\d+\.\d+\.\d+$/);
			expect(document.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(document.updatedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(document.scope).toBe("One English document set using the EU/EEA and German legal baseline.");
		}
	});
});
