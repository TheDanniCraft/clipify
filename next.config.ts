import type { NextConfig } from "next";
import { withPlausibleProxy } from "next-plausible";
import { withSentryConfig } from "@sentry/nextjs";
import crypto from "crypto";
import path from "path";
import { nodeFileTrace } from "@vercel/nft";

const drizzle = nodeFileTrace([require.resolve("drizzle-kit"), require.resolve("drizzle-orm"), path.resolve(path.dirname(require.resolve("drizzle-kit")), "bin.cjs")]).then((drizzle) => [...drizzle.fileList, "./node_modules/.bin/drizzle-kit", "./node_modules/drizzle-orm/**", "./node_modules/drizzle-kit/**"]);
const plausibleScriptName = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_NAME ?? process.env.PLAUSIBLE_SCRIPT_NAME ?? `${crypto.randomInt(1000, 10000)}-${crypto.randomBytes(8).toString("hex")}`;
const plausibleSrc = "https://analytics.thedannicraft.de/js/pa-plTnxxmoxCSO3VJloWzAG.js";

const nextConfigPromise = Promise.resolve(drizzle).then(
	(drizzle) =>
		({
			output: "standalone",
			outputFileTracingIncludes: {
				"**": [...drizzle],
			},
			poweredByHeader: false,
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
			src: plausibleSrc!,
			scriptPath: `/js/${plausibleScriptName}.js`,
		})(resolvedConfig),
		{
			tunnelRoute: "/monitor",
		},
	),
);
