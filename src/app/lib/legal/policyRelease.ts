import { consentServices, necessaryConsentServices } from "../consent/registry";
import { legalDocuments } from "./documents";
import type { PolicyReleaseInput } from "./validation";

const services = [...necessaryConsentServices, ...consentServices];

export const canonicalPolicyRelease = {
	documents: legalDocuments,
	services,
	references: services.flatMap((service) =>
		service.policyReferences.map((reference) => ({
			documentId: reference.split(":", 1)[0],
			serviceId: service.id,
		})),
	),
	operatorFactsConfirmed: true,
	auditResult: "pass",
} as const satisfies PolicyReleaseInput;
