/** @jest-environment node */

import { consentServices, necessaryConsentServices } from "@lib/consent/registry";
import { legalDocuments } from "@lib/legal/documents";
import { documentProvenance, serviceEvidenceLinks } from "@lib/legal/provenance";

describe("legal traceability", () => {
	it("records complete document provenance and service evidence", () => {
		expect(documentProvenance.map(({ documentId }) => documentId).sort()).toEqual(legalDocuments.map(({ id }) => id).sort());
		expect(documentProvenance.every(({ authorship, sourceNotes }) => authorship === "adapted" && sourceNotes.length >= 3)).toBe(true);
		expect(serviceEvidenceLinks.map(({ serviceId }) => serviceId).sort()).toEqual([...necessaryConsentServices, ...consentServices].map(({ id }) => id).sort());
		expect(serviceEvidenceLinks.every(({ disclosureReferences, auditFlows }) => disclosureReferences.length > 0 && auditFlows.length > 0)).toBe(true);
	});
});
