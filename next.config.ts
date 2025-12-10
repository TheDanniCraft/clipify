import type { NextConfig } from "next";
import { withPlausibleProxy } from "next-plausible";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";
import { nodeFileTrace } from "@vercel/nft";

async function getDrizzleFiles(): Promise<string[]> {
	const drizzle = await nodeFileTrace([require.resolve("drizzle-kit"), require.resolve("drizzle-orm"), path.resolve(path.dirname(require.resolve("drizzle-kit")), "bin.cjs")]);
	return [...drizzle.fileList, "./node_modules/.bin/drizzle-kit", "./node_modules/drizzle-orm/**", "./node_modules/drizzle-kit/**"];
}

async function nextConfig(): Promise<NextConfig> {
	const drizzleFiles = await getDrizzleFiles();

	const config = withSentryConfig(
		withPlausibleProxy({
			customDomain: "https://analytics.thedannicraft.de",
		})({
			outputFileTracingIncludes: {
				"**": drizzleFiles,
			},
			output: "standalone",
		}),
		{
			tunnelRoute: "/monitor",
		}
	);

	return config;
}

export default nextConfig;
