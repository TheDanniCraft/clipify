import { expect, test } from "@playwright/test";

for (const width of [390, 1440])
	for (const theme of ["light", "dark"])
		test(`Public login at ${width}px in ${theme}`, async ({ page }, info) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
			await page.emulateMedia({ reducedMotion: "reduce" });
			const response = await page.goto("/login?returnUrl=%2Fdashboard");
			expect(response?.ok()).toBe(true);
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			await expect(page).toHaveTitle(/Clipify/);
			await expect(page.getByRole("heading", { name: "Sign in to Clipify", exact: true })).toBeVisible();
			const login = page.getByRole("button", { name: "Login with Twitch", exact: true });
			await expect(login).toBeVisible();
			await login.focus();
			await expect(login).toBeFocused();
			await expect(page.getByRole("button", { name: /Google/i })).toHaveCount(0);
			await expect(page.getByRole("link", { name: "Privacy Policy", exact: true })).toHaveAttribute("href", "/legal/privacy");
			await page.screenshot({ path: info.outputPath("login.png"), fullPage: true, animations: "disabled" });
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		});

test("OAuth cancellation retries from a short tab-local reference without losing signed parameters", async ({ page }) => {
	const query = new URLSearchParams({ client_id: "browser-client", state: "browser-relay", sig: "signed-browser-fixture", scope: "openid profile email" });
	for (const key of ["client_id", "state", "sig", "scope", "ba_param"]) query.append("ba_param", key);
	const attempts: { callbackURL: string; errorCallbackURL: string; oauth_query: string }[] = [];
	await page.route("**/api/auth/sign-in/social", async (route) => {
		const body = route.request().postDataJSON();
		attempts.push(body);
		const url = new URL(body.errorCallbackURL, route.request().url());
		url.searchParams.set("error", "access_denied");
		await route.fulfill({ json: { url: url.href, redirect: attempts.length === 1 } });
	});
	await page.goto(`/login?${query}`);
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Login with Twitch", exact: true }).click()]);
	await expect(page).toHaveURL(/\/login\?oauthRetry=[\da-f-]{36}&error=access_denied$/);
	await expect(page.getByRole("heading", { name: "Connect your account", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Login with Twitch", exact: true }).click();
	await expect.poll(() => attempts.length).toBe(2);
	for (const attempt of attempts) {
		expect(attempt.errorCallbackURL.length).toBeLessThan(80);
		expect(attempt.callbackURL).toBe("/dashboard");
		const signed = new URLSearchParams(attempt.oauth_query);
		for (const key of ["client_id", "state", "sig", "scope", "ba_param"]) expect(signed.getAll(key)).toEqual(query.getAll(key));
	}
	await expect(page).toHaveURL(/client_id=browser-client/);
});
