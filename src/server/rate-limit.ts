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

type ClipPlaybackLane = "public" | "demo" | "runtime";
type ClipPlaybackCapacity = Record<ClipPlaybackLane, number[]>;
const CLIP_PLAYBACK_WINDOW_MS = 60_000;
const CLIP_PLAYBACK_LIMITS: Record<ClipPlaybackLane, number> = { public: 60, demo: 30, runtime: 60 };
const clipPlaybackOwners = new Map<string, ClipPlaybackCapacity>();
let lastClipPlaybackSweep = Date.now();

function pruneClipPlaybackCapacity(capacity: ClipPlaybackCapacity, now: number) {
	for (const lane of ["public", "demo", "runtime"] as const) {
		while (capacity[lane][0] !== undefined && capacity[lane][0] <= now - CLIP_PLAYBACK_WINDOW_MS) capacity[lane].shift();
	}
}

/** Keep all lanes in one rolling window; separate library policies reset at different times. */
export function consumeOwnerClipPlayback(ownerId: string, lane: ClipPlaybackLane): boolean {
	if (!ownerId || !CLIP_PLAYBACK_LIMITS[lane]) return false;
	const now = Date.now();
	if (now - lastClipPlaybackSweep >= CLIP_PLAYBACK_WINDOW_MS) {
		for (const [id, capacity] of clipPlaybackOwners) {
			pruneClipPlaybackCapacity(capacity, now);
			if (capacity.public.length + capacity.demo.length + capacity.runtime.length === 0) clipPlaybackOwners.delete(id);
		}
		lastClipPlaybackSweep = now;
	}
	let capacity = clipPlaybackOwners.get(ownerId);
	if (!capacity) {
		capacity = { public: [], demo: [], runtime: [] };
		clipPlaybackOwners.set(ownerId, capacity);
	}
	pruneClipPlaybackCapacity(capacity, now);
	if (capacity[lane].length >= CLIP_PLAYBACK_LIMITS[lane]) return false;
	// The three lane ceilings sum to 150, so they also bound the total.
	capacity[lane].push(now);
	return true;
}
