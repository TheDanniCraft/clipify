export const privacyRequestGuidance = {
	intentions: ["access", "correction", "deletion", "portability", "restriction", "objection", "consent withdrawal", "complaint or privacy question"],
	contact: { email: "contact@clipify.us", accountRequired: false },
	processStages: ["submission", "identity verification", "assessment", "response"],
	complaintRoutes: ["Contact Clipify directly", "Contact the competent data-protection supervisory authority, including the Baden-Württemberg authority where applicable"],
	initialRequestDoNotInclude: ["passwords", "authentication secrets", "Twitch tokens", "full payment credentials"],
	verification: "Clipify establishes sufficient identity and authority before disclosing or deleting personal data, using information proportionate to the request risk.",
	qualifications: ["Rights apply where applicable under the relevant law and the circumstances of the request.", "A lawful exception can limit or delay a requested action without removing the general request channel.", "Deletion and restriction remain subject to legal retention obligations, security needs, accounting, fraud prevention, and dispute records.", "Clipify explains any permitted response extension, partial fulfillment, or refusal and the available complaint route."],
} as const;
