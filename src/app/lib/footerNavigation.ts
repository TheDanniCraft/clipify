import { legalDocumentRoutes } from "./legal/documents";

export const footerNavigation = {
	features: [
		{ name: "All features", href: "/features" },
		{ name: "Twitch clips in OBS", href: "/guides/twitch-clips-in-obs" },
		{ name: "Clip playlists", href: "/guides/twitch-clip-playlists" },
		{ name: "Playback controls", href: "/guides/control-twitch-clip-playback" },
		{ name: "Scene styling", href: "/features#styling" },
	],

	supportOptions: [
		{ name: "Pricing", href: "/pricing" },
		{ name: "FAQs", href: "/#faq" },
		{ name: "Community", href: "/community" },
		{ name: "Help Center", href: "https://help.clipify.us/" },
		{ name: "Service Status", href: "https://status.thedannicraft.de/status/clipify" },
	],
	aboutUs: [
		{ name: "Changelog", href: "/changelog" },
		{ name: "Roadmap", href: "/roadmap" },
		{ name: "Collaboration enquiries", href: "mailto:contact@clipify.us?subject=Clipify%20collaboration" },
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
