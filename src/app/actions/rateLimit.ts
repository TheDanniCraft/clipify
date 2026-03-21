"use server";

import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

import { isCoolify } from "@actions/utils";

let hasWarnedUntrustedProxy = false;

export async function getUserIP() {
	const { headers } = await import("next/headers");
	const headersList = await headers();

	// Headers provided by common trusted environments
	const cfConnectingIp = headersList.get("cf-connecting-ip");
	const xRealIp = headersList.get("x-real-ip");
	const xForwardedFor = headersList.get("x-forwarded-for");

	// Environment identification
	// Cloudflare sets CF-Ray in addition to connecting-ip
	const isCloudflare = !!headersList.get("cf-ray");
	const isVercel = process.env.VERCEL === "1";
	const isDev = process.env.NODE_ENV === "development";
	const isCoolifyEnv = await isCoolify();

	/**
	 * Check if we are running in a known trusted environment.
	 * If not, and we're in production, we warn once that IP headers might be spoofable.
	 */
	if (!isDev && !hasWarnedUntrustedProxy) {
		if (!isVercel && !isCoolifyEnv && !isCloudflare) {
			console.warn(
				"[security] Potentially untrusted proxy detected. Rate limiting may be impacted if clients can spoof IP headers (e.g. x-forwarded-for). Ensure your reverse proxy (Nginx/Traefik/Caddy) is configured to overwrite these headers."
			);
			hasWarnedUntrustedProxy = true;
		}
	}

	// Trust sequence based on identified environment
	let ip: string | null = null;

	if (isCloudflare && cfConnectingIp) {
		ip = cfConnectingIp;
	} else if (isVercel && xForwardedFor) {
		// Vercel populates x-forwarded-for with the client IP as the first element
		ip = xForwardedFor.split(",")[0]?.trim();
	} else if (isCoolifyEnv && xRealIp) {
		// Nginx/Traefik on Coolify typically set x-real-ip
		ip = xRealIp;
	} else if (xForwardedFor) {
		// Fallback for generic proxies (if configured correctly, they overwrite this)
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

