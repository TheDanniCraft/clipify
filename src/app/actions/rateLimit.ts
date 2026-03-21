"use server";

import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

export async function getUserIP() {
	const { headers } = await import("next/headers");
	const headersList = await headers();

	/**
	 * x-forwarded-for usually contains a list of IPs: <client>, <proxy1>, <proxy2>...
	 * The first one is the client's IP, but it can be spoofed if the proxy is not configured to overwrite it.
	 * In most trusted environments (Vercel, Cloudflare, etc.), the platform ensures the header is reliable.
	 */
	const forwardedFor = headersList.get("x-forwarded-for");
	const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : headersList.get("x-real-ip") || "127.0.0.1";

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

