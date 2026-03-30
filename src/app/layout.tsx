import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import ThemeProvider from "./theme-provider";
import { getBaseUrl } from "@actions/utils";
import PlausibleClient from "./PlausibleClient";
import Script from "next/script";
import AdOptScript from "./components/AdOptScript";

const baseUrl = await getBaseUrl();
const manifestUrl = new URL("manifest.webmanifest", baseUrl);

export const metadata: Metadata = {
	title: "Clipify - Let your clips talk. Even when you can't.",
	description: "Clipify automatically plays your best Twitch clips to keep your stream alive and your viewers entertained, even when you're away.",
	metadataBase: baseUrl,
	manifest: manifestUrl,
	alternates: {
		canonical: "https://clipify.us",
	},
	openGraph: {
		title: "Clipify - Let your clips talk. Even when you can't.",
		description: "Need a break? Clipify got you covered. Auto-play clips while you're away - keep your stream alive and your viewers entertained.",
		url: `${baseUrl}`,
		siteName: "Clipify",
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
				alt: "Clipify - Twitch Clips Auto-Player",
			},
		],
		locale: "en_US",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Clipify - Let your clips talk. Even when you can't.",
		description: "Auto-play your Twitch clips to keep your stream active and engaging, even when you're away.",
	},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang='en' suppressHydrationWarning>
			<head>
				<meta name='apple-mobile-web-app-title' content='Clipify' />
				<link rel='preconnect' href='https://tag.goadopt.io' crossOrigin='anonymous' />
				<link rel='preconnect' href='https://affiliate.clipify.us' crossOrigin='anonymous' />
			</head>
			<body suppressHydrationWarning>
				<AdOptScript />
				<Script id='affiliate-program-tracker' src='https://affiliate.clipify.us/tracking/program-1.js' strategy='afterInteractive' />
				<PlausibleClient>
					<ThemeProvider>
						<Providers>{children}</Providers>
					</ThemeProvider>
				</PlausibleClient>
			</body>
		</html>
	);
}
