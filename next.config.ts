import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import crypto from "crypto";
import path from "path";
import { nodeFileTrace } from "@vercel/nft";
import { toDeploymentId } from "./src/app/lib/deploymentId";

const drizzle = nodeFileTrace([require.resolve("drizzle-kit"), require.resolve("drizzle-orm"), path.resolve(path.dirname(require.resolve("drizzle-kit")), "bin.cjs")]).then((drizzle) => [...drizzle.fileList, "./node_modules/.bin/drizzle-kit", "./node_modules/drizzle-orm/**", "./node_modules/drizzle-kit/**"]);
const umamiTrackerName = `bundle_${crypto.randomBytes(8).toString("hex")}.js`;
const umamiRecorderName = `bundle_${crypto.randomBytes(8).toString("hex")}.js`;
const umamiBaseUrl = process.env.UMAMI_BASE_URL || "https://umami.cloud.thedannicraft.de";
const deploymentId = toDeploymentId(process.env.SOURCE_COMMIT) || toDeploymentId(process.env.SENTRY_RELEASE) || undefined;
const replayContentSecurityPolicy = (frameAncestors: string) => `frame-ancestors ${frameAncestors}; frame-src 'self' https://challenges.cloudflare.com https://chat.cloud.thedannicraft.de; worker-src 'self' blob:; child-src 'self' blob:;`;

const nextConfigPromise = Promise.resolve(drizzle).then(
	(drizzle) =>
		({
			// E2E uses the full checkout with a custom server; standalone remains the deployment artifact.
			output: process.env.E2E_TEST_MODE === "true" ? undefined : "standalone",
			serverExternalPackages: ["@c15t/backend"],
			deploymentId,
			experimental: { serverActions: { bodySizeLimit: "3mb" } },
			distDir: process.env.E2E_TEST_MODE === "true" ? ".next-playwright" : ".next",
			outputFileTracingIncludes: {
				"**": [...drizzle, "./node_modules/@sentry/profiling-node/**", "./node_modules/@sentry/node-cpu-profiler/**"],
			},
			poweredByHeader: false,
			async rewrites() {
				return [
					{ source: `/js/${umamiTrackerName}`, destination: `${umamiBaseUrl}/script.js` },
					{ source: `/js/${umamiRecorderName}`, destination: `${umamiBaseUrl}/recorder.js` },
					{ source: "/statistics/api/send", destination: `${umamiBaseUrl}/api/send` },
					{ source: "/statistics/api/record", destination: `${umamiBaseUrl}/api/record` },
					{ source: "/statistics/api/websites/:websiteId/recorder", destination: `${umamiBaseUrl}/api/websites/:websiteId/recorder` },
				];
			},
			async headers() {
				const baseSecurityHeaders = [
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "Document-Policy", value: "js-profiling" },
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
					...["/", "/features", "/pricing"].map((source) => ({ source, headers: [...baseSecurityHeaders, { key: "Content-Security-Policy", value: replayContentSecurityPolicy(new URL(umamiBaseUrl).origin) }] })),
					{
						source: "/runner/preview/:runnerId",
						headers: [...baseSecurityHeaders, { key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "Content-Security-Policy", value: replayContentSecurityPolicy("'self'") }],
					},
					{
						source: "/demoPlayer",
						headers: [...baseSecurityHeaders, { key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "Content-Security-Policy", value: replayContentSecurityPolicy("'self'") }],
					},
					{
						source: "/embed/:overlayId",
						headers: [...baseSecurityHeaders, { key: "Content-Security-Policy", value: replayContentSecurityPolicy("*") }],
					},
					{
						source: "/gallery/:galleryId/frame",
						headers: [...baseSecurityHeaders, { key: "Content-Security-Policy", value: replayContentSecurityPolicy("*") }],
					},
					{
						source: "/dashboard/galleries/:galleryId/preview/clip/:clipId",
						headers: [...baseSecurityHeaders, { key: "Content-Security-Policy", value: replayContentSecurityPolicy("*") }],
					},
					{
						source: "/gallery/:galleryId/clip/:clipId",
						headers: [...baseSecurityHeaders, { key: "Content-Security-Policy", value: replayContentSecurityPolicy("*") }],
					},
					{
						source: "/elements/:path*",
						headers: [...baseSecurityHeaders, { key: "Access-Control-Allow-Origin", value: "*" }, { key: "Cache-Control", value: "public, max-age=300, s-maxage=86400" }],
					},
					{
						source: "/:path((?!$|features/?$|pricing/?$|runner/preview/[^/]+/?$|demoPlayer$|embed/[^/]+/?$|gallery/[^/]+/frame/?$|gallery/[^/]+/clip/[^/]+/?$|dashboard/galleries/[^/]+/preview/clip/[^/]+/?$).*)",
						headers: [...baseSecurityHeaders, { key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: replayContentSecurityPolicy("'none'") }],
					},
				];
			},
		}) as NextConfig,
);

export default nextConfigPromise.then((resolvedConfig) => {
	const configWithSentryBuildEnvironment: NextConfig = {
		...resolvedConfig,
		env: {
			...resolvedConfig.env,
			SENTRY_DSN: process.env.SENTRY_DSN ?? "",
			SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? "",
			IS_PREVIEW: process.env.IS_PREVIEW === "true" ? "true" : "false",
			E2E_TEST_MODE: process.env.E2E_TEST_MODE === "true" ? "true" : "false",
			NEXT_PUBLIC_UMAMI_TRACKER_PATH: `/js/${umamiTrackerName}`,
			NEXT_PUBLIC_UMAMI_RECORDER_PATH: `/js/${umamiRecorderName}`,
		},
	};

	return withSentryConfig(configWithSentryBuildEnvironment, {
		org: "thedannicraft",
		project: "clipify",
		authToken: process.env.SENTRY_AUTH_TOKEN,
		widenClientFileUpload: true,
		tunnelRoute: "/monitor",
		release: {
			name: process.env.SENTRY_RELEASE,
			create: true,
			finalize: true,
			setCommits: {
				auto: true,
				ignoreMissing: true,
				ignoreEmpty: true,
			},
			deploy: {
				env: process.env.IS_PREVIEW === "true" ? "preview" : "production",
			},
		},
		silent: false,
		sourcemaps: {
			deleteSourcemapsAfterUpload: true,
		},
	});
});
