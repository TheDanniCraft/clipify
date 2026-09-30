import { legalDocumentRoutes } from "./legal/documents";

export const footerNavigation = {
	features: [
		{ name: "Easy to Use", href: "/#features" },
		{ name: "Plug & Play", href: "/#features" },
		{ name: "Customize your player", href: "/#features" },
		{ name: "Multiple Overlays", href: "/#features" },
		{ name: "Channel Points Integration", href: "/#features" },
	],
	supportOptions: [
		{ name: "Pricing", href: "/pricing" },
		{ name: "FAQs", href: "/#faq" },
		{ name: "Community", href: "/community" },
		{ name: "Help Center", href: "https://help.clipify.us/" },
		{ name: "Service Status", href: "https://status.thedannicraft.de/status/clipify" },
	],
	aboutUs: [
		{ name: "Latest News", href: "/changelog" },
		{ name: "Roadmap", href: "/roadmap" },
		{ name: "Collaborations", href: "https://help.clipify.us/hc/clipify/articles/1756597294-collaborations" },
		{ name: "Climate Initiative", href: "https://climate.stripe.com/FaGAVC" },
	],
	legal: [
		{ name: "Imprint", href: legalDocumentRoutes.imprint },
		{ name: "Privacy Policy", href: legalDocumentRoutes.privacy },
		{ name: "Cookie Policy", href: legalDocumentRoutes.cookies },
		{ name: "Terms of Service", href: legalDocumentRoutes.terms },
		{ name: "Request Data Removal", href: legalDocumentRoutes.privacyRequests },
	],
} as const;
