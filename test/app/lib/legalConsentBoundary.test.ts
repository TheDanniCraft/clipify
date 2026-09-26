/** @jest-environment node */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { findLegalConsentBoundaryViolations } from "@lib/legal/consentBoundary";

function readSources(directory: string): { path: string; content: string }[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return readSources(path);
		if (!/\.tsx?$/.test(entry.name) || entry.name === "consentBoundary.ts") return [];
		return [{ path: relative(process.cwd(), path), content: readFileSync(path, "utf8") }];
	});
}

describe("legal consent boundary", () => {
	it("keeps legal modules read-only toward c15t", () => {
		const legalSources = [...readSources("src/app/lib/legal"), ...readSources("src/app/components/legal"), ...readSources("src/app/legal")];

		expect(findLegalConsentBoundaryViolations(legalSources)).toEqual([]);
		expect(findLegalConsentBoundaryViolations([{ path: "mutant.ts", content: "localStorage.setItem('c15t', value)" }])).toEqual([{ path: "mutant.ts", capability: "consent persistence" }]);
	});
});
