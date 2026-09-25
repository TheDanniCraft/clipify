export type TermsSection = { id: string; title: string; summary: string };

export const termsSections: readonly TermsSection[] = [
	{ id: "service-scope", title: "Service scope", summary: "Clipify provides Twitch-oriented clip playback, overlays, management tools, and related services under the features and limits shown for the selected plan." },
	{ id: "eligibility", title: "Eligibility", summary: "Users must be legally able to enter this agreement and meet applicable Twitch and payment-provider requirements." },
	{ id: "accounts", title: "Accounts and security", summary: "Users are responsible for their connected account, authorized access, and promptly reporting suspected compromise." },
	{ id: "external-platforms", title: "External platforms", summary: "Twitch, payment providers, hosting environments, and other external platforms remain governed by their own terms and may affect Clipify functionality." },
	{ id: "acceptable-use", title: "Acceptable use", summary: "Users may not abuse, disrupt, bypass limits, violate law or third-party rights, or use Clipify to distribute unlawful or harmful material." },
	{ id: "user-content", title: "User content", summary: "Users retain responsibility for content and permissions and grant Clipify the limited rights needed to process content for requested features." },
	{ id: "billing", title: "Paid plans and billing", summary: "Prices, billing intervals, taxes, renewal information, and included limits are shown before purchase and processed through the identified payment provider." },
	{ id: "cancellation", title: "Cancellation and refunds", summary: "Subscriptions can be cancelled for future renewal; statutory withdrawal, refund, and consumer rights remain unaffected where they apply." },
	{ id: "runner-responsibilities", title: "Self-hosted Runner", summary: "Runner operators control their machine, credentials, network access, updates, security, backups, and compliance with software and platform requirements." },
	{ id: "availability-and-changes", title: "Availability and changes", summary: "Clipify may maintain, improve, replace, or discontinue features and will provide proportionate notice where a material change requires it." },
	{ id: "suspension-and-termination", title: "Suspension and termination", summary: "Access may be limited or ended for material breach, security risk, unlawful use, non-payment, or platform dependency loss, subject to applicable law." },
	{ id: "mandatory-law-liability", title: "Liability", summary: "Liability limitations do not exclude mandatory liability, including liability that cannot lawfully be limited under applicable consumer or German law." },
	{ id: "governing-law", title: "Governing law", summary: "German law applies to the extent permitted, without depriving consumers of mandatory protections of their habitual residence." },
	{ id: "disputes", title: "Disputes", summary: "Users should contact Clipify first; statutory courts, consumer remedies, and mandatory dispute rights remain available where applicable." },
];
