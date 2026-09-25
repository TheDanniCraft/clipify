/** @jest-environment node */

import fc from "fast-check";
import { auditInventory, runComplianceGate } from "./support/inventoryAudit";

describe("compliance inventory audit", () => {
	it("matches an exact storage name and approved origin once", () => {
		const result = auditInventory(
			[
				{ flowId: "public:default", kind: "localStorage", name: "c15t", value: "secret" },
				{ flowId: "public:default", kind: "origin", origin: "https://clipify.us" },
			],
			[{ serviceId: "consent-storage", storageNames: ["c15t"], storagePatterns: [], origins: ["https://clipify.us"] }],
		);

		expect(result.result).toBe("pass");
		expect(result.matches).toHaveLength(2);
		expect(result.matches.every((match) => match.serviceId === "consent-storage")).toBe(true);
	});

	it("matches bounded dynamic names and rejects non-matches", () => {
		const declarations = [{ serviceId: "chatwoot", storageNames: [], storagePatterns: ["^chatwoot_[A-Za-z0-9_-]{1,20}$"], origins: [] }];

		fc.assert(
			fc.property(fc.stringMatching(/^[A-Za-z0-9_-]{1,20}$/), (suffix) => {
				expect(auditInventory([{ flowId: "chat", kind: "localStorage", name: `chatwoot_${suffix}` }], declarations).result).toBe("pass");
				expect(auditInventory([{ flowId: "chat", kind: "localStorage", name: `unrelated_${suffix}` }], declarations).result).toBe("fail");
			}),
		);
	});

	it("fails with flow-specific findings for unknown or forbidden observations", () => {
		const result = auditInventory(
			[
				{ flowId: "authenticated:settings", kind: "localStorage", name: "undeclared_key" },
				{ flowId: "authenticated:settings", kind: "origin", origin: "https://tracker.example" },
			],
			[{ serviceId: "security", storageNames: [], storagePatterns: [], origins: [], forbiddenOrigins: ["https://tracker.example"] }],
		);

		expect(result.result).toBe("fail");
		expect(result.differences).toEqual([
			{ flowId: "authenticated:settings", kind: "localStorage", observed: "undeclared_key", reason: "unknown" },
			{ flowId: "authenticated:settings", kind: "origin", observed: "https://tracker.example", reason: "forbidden" },
		]);
	});

	it("produces value-free normalized evidence", () => {
		const result = auditInventory([{ flowId: "public:default", kind: "localStorage", name: "c15t", value: "never-retain-this-value" }], [{ serviceId: "consent-storage", storageNames: ["c15t"], storagePatterns: [], origins: [] }]);

		expect(result.evidence).toEqual([{ flowId: "public:default", kind: "localStorage", name: "c15t", serviceId: "consent-storage", classification: "matched" }]);
		expect(JSON.stringify(result)).not.toContain("never-retain-this-value");
	});

	it("fails the release gate when a required flow or observation kind is empty", () => {
		const result = runComplianceGate([{ flowId: "public:default", kind: "localStorage", name: "c15t" }], [{ serviceId: "consent-storage", storageNames: ["c15t"], storagePatterns: [], origins: [], scriptOrigins: [] }], {
			"public:default": ["localStorage", "script"],
			"authenticated:legal": ["cookie", "script"],
			"public:consent-enabled": ["cookie", "localStorage", "sessionStorage", "script", "origin"],
		});

		expect(result.result).toBe("fail");
		expect(result.missingObservations).toEqual([
			{ flowId: "public:default", kind: "script" },
			{ flowId: "authenticated:legal", kind: "cookie" },
			{ flowId: "authenticated:legal", kind: "script" },
			{ flowId: "public:consent-enabled", kind: "cookie" },
			{ flowId: "public:consent-enabled", kind: "localStorage" },
			{ flowId: "public:consent-enabled", kind: "sessionStorage" },
			{ flowId: "public:consent-enabled", kind: "script" },
			{ flowId: "public:consent-enabled", kind: "origin" },
		]);
	});

	it("treats external scripts separately from ordinary network origins", () => {
		const declarations = [{ serviceId: "chat", storageNames: [], storagePatterns: [], origins: ["https://chat.example"], scriptOrigins: ["https://chat.example"] }];
		const result = runComplianceGate(
			[
				{ flowId: "public:consent-enabled", kind: "script", origin: "https://chat.example" },
				{ flowId: "public:consent-enabled", kind: "origin", origin: "https://chat.example" },
			],
			declarations,
			{ "public:consent-enabled": ["script", "origin"] },
		);

		expect(result.result).toBe("pass");
		expect(result.evidence.map(({ kind }) => kind)).toEqual(["script", "origin"]);
	});
});
