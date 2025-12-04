import type { NextConfig } from "next";
import { withPlausibleProxy } from "next-plausible";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";
import { nodeFileTrace } from "@vercel/nft";

const drizzle = nodeFileTrace([require.resolve("drizzle-kit"), require.resolve("drizzle-orm"), path.resolve(path.dirname(require.resolve("drizzle-kit")), "bin.cjs")]).then((drizzle) => [...drizzle.fileList, "./node_modules/.bin/drizzle-kit", "./node_modules/drizzle-orm/**", "./node_modules/drizzle-kit/**"]);

const nextConfigPromise = Promise.resolve(drizzle).then(
	(drizzle) =>
		({
			output: "standalone",
			outputFileTracingIncludes: {
				"**": [...drizzle],
			},
		} as NextConfig)
);

export default nextConfigPromise.then((resolvedConfig) =>
	withSentryConfig(
		withPlausibleProxy({
			customDomain: "https://analytics.thedannicraft.de",
		})(resolvedConfig),
		{
			tunnelRoute: "/monitor",
		}
	)
);
