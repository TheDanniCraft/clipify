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
			async headers() {
				const baseSecurityHeaders = [
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
					{
						key: "Permissions-Policy",
						value: ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()", "interest-cohort=()"].join(", "),
					},
					{
						key: "Strict-Transport-Security",
						value: "max-age=31536000; includeSubDomains",
					},
				];

				return [
					{
						source: "/demoPlayer",
						headers: [...baseSecurityHeaders, { key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "Content-Security-Policy", value: "frame-ancestors 'self';" }],
					},
					{
						source: "/embed/:overlayId",
						headers: [...baseSecurityHeaders, { key: "Content-Security-Policy", value: "frame-ancestors *;" }],
					},
					{
						source: "/:path((?!demoPlayer$|embed/[^/]+/?$).*)",
						headers: [...baseSecurityHeaders, { key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: "frame-ancestors 'none';" }],
					},
				];
			},
		}) as NextConfig,
);

export default nextConfigPromise.then((resolvedConfig) =>
	withSentryConfig(
		withPlausibleProxy({
			customDomain: "https://analytics.thedannicraft.de",
		})(resolvedConfig),
		{
			tunnelRoute: "/monitor",
		},
	),
);
