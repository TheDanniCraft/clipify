export type LegalDocumentManifestEntry = {
	id: string;
	route: string;
	title: string;
	description: string;
	version: string;
	effectiveDate: string;
	updatedDate: string;
	scope: string;
};

const initialPolicyMetadata = {
	version: "1.0.0",
	effectiveDate: "2026-09-25",
	updatedDate: "2026-09-25",
	scope: "One English document set using the EU/EEA and German legal baseline.",
} as const;

export const legalDocumentRoutes = {
	privacy: "/legal/privacy",
	cookies: "/legal/cookies",
	terms: "/legal/terms",
	privacyRequests: "/legal/privacy-requests",
	imprint: "/imprint",
} as const;

export const legalDocuments: readonly LegalDocumentManifestEntry[] = [
	{ id: "privacy", route: legalDocumentRoutes.privacy, title: "Privacy Policy", description: "How Clipify collects, uses, shares, and protects personal data.", ...initialPolicyMetadata },
	{ id: "cookies", route: legalDocumentRoutes.cookies, title: "Cookie Policy", description: "Which services and browser storage Clipify uses, and how you can manage optional choices.", ...initialPolicyMetadata },
	{ id: "terms", route: legalDocumentRoutes.terms, title: "Terms of Service", description: "The rules that apply when you use Clipify and the self-hosted Runner.", ...initialPolicyMetadata },
	{ id: "privacy-requests", route: legalDocumentRoutes.privacyRequests, title: "Privacy Requests", description: "How to exercise your privacy rights and what to expect after contacting us.", ...initialPolicyMetadata },
	{ id: "imprint", route: legalDocumentRoutes.imprint, title: "Imprint", description: "Provider and contact information for Clipify.", ...initialPolicyMetadata },
];

export type LegalDocumentSection = {
	id: string;
	title: string;
	summary: string;
};

export const privacyPolicySections: readonly LegalDocumentSection[] = [
	{
		id: "controller-and-contact",
		title: "Controller and contact",
		summary: "Clipify is operated by Daniel Trui, Einzelunternehmer, Frankenweg 12, 75438 Knittlingen, Germany. Privacy questions can be sent to contact@clipify.us.",
	},
	{
		id: "data-categories-and-sources",
		title: "Data categories and sources",
		summary: "Clipify processes account, Twitch, subscription, support, consent, security, device, usage, and technical diagnostic data supplied by you, connected services, and your use of Clipify.",
	},
	{
		id: "purposes-and-legal-bases",
		title: "Purposes and legal bases",
		summary: "Processing supports requested services and contracts, legal obligations, security and other legitimate interests, and consent-based optional functionality or measurement where applicable.",
	},
	{
		id: "account-authentication",
		title: "Account authentication",
		summary: "Authentication data is used to create sessions, protect accounts, and provide signed-in Clipify features.",
	},
	{
		id: "twitch-integrations",
		title: "Twitch integrations",
		summary: "Connected Twitch account, channel, chat, clip, moderation, and event data is processed to provide the integrations a user configures.",
	},
	{
		id: "payments",
		title: "Payments and subscriptions",
		summary: "Subscription, transaction, invoice, and account-reference data is processed with payment providers to administer paid plans, accounting, refunds, and fraud prevention.",
	},
	{
		id: "communications-and-support",
		title: "Communications and support",
		summary: "Contact details, messages, and support context are processed to answer requests, deliver service communications, and send opted-in product updates.",
	},
	{
		id: "security-and-consent-records",
		title: "Security and consent records",
		summary: "Clipify retains proportionate security, abuse-prevention, authentication, and consent evidence needed to protect the service and demonstrate user choices.",
	},
	{
		id: "analytics-observability-and-logs",
		title: "Analytics, observability, and logs",
		summary: "Self-hosted audience statistics and consent-controlled browser diagnostics are used alongside server logs and error monitoring to understand reliability, performance, and failures.",
	},
	{
		id: "self-hosted-components",
		title: "Self-hosted components",
		summary: "Some Clipify components are operated on infrastructure controlled by Clipify, while the optional Runner is installed and administered in the user's own environment.",
	},
	{
		id: "recipients-and-processors",
		title: "Recipients and processors",
		summary: "Data is shared only with the service providers, connected platforms, and authorities required for the purposes described in the reviewed service inventory.",
	},
	{
		id: "international-transfers",
		title: "International transfers",
		summary: "Where a provider processes data outside the EU or EEA, the applicable location and reviewed transfer safeguard are identified in that service's disclosure.",
	},
	{
		id: "retention",
		title: "Retention",
		summary: "Data is kept only for the stated period or while needed for the service, security, legal, accounting, dispute, and evidentiary purposes described for each processing activity.",
	},
	{
		id: "security-principles",
		title: "Security principles",
		summary: "Clipify applies access controls, encryption where appropriate, secret separation, updates, monitoring, and data minimization proportionate to the service and risk.",
	},
	{
		id: "individual-rights",
		title: "Individual rights",
		summary: "Depending on applicable law and the request, individuals may seek access, correction, deletion, portability, restriction, objection, or withdrawal of consent.",
	},
	{
		id: "complaint-routes",
		title: "Questions and complaints",
		summary: "Individuals may contact Clipify first and may also complain to the competent data-protection supervisory authority.",
	},
	{
		id: "consent-withdrawal",
		title: "Consent withdrawal",
		summary: "Optional consent can be changed through Cookie preferences with effect for future processing; withdrawal does not invalidate processing performed before it.",
	},
	{
		id: "children",
		title: "Children and eligibility",
		summary: "Age and eligibility rules are stated in the Terms, and any processing that requires consent or guardian authorization is handled according to the applicable requirements.",
	},
	{
		id: "material-changes",
		title: "Policy changes",
		summary: "Material changes are versioned and reviewed to decide whether additional notice or renewed consent is required before the changed processing begins.",
	},
];
