import type { APIRequestContext, APIResponse } from "@playwright/test";

/** Respect the real provider's Retry-After; never reset or disable its counters. */
export async function registerBrowserClient(request: APIRequestContext, origin: string, data: Record<string, unknown>, pause: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))): Promise<APIResponse> {
	for (let attempt = 0; ; attempt++) {
		const response = await request.post(`${origin}/api/auth/oauth2/register`, { data });
		if (response.status() !== 429 || attempt === 2) return response;
		const retryAfter = response.headers()["retry-after"];
		if (!retryAfter || !/^\d+$/.test(retryAfter)) throw new Error("Registration was throttled without a usable Retry-After");
		const seconds = Number(retryAfter);
		if (seconds < 1 || seconds > 60) throw new Error("Registration budget is unavailable beyond the browser fixture's bounded retry window");
		await response.dispose();
		await pause(seconds * 1000);
	}
}
