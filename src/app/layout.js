import "./globals.css";
import { Providers } from "./providers";
import PlausibleProvider from 'next-plausible'

export const metadata = {
  title: "Clipify.us",
  description: "Clipify your stream!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <PlausibleProvider
          domain="clipify.us"
          customDomain="https://analytics.thedannicraft.de"
          selfHosted
          trackOutboundLinks
          trackFileDownloads
          taggedEvents
          hash
          enabled
        />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
