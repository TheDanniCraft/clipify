import { headers } from "next/headers";
import { RateLimiterMemory } from "rate-limiter-flexible";

export async function getUserIP() {
	const headersList = await headers();

	const ip = headersList.get("x-forwarded-for")?.split(",")[0] || headersList.get("x-real-ip") || "127.0.0.1"; // Fallback for local development

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

	try {
		await rateLimiter.consume(ip, 1);
		return { success: true, rateLimiter };
	} catch (error) {
		return { success: false, error };
	}
}
