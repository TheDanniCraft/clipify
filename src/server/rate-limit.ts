import "server-only";
// @ts-expect-error - the runtime-safe narrow package path does not expose typings.
import RateLimiterMemory from "rate-limiter-flexible/lib/RateLimiterMemory";
import type { RateLimiterRes } from "rate-limiter-flexible";
export type AppRateLimitInput = { points: number; duration: number; key: string; identifier: string };
type Limiter = { consume: (key: string, points?: number) => Promise<RateLimiterRes>; reward: (key: string, points?: number) => Promise<RateLimiterRes> };
const limiters = new Map<string, Limiter>();
function limiterFor({ key, points, duration }: AppRateLimitInput) {
	const policy = JSON.stringify([key, points, duration]);
	let limiter = limiters.get(policy);
	if (!limiter) {
		limiter = new RateLimiterMemory({ points, duration }) as Limiter;
		limiters.set(policy, limiter);
	}
	return limiter;
}
/** One library-backed RAM engine shared by application policies. Caller supplies the trusted identity. */
export async function consumeAppRateLimit(input: AppRateLimitInput) {
	return limiterFor(input)
		.consume(input.identifier, 1)
		.then((rateLimiterRes) => ({ success: true, rateLimiterRes }))
		.catch((rateLimiterRes: RateLimiterRes) => ({ success: false, rateLimiterRes }));
}
/** Server-internal: release an accepted point when its operation fails before submission. */
export async function refundAppRateLimit(input: AppRateLimitInput) {
	return limiterFor(input).reward(input.identifier, 1);
}
