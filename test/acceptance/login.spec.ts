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
