"use server";

import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

import { isCoolify } from "@actions/utils";

let hasWarnedUntrustedProxy = false;

export async function getUserIP() {
	const { headers } = await import("next/headers");
	const headersList = await headers();

	const cfConnectingIp = headersList.get("cf-connecting-ip");
	const xRealIp = headersList.get("x-real-ip");
	const xForwardedFor = headersList.get("x-forwarded-for");

	const isCloudflare = !!cfConnectingIp;
	const isVercel = process.env.VERCEL === "1";
	const isDev = process.env.NODE_ENV === "development";

	/**
	 * Check if we are running in a known trusted environment.
	 * If not, and we're in production, we warn once that IP headers might be spoofable.
	 */
	if (!isDev && !hasWarnedUntrustedProxy) {
		const isCoolifyEnv = await isCoolify();
		if (!isVercel && !isCoolifyEnv && !isCloudflare) {
			console.warn(
				"[security] Potentially untrusted proxy detected. Rate limiting may be impacted if clients can spoof IP headers (e.g. x-forwarded-for). Ensure your reverse proxy (Nginx/Traefik/Caddy) is configured to overwrite these headers."
			);
			hasWarnedUntrustedProxy = true;
		}
	}

	const ip = cfConnectingIp || xRealIp || xForwardedFor?.split(",")[0]?.trim() || "127.0.0.1";

	return ip;
}

const rateLimiterMap = new Map<string, RateLimiterMemory>();

export async function tryRateLimit({ points, duration, key }: { points: number; duration: number; key: string }) {
	const ip = await getUserIP();
	let rateLimiter = rateLimiterMap.get(key);

	if (!rateLimiter) {
		rateLimiter = new RateLimiterMemory({
			points,
			duration,
		});
		rateLimiterMap.set(key, rateLimiter);
	}

	return rateLimiter
		.consume(ip, 1)
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

