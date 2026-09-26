import { consentServices, necessaryConsentServices } from "@lib/consent/registry";
import { legalDocuments } from "./documents";

export const documentProvenance = legalDocuments.map(({ id }) => ({
	documentId: id,
	authorship: "adapted" as const,
	sourceNotes: ["Existing Clipify AdOpt documents used with provider-confirmed permission", "Verified Clipify product behavior and operator facts", "Official EU/EEA and German baseline requirements"],
}));

export const serviceEvidenceLinks = [...necessaryConsentServices, ...consentServices].map(({ id, policyReferences, auditFlows }) => ({
	serviceId: id,
	disclosureReferences: policyReferences,
	auditFlows,
}));
