import { consentServices, necessaryConsentServices } from "@lib/consent/registry";
import { legalDocuments } from "./documents";

export const documentProvenance = legalDocuments.map(({ id }) => ({
	documentId: id,
	authorship: "independent" as const,
	sourceNotes: ["Verified Clipify product behavior and operator facts", "Official EU/EEA and German baseline requirements"],
}));

export const serviceEvidenceLinks = [...necessaryConsentServices, ...consentServices].map(({ id, policyReferences, auditFlows }) => ({
	serviceId: id,
	disclosureReferences: policyReferences,
	auditFlows,
}));
