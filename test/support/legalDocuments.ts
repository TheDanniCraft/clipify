import type { LegalDocumentManifestEntry } from "../../src/app/lib/legal/documents";

export function buildLegalDocument(overrides: Partial<LegalDocumentManifestEntry> = {}): LegalDocumentManifestEntry {
	return {
		id: "privacy",
		route: "/legal/privacy",
		title: "Privacy Policy",
		description: "How Clipify collects, uses, shares, and protects personal data.",
		version: "1.0.0",
		effectiveDate: "2026-09-25",
		updatedDate: "2026-09-25",
		scope: "One English document set using the EU/EEA and German legal baseline.",
		...overrides,
	};
}
