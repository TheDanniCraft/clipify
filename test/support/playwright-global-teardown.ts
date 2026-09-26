import type { FullConfig } from "@playwright/test";

const shutdownToken = "clipify-playwright-local-shutdown";

export default async function globalTeardown(config: FullConfig) {
	const baseURL = config.projects[0]?.use.baseURL;
	if (typeof baseURL !== "string") throw new Error("Playwright baseURL is unavailable during global teardown.");

	const response = await fetch(new URL("/__playwright_shutdown__", baseURL), {
		method: "POST",
		headers: { Authorization: `Bearer ${shutdownToken}` },
	});

	if (!response.ok) throw new Error(`Playwright server shutdown failed with HTTP ${response.status}.`);
}
