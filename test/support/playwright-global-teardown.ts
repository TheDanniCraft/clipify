import type { FullConfig } from "@playwright/test";

const shutdownToken = "clipify-playwright-local-shutdown";

export default async function globalTeardown(config: FullConfig) {
	const baseURL = config.projects[0]?.use.baseURL;
	if (typeof baseURL !== "string") throw new Error("Playwright baseURL is unavailable during global teardown.");
	const databaseBackedRun = Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("127.0.0.1:1"));
	if (databaseBackedRun) {
		const cleanup = await fetch(new URL("/api/test/auth-fixture", baseURL), {
			method: "DELETE",
			headers: { Authorization: "Bearer clipify-playwright-auth-fixture", "Content-Type": "application/json" },
			body: JSON.stringify({ cleanupAll: true }),
		});
		if (!cleanup.ok) throw new Error(`Playwright auth fixture cleanup failed with HTTP ${cleanup.status}.`);
	}

	const response = await fetch(new URL("/__playwright_shutdown__", baseURL), {
		method: "POST",
		headers: { Authorization: `Bearer ${shutdownToken}` },
	});

	if (!response.ok) throw new Error(`Playwright server shutdown failed with HTTP ${response.status}.`);
}
