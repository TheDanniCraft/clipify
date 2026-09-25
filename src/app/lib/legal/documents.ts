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
	version: "1.1.0",
	effectiveDate: "2026-09-25",
	updatedDate: "2026-09-25",
	scope: "One English document set using the EU/EEA and German legal baseline.",
} as const;

export const legalDocumentRoutes = {
	privacy: "/legal/privacy",
	cookies: "/legal/cookies",
	terms: "/legal/terms",
	privacyRequests: "/legal/privacy-requests",
	imprint: "/legal/imprint",
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
	details?: readonly string[];
	items?: readonly string[];
};

export const privacyPolicySections: readonly LegalDocumentSection[] = [
	{
		id: "controller-and-contact",
		title: "1. Controller and contact",
		summary: "Clipify is operated by Daniel Trui, Frankenweg 12, 75438 Knittlingen, Germany. You can contact us about privacy matters at contact@clipify.us.",
		details: ["This policy applies to clipify.us, the Clipify web application, public overlays and creator pages, support interactions, and related services that refer to it. The separate Imprint contains the complete provider details."],
	},
	{
		id: "data-categories-and-sources",
		title: "2. Information we collect",
		summary: "The information we process depends on which Clipify features you use and which services you connect.",
		items: [
			"Account and Twitch data, including your Twitch user ID, login name, display name, profile image, email address, OAuth scopes and tokens, channel information, and account creation date.",
			"Clipify configuration and content, including overlays, playlists, clip references, playback rules, themes, commands, moderation queues, creator-page settings, and self-hosted Runner configuration.",
			"Twitch interaction data needed for enabled features, including clips, channel events, rewards, chat messages and commands, moderator status, and EventSub delivery metadata.",
			"Billing data, including plan, subscription status, Stripe customer and checkout references, invoices, payment status, and tax-related records. Clipify does not store complete card numbers.",
			"Communications and preferences, including support messages, newsletter subscriptions, product-update choices, feedback, privacy choices, and privacy requests.",
			"Technical and security data, including IP and network metadata, browser and device information, request and error details, timestamps, rate-limit data, audit records, and performance measurements.",
		],
		details: ["We receive this information from you, from your use of Clipify, from Twitch and other services you connect, from payment and support providers, and from public Twitch sources where a feature requires them."],
	},
	{
		id: "purposes-and-legal-bases",
		title: "3. Why we process information",
		summary: "We process personal data only for a defined purpose and with an applicable legal basis.",
		items: [
			"To create and operate your account, connect Twitch, provide overlays, process clips, apply your settings, and deliver paid features: performance of a contract or steps requested before entering one (Article 6(1)(b) GDPR).",
			"To process subscriptions, invoices, refunds, accounting, and legally required records: performance of a contract and compliance with legal obligations (Articles 6(1)(b) and 6(1)(c) GDPR).",
			"To secure Clipify, prevent abuse and fraud, diagnose backend failures, enforce our Terms, and establish or defend legal claims: our legitimate interests in operating a safe and reliable service (Article 6(1)(f) GDPR).",
			"To load optional support chat, browser performance monitoring, profiling, or Session Replay: your consent (Article 6(1)(a) GDPR), which you can withdraw for the future in Cookie preferences.",
			"To send newsletters or product updates: consent where required, or the limited existing-customer exception where legally available. Every marketing message provides an unsubscribe option.",
		],
	},
	{
		id: "account-authentication",
		title: "4. Accounts and Twitch authentication",
		summary: "Clipify accounts are created and authenticated through Twitch OAuth. We do not ask you to create a Clipify password.",
		details: [
			"Twitch provides the profile and authorization data needed to identify your account and perform the actions you approve. The requested OAuth permissions are displayed by Twitch before you authorize them. You can revoke Clipify in your Twitch connection settings, although doing so can disable connected features.",
			"We use short-lived cookies and authentication nonces to protect sign-in and active sessions. Access and refresh tokens are stored server-side and are not intentionally exposed to browser diagnostics.",
		],
	},
	{
		id: "twitch-integrations",
		title: "5. Clip, overlay, chat, and channel features",
		summary: "Clipify processes the Twitch content and channel events required to run the features you configure.",
		details: ["This may include retrieving and caching clips, resolving playback URLs, receiving EventSub notifications, reacting to channel-point rewards or chat commands, displaying creator information, and delivering browser-source overlays. Clipify does not claim ownership of Twitch or creator content.", "Public overlays, galleries, and creator pages can disclose content and profile information that you choose to publish. Review those settings before sharing a public URL."],
	},
	{
		id: "payments",
		title: "6. Payments and subscriptions",
		summary: "Stripe processes checkout and payment information for paid Clipify plans.",
		details: ["Clipify receives the identifiers and status information needed to activate and administer your subscription, handle cancellations or refunds, prevent duplicate checkouts, and meet accounting duties. Payment-card details are submitted directly to Stripe and are not stored in the Clipify database."],
	},
	{
		id: "communications-and-support",
		title: "7. Support, service messages, and email",
		summary: "We use the contact details and messages you provide to answer requests and deliver communications you selected.",
		details: ["The optional live-support widget is provided through Clipify's self-hosted Chatwoot service and loads only after functionality consent. A conversation can include your message, contact details, account context, and technical information relevant to the request.", "Newsletter and product-update subscriptions are managed through our configured UseSend service. You can change the product-update choice in account settings or use the unsubscribe link in an email."],
	},
	{
		id: "security-and-consent-records",
		title: "8. Security, fraud prevention, and consent records",
		summary: "We retain proportionate authentication, rate-limit, audit, abuse-prevention, and consent evidence to protect Clipify and demonstrate your choices.",
		details: ["Security measures include access controls, encrypted transport, separated secrets, software updates, monitoring, and data minimization. No online service can guarantee absolute security, but we review safeguards according to the nature and risk of the processing."],
	},
	{
		id: "analytics-observability-and-logs",
		title: "9. Analytics, diagnostics, and logs",
		summary: "Clipify uses self-hosted, cookieless Plausible statistics and operational server diagnostics to understand use, reliability, and failures.",
		details: [
			"Plausible produces aggregated audience statistics without advertising profiles or cross-site tracking. Server logs, metrics, traces, database spans, and captured backend errors are processed for security and reliable operation under our legitimate interests.",
			"Sentry browser performance measurement, browser profiling, and masked Session Replay are optional and start only after measurement consent. Replay masks text and inputs and blocks media by default. Sampling means only a portion of eligible sessions is recorded. You can withdraw measurement consent at any time.",
		],
	},
	{
		id: "cookies-and-storage",
		title: "10. Cookies and similar storage",
		summary: "The Cookie Policy lists the current first- and third-party services, cookies, local storage, session storage, purposes, and consent status.",
		details: ["Strictly necessary storage supports account security, privacy choices, and protected forms. Optional functionality and measurement services remain off until you choose them. Cookie preferences can be changed later from the footer or Cookie Policy."],
	},
	{
		id: "recipients-and-processors",
		title: "11. Who receives information",
		summary: "We disclose personal data only where needed to provide Clipify, comply with law, protect rights, or complete a transaction you request.",
		items: [
			"Twitch Interactive, Inc. for authentication, channel data, clips, chat, rewards, and connected Twitch functionality.",
			"Stripe group companies for checkout, subscriptions, payments, fraud prevention, invoices, and tax-related processing.",
			"Cloudflare, Inc. for Turnstile abuse prevention and network security on protected flows.",
			"Functional Software, Inc. (Sentry) for error monitoring and, after consent, browser measurement and Session Replay. The Clipify Sentry project uses the EU data region.",
			"Clipify-operated infrastructure for hosting, PostgreSQL storage, Plausible statistics, Chatwoot support, and UseSend communications.",
			"Authorities, courts, advisers, or a successor operator where disclosure is legally required or necessary to protect rights and complete a lawful business transfer.",
		],
	},
	{
		id: "international-transfers",
		title: "12. International transfers",
		summary: "Some providers are based in or can process data from countries outside the EU or EEA, particularly the United States.",
		details: ["Where the GDPR requires a transfer safeguard, we rely on an applicable adequacy decision, the EU Standard Contractual Clauses, or another legally permitted mechanism together with supplementary measures where appropriate. Self-hosted Clipify services are operated in the European Union unless a service disclosure states otherwise."],
	},
	{
		id: "retention",
		title: "13. How long we keep information",
		summary: "We keep personal data only while it is needed for the purpose described, an active account or contract, security, or a legal retention duty.",
		items: [
			"Authentication nonces normally expire after ten minutes and active account-session cookies after two hours.",
			"Consent choices are retained for six months before renewal is requested.",
			"Support conversations are kept until resolved or deletion is requested, unless a legal or dispute-related need requires longer retention.",
			"Billing, invoice, and transaction records are retained for applicable tax and commercial-law periods.",
			"Operational logs, diagnostics, caches, and backups are rotated according to their purpose, risk, and configured retention. Sentry data follows the configured project retention period.",
		],
		details: ["When information is no longer needed, it is deleted or anonymized. Residual copies can remain in backups until the relevant backup is overwritten, subject to restricted access and restoration controls."],
	},
	{
		id: "individual-rights",
		title: "14. Your privacy rights",
		summary: "Where the applicable requirements are met, you can request access, correction, deletion, restriction, portability, or object to processing based on legitimate interests.",
		details: ["You can withdraw consent at any time for future processing without affecting processing that was lawful before withdrawal. You also have the right to complain to a data-protection supervisory authority. The Privacy Requests page explains how to contact us and how identity verification works."],
	},
	{
		id: "automated-decisions",
		title: "15. Automated decisions",
		summary: "Clipify does not use personal data to make solely automated decisions that produce legal or similarly significant effects for you.",
		details: ["Automated security, rate-limit, eligibility, and entitlement checks can affect an individual request or feature, but they do not replace any right to contact us about an incorrect outcome."],
	},
	{
		id: "children",
		title: "16. Children",
		summary: "Clipify is not directed to children below the minimum age required by Twitch or applicable law.",
		details: ["If you are not legally able to agree to the Terms yourself, a parent or legal guardian must provide any authorization required by applicable law. Contact us if you believe a child supplied personal data without the required authorization."],
	},
	{
		id: "complaint-routes",
		title: "17. Questions and complaints",
		summary: "Please contact contact@clipify.us first so we can investigate and respond.",
		details: ["You may also complain to the supervisory authority responsible for your habitual residence, workplace, or the alleged infringement. For the operator's German establishment, the competent authority is the State Commissioner for Data Protection and Freedom of Information Baden-Württemberg (LfDI Baden-Württemberg)."],
	},
	{
		id: "material-changes",
		title: "18. Changes to this policy",
		summary: "We update this policy when Clipify, its providers, or applicable requirements materially change.",
		details: ["The version and effective date appear at the top of the document. Where a change requires notice or renewed consent, we will provide it before the affected processing begins. We recommend reviewing this page periodically."],
	},
];
