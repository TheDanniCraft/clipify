import { expect, test } from "@playwright/test";

test("the public login entry point renders from the real app", async ({ page }) => {
	const response = await page.goto("/login?returnUrl=%2Fdashboard");

	expect(response?.ok()).toBe(true);
	await expect(page).toHaveTitle(/Clipify/);
	await expect(page.getByRole("link", { name: "Login with Twitch" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Login with Twitch" })).toHaveAttribute("href", "/auth?returnUrl=%2Fdashboard");
});
