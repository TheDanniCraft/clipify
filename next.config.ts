import type { NextConfig } from "next";
import { withPlausibleProxy } from "next-plausible";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
	/* config options here */
};

export default withSentryConfig(
	withPlausibleProxy({
		customDomain: "https://analytics.thedannicraft.de",
	})(nextConfig),
	{
		tunnelRoute: "/monitor",
	}
);
