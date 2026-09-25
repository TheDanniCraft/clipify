type PolicyDocumentInput = {
	id?: string;
	title?: string;
	route?: string;
	version?: string;
	effectiveDate?: string;
	updatedDate?: string;
	scope?: string;
};

type PolicyStorageDeclarationInput = { type?: string; name?: string; pattern?: string };

type PolicyServiceInput = {
	id?: string;
	name?: string;
	category?: string;
	description?: string;
	provider?: string;
	purpose?: string;
	dataCategories?: readonly string[];
	recipient?: string;
	hostingRegions?: readonly string[];
	retention?: string;
	legalBasis?: string;
	consentRequired?: boolean;
	revocation?: string;
	policyReferences?: readonly string[];
	auditFlows?: readonly string[];
	networkOrigins?: readonly string[];
	storage?: string;
	scope?: string;
	storageDeclarations?: readonly PolicyStorageDeclarationInput[];
};

export type PolicyReleaseInput = {
	documents: readonly PolicyDocumentInput[];
	services: readonly PolicyServiceInput[];
	references: readonly { documentId: string; serviceId: string }[];
	operatorFactsConfirmed: boolean;
	auditResult: "pass" | "fail";
};

const pendingPlaceholder = /\b(?:todo|tbd|pending|placeholder|needs? confirmation)\b/i;
const documentTextFields = ["id", "title", "route", "version", "effectiveDate", "updatedDate", "scope"] as const;
const serviceTextFields = ["id", "name", "category", "description", "provider", "purpose", "recipient", "retention", "legalBasis", "revocation", "storage", "scope"] as const;
const serviceCollectionFields = ["dataCategories", "hostingRegions", "policyReferences", "auditFlows", "networkOrigins"] as const;

function hasBoundedPattern(pattern: string) {
	if (!pattern.startsWith("^") || !pattern.endsWith("$") || pattern.length > 200 || pattern.includes(".*") || pattern.includes(".+")) return false;
	try {
		new RegExp(pattern);
		return true;
	} catch {
		return false;
	}
}

function validateRequiredText(errors: string[], prefix: string, value: string | undefined) {
	if (!value?.trim()) errors.push(`${prefix} is required`);
	else if (pendingPlaceholder.test(value)) errors.push(`${prefix} contains a pending placeholder`);
}

export function validatePolicyRelease(release: PolicyReleaseInput) {
	const errors: string[] = [];

	release.documents.forEach((document, index) => {
		const label = document.id?.trim() || String(index);
		for (const field of documentTextFields) validateRequiredText(errors, `documents.${field === "id" ? index : label}.${field}`, document[field]);
		if (document.route?.trim() && !document.route.startsWith("/")) errors.push(`documents.${label}.route must be a local route`);
		for (const field of ["effectiveDate", "updatedDate"] as const) {
			const value = document[field];
			if (value?.trim() && Number.isNaN(Date.parse(`${value}T00:00:00Z`))) errors.push(`documents.${label}.${field} must be a valid date`);
		}
	});

	release.services.forEach((service, index) => {
		const label = service.id?.trim() || String(index);
		for (const field of serviceTextFields) validateRequiredText(errors, `services.${field === "id" ? index : label}.${field}`, service[field]);
		for (const field of serviceCollectionFields) {
			const values = service[field];
			if (!values?.length) errors.push(`services.${label}.${field} requires at least one value`);
			else if (values.some((value) => !value.trim() || pendingPlaceholder.test(value))) errors.push(`services.${label}.${field} contains an empty or pending value`);
		}

		if (service.category && !["necessary", "functionality", "measurement"].includes(service.category)) errors.push(`services.${label}.category is unsupported`);
		if ((service.category === "necessary" && service.consentRequired !== false) || (service.category && service.category !== "necessary" && service.consentRequired !== true)) {
			errors.push(`services.${label}.consentRequired conflicts with category ${service.category}`);
		}
		if (service.scope && !["First-party", "Third-party service", "External domain"].includes(service.scope)) errors.push(`services.${label}.scope is unsupported`);
		if (service.storage === "No cookies" && service.storageDeclarations?.length) errors.push(`services.${label}.storageDeclarations conflict with no-storage declaration`);
		if (service.storage && service.storage !== "No cookies" && !service.storageDeclarations?.length) errors.push(`services.${label}.storageDeclarations requires at least one value`);

		service.storageDeclarations?.forEach((declaration, declarationIndex) => {
			const prefix = `services.${label}.storageDeclarations.${declarationIndex}`;
			validateRequiredText(errors, `${prefix}.type`, declaration.type);
			if (!declaration.name?.trim() && !declaration.pattern?.trim()) errors.push(`${prefix} requires an exact name or bounded pattern`);
			if (declaration.pattern && !hasBoundedPattern(declaration.pattern)) errors.push(`${prefix}.pattern must be anchored and bounded`);
		});

		if (!release.references.some((reference) => reference.serviceId === service.id)) errors.push(`services.${label} has no policy reference`);
	});

	const documentIds = new Set(release.documents.map(({ id }) => id).filter(Boolean));
	const serviceIds = new Set(release.services.map(({ id }) => id).filter(Boolean));
	if (documentIds.size !== release.documents.filter(({ id }) => id?.trim()).length) errors.push("document ids must be unique");
	if (serviceIds.size !== release.services.filter(({ id }) => id?.trim()).length) errors.push("service ids must be unique");
	release.references.forEach((reference, index) => {
		if (!documentIds.has(reference.documentId) || !serviceIds.has(reference.serviceId)) errors.push(`references.${index} points to an unknown document or service`);
	});
	if (!release.operatorFactsConfirmed) errors.push("operator facts require confirmation");
	if (release.auditResult !== "pass") errors.push("compliance audit must pass");
	return { valid: errors.length === 0, errors };
}
