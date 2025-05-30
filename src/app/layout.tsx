import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import PlausibleProvider from "next-plausible";
import Footer from "@components/footer";

export const metadata: Metadata = {
	title: "Clipify.us",
	description: "Clipify your stream!",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang='en' suppressHydrationWarning>
			<head>
				<PlausibleProvider domain='clipify.us' customDomain='https://analytics.thedannicraft.de' selfHosted trackOutboundLinks trackFileDownloads taggedEvents hash enabled />
				<meta name='apple-mobile-web-app-title' content='Clipify' />
			</head>
			<body>
				<Providers>
					{children}
					<Footer />
				</Providers>
			</body>
		</html>
	);
}
