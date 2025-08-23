import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import PlausibleProvider from "next-plausible";

export const metadata: Metadata = {
	title: "Clipify – Let your clips talk. Even when you can't.",
	description: "Clipify automatically plays your best Twitch clips to keep your stream alive and your viewers entertained, even when you're away.",
	metadataBase: new URL("https://clipify.us"),
	manifest: "https://clipify.us/manifest.webmanifest",
	alternates: {
		canonical: "https://clipify.us",
	},
	openGraph: {
		title: "Clipify – Let your clips talk. Even when you can't.",
		description: "Need a break? Clipify got you covered. Auto-play clips while you're away – keep your stream alive and your viewers entertained.",
		url: "https://clipify.us",
		siteName: "Clipify",
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
				alt: "Clipify – Twitch Clips Auto-Player",
			},
		],
		locale: "en_US",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Clipify – Let your clips talk. Even when you can't.",
		description: "Auto-play your Twitch clips to keep your stream active and engaging, even when you're away.",
	},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang='en' suppressHydrationWarning>
			<head>
				<PlausibleProvider domain='clipify.us' customDomain='https://analytics.thedannicraft.de' selfHosted trackOutboundLinks trackFileDownloads taggedEvents hash enabled />
				<meta name='apple-mobile-web-app-title' content='Clipify' />
				<link rel='preconnect' href='https://chat.cloud.thedannicraft.de' crossOrigin='' />
				<link rel='dns-prefetch' href='https://chat.cloud.thedannicraft.de' />

				<link rel='preconnect' href='https://api.status.thedannicraft.de' />
				<link rel='dns-prefetch' href='https://api.status.thedannicraft.de' />
			</head>
			<body>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
