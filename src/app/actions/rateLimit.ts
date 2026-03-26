"use server";

import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

import { isCoolify } from "@actions/utils";

let hasWarnedUntrustedProxy = false;

export async function getUserIP() {
	const { headers } = await import("next/headers");
	const headersList = await headers();

	// Platform-specific headers
	const cfConnectingIp = headersList.get("cf-connecting-ip");
	const doConnectingIp = headersList.get("do-connecting-ip");
	const fastlyClientIp = headersList.get("fastly-client-ip");
	const trueClientIp = headersList.get("true-client-ip");
	const appEngineIp = headersList.get("x-appengine-user-ip");
	const xRealIp = headersList.get("x-real-ip");
	const xForwardedFor = headersList.get("x-forwarded-for");

	// Environment identification
	const isCloudflare = !!headersList.get("cf-ray");
	const isDigitalOcean = !!doConnectingIp;
	const isFastly = !!fastlyClientIp;
	const isAkamai = !!headersList.get("akamai-origin-hop") || (!!trueClientIp && !isCloudflare);
	const isGoogleCloud = !!appEngineIp || !!headersList.get("x-cloud-trace-context");
	const isVercel = process.env.VERCEL === "1";
	const isCoolifyEnv = await isCoolify();
	const isDev = process.env.NODE_ENV === "development";

	/**
	 * Check if we are running in a known trusted environment.
	 * If not, and we're in production, we warn once that IP headers might be spoofable.
	 */
	if (!isDev && !hasWarnedUntrustedProxy) {
		const isKnownProvider = isVercel || isCoolifyEnv || isCloudflare || isDigitalOcean || isFastly || isAkamai || isGoogleCloud;
		if (!isKnownProvider) {
			console.warn(
				"[security] Potentially untrusted proxy detected. Rate limiting may be impacted if clients can spoof IP headers (e.g. X-Forwarded-For). Ensure your reverse proxy (Nginx/Traefik/Caddy) is configured to overwrite these headers."
			);
			hasWarnedUntrustedProxy = true;
		}
	}

	// Trust sequence based on identified environment
	let ip: string | null = null;

	if (isCloudflare && cfConnectingIp) {
		ip = cfConnectingIp;
	} else if (isDigitalOcean && doConnectingIp) {
		ip = doConnectingIp;
	} else if (isFastly && fastlyClientIp) {
		ip = fastlyClientIp;
	} else if (isAkamai && trueClientIp) {
		ip = trueClientIp;
	} else if (isGoogleCloud && appEngineIp) {
		ip = appEngineIp;
	} else if (isVercel && xForwardedFor) {
		// Vercel populates x-forwarded-for with the client IP as the first element
		ip = xForwardedFor.split(",")[0]?.trim();
	} else if (isCoolifyEnv && xRealIp) {
		// Nginx/Traefik on Coolify typically set x-real-ip
		ip = xRealIp;
	} else if (xForwardedFor) {
		// Fallback for generic proxies (if configured correctly, they should overwrite this)
		ip = xForwardedFor.split(",")[0]?.trim();
	}

	return ip || xRealIp || "127.0.0.1";
}

const rateLimiterMap = new Map<string, RateLimiterMemory>();

export async function tryRateLimit({
	points,
	duration,
	key,
	identifier,
}: {
	points: number;
	duration: number;
	key: string;
	identifier?: string;
}) {
	const id = identifier || (await getUserIP());
	let rateLimiter = rateLimiterMap.get(key);

	if (!rateLimiter) {
		rateLimiter = new RateLimiterMemory({
			points,
			duration,
		});
		rateLimiterMap.set(key, rateLimiter);
	}

	return rateLimiter
		.consume(id, 1)
		.then((rateLimiterRes: RateLimiterRes) => {
			return { success: true, rateLimiterRes };
		})
		.catch((rateLimiterRes: RateLimiterRes) => {
			return { success: false, rateLimiterRes };
		});
}

export async function isRatelimitError(error: unknown) {
	if (error instanceof Error && error.name == "RateLimitError") {
		return true;
	}

	return false;
}

