import type { NextConfig } from "next";
import { withPlausibleProxy } from "next-plausible";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
	output: "standalone",
};

export default withSentryConfig(
	withPlausibleProxy({
		customDomain: "https://analytics.thedannicraft.de",
	})(nextConfig),
	{
		tunnelRoute: "/monitor",
	}
);
