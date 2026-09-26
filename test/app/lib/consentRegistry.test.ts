/** @jest-environment node */

import fc from "fast-check";
import { consentCategoryDetails, consentServices, findConsentServicesForOrigin, matchesStorageDeclaration, necessaryConsentServices, validateConsentServiceDeclaration } from "@lib/consent/registry";
import { privacyPolicySections } from "@lib/legal/documents";

describe("consent disclosure registry", () => {
	it("pins the reviewed service inventory before validating each declaration", () => {
		expect(necessaryConsentServices.map(({ id }) => id)).toEqual(["clipify-authentication", "consent-storage", "cloudflare-turnstile"]);
		expect(consentServices.map(({ id }) => id)).toEqual(["chatwoot", "sentry-replay", "sentry-rum"]);
	});

	it("provides complete declarations", () => {
		const services = [...necessaryConsentServices, ...consentServices];

		for (const service of services) {
			expect(service).toEqual(
				expect.objectContaining({
					id: expect.any(String),
					name: expect.any(String),
					category: expect.stringMatching(/^(necessary|functionality|measurement)$/),
					purpose: expect.any(String),
					provider: expect.any(String),
					dataCategories: expect.arrayContaining([expect.any(String)]),
					recipient: expect.any(String),
					hostingRegions: expect.arrayContaining([expect.any(String)]),
					retention: expect.any(String),
					legalBasis: expect.any(String),
					consentRequired: expect.any(Boolean),
					revocation: expect.any(String),
					policyReferences: expect.arrayContaining([expect.any(String)]),
					auditFlows: expect.arrayContaining([expect.any(String)]),
				}),
			);
		}
	});

	it("rejects incomplete mandatory disclosure fields", () => {
		const services = [...necessaryConsentServices, ...consentServices];
		const requiredTextFields = ["id", "name", "description", "purpose", "provider", "recipient", "retention", "legalBasis", "revocation", "storage", "scope"] as const;

		for (const service of services) {
			for (const field of requiredTextFields) expect(service[field].trim()).not.toBe("");
			expect(service.dataCategories.every((value) => value.trim().length > 0)).toBe(true);
			expect(service.hostingRegions.every((value) => value.trim().length > 0)).toBe(true);
			expect(service.networkOrigins.every((value) => value.trim().length > 0)).toBe(true);
			expect(service.scope).toMatch(/^(First-party|Third-party service|External domain)$/);

			if (service.storage !== "No cookies") {
				expect("storageDeclarations" in service ? service.storageDeclarations : undefined).toEqual(expect.arrayContaining([expect.objectContaining({ type: expect.any(String) })]));
			}
		}
	});

	it("requires a reviewed necessity rationale", () => {
		for (const service of necessaryConsentServices) {
			expect(service).toEqual(
				expect.objectContaining({
					necessityRationale: expect.stringMatching(/(user-requested|security-critical)/i),
				}),
			);
		}
	});

	it("maps every service to existing policy sections and reviewed audit flows", () => {
		const services = [...necessaryConsentServices, ...consentServices];
		const privacySections = new Set(privacyPolicySections.map(({ id }) => id));
		const cookieSections = new Set(Object.keys(consentCategoryDetails));
		const reviewedAuditFlows = new Set(["public:default", "authenticated:legal", "public:protected-form", "public:functionality-enabled", "public:measurement-enabled"]);

		for (const service of services) {
			expect(service.policyReferences.length).toBeGreaterThan(0);
			for (const reference of service.policyReferences) {
				const [document, section, ...extra] = reference.split(":");
				expect(extra).toHaveLength(0);
				expect(document === "privacy" ? privacySections.has(section) : document === "cookies" && cookieSections.has(section)).toBe(true);
			}
			expect(service.auditFlows.length).toBeGreaterThan(0);
			for (const flow of service.auditFlows) expect(reviewedAuditFlows.has(flow)).toBe(true);
		}
	});

	it("rejects storage keys on a no-storage declaration", () => {
		const errors = validateConsentServiceDeclaration({
			storage: "No cookies",
			storageDeclarations: [{ type: "localStorage", name: "unexpected_key" }],
		});

		expect(errors).toContain("A no-storage service cannot declare cookie or web-storage keys.");
	});

	it("accepts only bounded matching storage patterns", () => {
		const declaration = {
			type: "localStorage",
			pattern: "^chatwoot_(available_agents|campaigns)_[A-Za-z0-9_-]{1,64}(?::ts)?$",
		};

		expect(validateConsentServiceDeclaration({ storage: "Local storage", storageDeclarations: [declaration] })).toEqual([]);
		expect(matchesStorageDeclaration(declaration, "chatwoot_campaigns_widget-123:ts")).toBe(true);
		fc.assert(
			fc.property(fc.string({ minLength: 1, maxLength: 40 }), (suffix) => {
				expect(matchesStorageDeclaration(declaration, `unrelated_${suffix}`)).toBe(false);
			}),
		);
	});

	it.each([
		["missing start anchor", "chatwoot_[A-Za-z0-9_-]{1,64}$"],
		["missing end anchor", "^chatwoot_[A-Za-z0-9_-]{1,64}"],
		["unbounded wildcard", "^chatwoot_.*$"],
		["unbounded required wildcard", "^chatwoot_.+$"],
		["overlong expression", `^${"a".repeat(199)}$`],
	] as const)("rejects unsafe storage pattern: %s", (_case, pattern) => {
		expect(validateConsentServiceDeclaration({ storage: "Local storage", storageDeclarations: [{ type: "localStorage", pattern }] })).toContain("Storage patterns must be anchored and bounded.");
		expect(matchesStorageDeclaration({ type: "localStorage", pattern }, "chatwoot_example")).toBe(false);
	});

	it("assigns each external origin to exactly one service", () => {
		const services = [...necessaryConsentServices, ...consentServices];
		const externalOrigins = services.flatMap((service) => service.networkOrigins.filter((origin) => !origin.startsWith("https://clipify.us")));

		expect(new Set(externalOrigins).size).toBe(externalOrigins.length);
		for (const origin of externalOrigins) expect(findConsentServicesForOrigin(origin)).toHaveLength(1);
	});
});
