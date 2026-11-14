import { test, expect } from "@playwright/test";

for (const theme of ["light", "dark"])
	for (const width of [390, 2000]) {
		test(`Public support keeps its launcher through consent at ${width}px in ${theme}`, async ({ page }, info) => {
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
			let sdkRequests = 0;
			await page.route("https://chat.cloud.thedannicraft.de/**", async (route) => {
				expect(route.request().url()).toContain("/packs/js/sdk.js");
				sdkRequests++;
				await route.fulfill({
					contentType: "application/javascript",
					body: `window.chatwootSDK={run(){const bubble=document.createElement('div');bubble.className='woot--bubble-holder';const widget=document.createElement('div');widget.className='woot-widget-holder';document.body.append(bubble,widget);window.__supportOpens=0;window.$chatwoot={toggle(state){if(state==='open')window.__supportOpens++},toggleBubbleVisibility(state){bubble.style.display=state==='hide'?'none':'block'}};window.dispatchEvent(new Event('chatwoot:ready'))}};`,
				});
			});
			await page.goto("/");
			const launcher = page.getByRole("button", { name: "Enable support chat", exact: true });
			await expect(launcher).toBeVisible();
			if (width === 2000) await expect(launcher).toHaveCSS("bottom", "20px");
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			const before = await launcher.boundingBox();
			await launcher.click();
			const preferences = page.getByRole("dialog", { name: "Privacy preferences", exact: true });
			const functionality = preferences.getByRole("switch", { name: "Allow Functionality", exact: true });
			await functionality.focus();
			await functionality.press("Space");
			await expect(functionality).toBeChecked();
			await Promise.all([page.waitForEvent("load"), preferences.getByRole("button", { name: "Save choices", exact: true }).click()]);
			await expect.poll(() => sdkRequests).toBeGreaterThan(0);
			await expect(launcher).toBeVisible();
			expect(await launcher.boundingBox()).toEqual(before);
			await expect(page.locator(".woot--bubble-holder")).toBeHidden();
			await launcher.click();
			await expect.poll(() => page.evaluate(() => (window as typeof window & { __supportOpens?: number }).__supportOpens)).toBe(1);
			await expect(preferences).not.toBeVisible();
			await page.screenshot({ path: info.outputPath(`public-support-${width}-${theme}.png`) });
		});
	}
