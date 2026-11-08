import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";

test.use({ actionTimeout: 10000 });
for (const width of [390, 1440])
	for (const theme of ["dark", "light"])
		test(`Dashboard support preserves c15t choices at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
			let sdkRequests = 0;
			await page.route("https://chat.cloud.thedannicraft.de/**", async (route) => {
				expect(route.request().url()).toContain("/packs/js/sdk.js");
				sdkRequests++;
				await route.fulfill({ contentType: "application/javascript", body: `window.chatwootSDK={run(){const bubble=document.createElement('div');bubble.className='woot--bubble-holder';const widget=document.createElement('div');widget.className='woot-widget-holder';document.body.append(bubble,widget);window.__supportOpens=0;window.$chatwoot={toggle(state){if(state==='open')window.__supportOpens++},toggleBubbleVisibility(){}};window.dispatchEvent(new Event('chatwoot:ready'))}};` });
			});
			await seedCreatorLibrary({ page, request, tourWorld });
			const openSidebar = async () => {
				const toggle = page.getByRole("button", { name: "Toggle navigation", exact: true });
				await expect(toggle).toBeEnabled();
				if (width === 390 && (await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
				// Do not let automatic control scrolling interrupt the sheet entrance.
				if (width === 390) await expect(page.locator('[data-slot="sidebar-mobile"]')).toBeInViewport({ ratio: 1 });
			};
			await page.goto(`${tourWorld.origin}/dashboard`);
			await expect(page.getByRole("complementary", { name: "Your privacy choices", exact: true })).toBeVisible();
			await openSidebar();
			if (width === 390) await expect(page.locator('[data-slot="sidebar-mobile"] [data-dashboard-consent]').getByRole("complementary", { name: "Your privacy choices", exact: true })).toBeVisible();
			const support = page.getByRole("button", { name: "Enable support chat", exact: true });
			await expect(support).toBeVisible();
			await expect(support).toBeInViewport({ ratio: 1 });
			expect(sdkRequests).toBe(0);
			await page.screenshot({ path: info.outputPath("before-consent.png") });
			await support.click();
			const preferences = page.getByRole("dialog", { name: "Privacy preferences", exact: true });
			await expect(preferences).toBeVisible();
			await expect(preferences.getByRole("switch", { name: "Allow Functionality", exact: true })).not.toBeChecked();
			await expect(preferences.getByText("Live support chat", { exact: true })).toBeVisible();
			expect(sdkRequests).toBe(0);
			await Promise.all([page.waitForEvent("load"), preferences.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			await openSidebar();
			await page.screenshot({ path: info.outputPath("after-reject.png") });
			await support.click();
			await expect(preferences).toBeVisible();
			await preferences.getByRole("switch", { name: "Allow Functionality", exact: true }).focus();
			await page.keyboard.press("Space");
			await expect(preferences.getByRole("switch", { name: "Allow Statistics and product analytics", exact: true })).not.toBeChecked();
			await Promise.all([page.waitForEvent("load"), preferences.getByRole("button", { name: "Save choices", exact: true }).click()]);
			await expect.poll(() => sdkRequests).toBeGreaterThan(0);
			await expect.poll(() => page.evaluate(() => typeof window.$chatwoot?.toggle)).toBe("function");
			await openSidebar();
			await support.click();
			await expect.poll(() => page.evaluate(() => (window as typeof window & { __supportOpens?: number }).__supportOpens)).toBe(1);
			await expect(preferences).not.toBeVisible();
			await page.goto(`${tourWorld.origin}/legal/cookies`);
			await page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true }).click();
			await expect(preferences.getByRole("switch", { name: "Allow Functionality", exact: true })).toBeChecked();
			const requestsBeforeRevocation = sdkRequests;
			await Promise.all([page.waitForEvent("load"), preferences.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			await page.goto(`${tourWorld.origin}/dashboard`);
			await openSidebar();
			await support.click();
			await expect(preferences).toBeVisible();
			await expect(preferences.getByRole("switch", { name: "Allow Functionality", exact: true })).not.toBeChecked();
			expect(sdkRequests).toBe(requestsBeforeRevocation);
		});
