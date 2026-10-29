import type { Page } from "@playwright/test";

/** React hydration can finish before the consent policy/draft is initialized. */
export async function openConsentPage(page: Page, origin = "http://127.0.0.1:3107") {
	const [response] = await Promise.all([
		page.waitForResponse((response) => {
			const url = new URL(response.url());
			return url.origin === origin && url.pathname === "/api/c15t/init" && response.request().method() === "GET";
		}),
		page.goto(`${origin}/legal/cookies`),
	]);
	if (!response.ok()) throw new Error(`Consent initialization failed (${response.status()})`);
	const error = await response.finished();
	if (error) throw error;
}
