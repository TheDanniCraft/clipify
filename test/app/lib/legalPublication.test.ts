/** @jest-environment node */

import { validatePolicyRelease } from "@lib/legal/validation";

const validRelease = {
	documents: [{ id: "privacy", title: "Privacy Policy", route: "/legal/privacy", version: "1.0.0", effectiveDate: "2026-09-25", updatedDate: "2026-09-25", scope: "EU/EEA and German baseline" }],
	services: [
		{
			id: "consent-storage",
			name: "Privacy preferences",
			category: "necessary",
			description: "Stores the visitor's privacy choices.",
			provider: "Clipify",
			purpose: "Remember privacy choices",
			dataCategories: ["Consent choices"],
			recipient: "Clipify",
			hostingRegions: ["European Union"],
			retention: "Six months",
			legalBasis: "Legal obligation",
			consentRequired: false,
			revocation: "The necessary preference record remains available.",
			policyReferences: ["privacy:security-and-consent-records"],
			auditFlows: ["public:default"],
			networkOrigins: ["https://clipify.us"],
			storage: "Local storage",
			scope: "First-party",
			storageDeclarations: [{ type: "localStorage", name: "c15t" }],
		},
	],
	references: [{ documentId: "privacy", serviceId: "consent-storage" }],
	operatorFactsConfirmed: true,
	auditResult: "pass" as const,
};

describe("legal publication validation", () => {
	it("accepts the exact complete release baseline", () => {
		expect(validatePolicyRelease(validRelease)).toEqual({ valid: true, errors: [] });
	});

	it.each(["id", "title", "route", "version", "effectiveDate", "updatedDate", "scope"] as const)("identifies a missing mandatory document %s", (field) => {
		const document = { ...validRelease.documents[0], [field]: "" };
		const result = validatePolicyRelease({ ...validRelease, documents: [document] });
		expect(result.errors).toContain(`documents.${field === "id" ? "0" : "privacy"}.${field} is required`);
	});

	it.each(["id", "name", "category", "description", "provider", "purpose", "recipient", "retention", "legalBasis", "revocation", "storage", "scope"] as const)("identifies a missing mandatory service %s", (field) => {
		const service = { ...validRelease.services[0], [field]: "" };
		const result = validatePolicyRelease({ ...validRelease, services: [service] });
		expect(result.errors).toContain(`services.${field === "id" ? "0" : "consent-storage"}.${field} is required`);
	});

	it.each(["dataCategories", "hostingRegions", "policyReferences", "auditFlows", "networkOrigins"] as const)("identifies an empty mandatory service %s collection", (field) => {
		const service = { ...validRelease.services[0], [field]: [] };
		const result = validatePolicyRelease({ ...validRelease, services: [service] });
		expect(result.errors).toContain(`services.consent-storage.${field} requires at least one value`);
	});

	it("rejects pending placeholders in publication data", () => {
		const release = { ...validRelease, documents: [{ ...validRelease.documents[0], scope: "TBD after legal review" }] };
		expect(validatePolicyRelease(release).errors).toContain("documents.privacy.scope contains a pending placeholder");
	});

	it("rejects unbounded storage patterns", () => {
		const release = { ...validRelease, services: [{ ...validRelease.services[0], storageDeclarations: [{ type: "localStorage", pattern: ".*" }] }] };
		expect(validatePolicyRelease(release).errors).toContain("services.consent-storage.storageDeclarations.0.pattern must be anchored and bounded");
	});

	it("rejects consent classifications that contradict the category", () => {
		const release = { ...validRelease, services: [{ ...validRelease.services[0], category: "measurement", consentRequired: false }] };
		expect(validatePolicyRelease(release).errors).toContain("services.consent-storage.consentRequired conflicts with category measurement");
	});

	it.each([
		["inconsistent reference", { ...validRelease, references: [{ documentId: "missing", serviceId: "consent-storage" }] }, "references.0 points to an unknown document or service"],
		["orphaned disclosure", { ...validRelease, references: [] }, "services.consent-storage has no policy reference"],
		["pending operator fact", { ...validRelease, operatorFactsConfirmed: false }, "operator facts require confirmation"],
		["failed audit", { ...validRelease, auditResult: "fail" as const }, "compliance audit must pass"],
	] as const)("blocks publication for %s", (_label, release, expectedError) => {
		const result = validatePolicyRelease(release);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain(expectedError);
	});
});
