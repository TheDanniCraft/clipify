import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

for (const width of [320, 390, 1440, 2000])
	for (const theme of ["light", "dark"])
		test(`Public feature grouping at ${width}px in ${theme}`, async ({ page }, info) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
			await page.emulateMedia({ reducedMotion: "reduce" });
			await page.goto("/");
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			const section = page.getByRole("region", { name: "Your scene. Your style. Your team at the controls." });
			const heading = section.getByRole("heading", { level: 2 });
			const compare = section.getByRole("link", { name: "Compare Free and Pro", exact: true });
			await section.getByRole("img").first().scrollIntoViewIfNeeded();
			await section
				.getByRole("img")
				.first()
				.evaluate((img: HTMLImageElement) => img.decode());
			await page.evaluate(() => window.scrollTo(0, 0));
			const rect = (await section.boundingBox())!;
			const first = (await section.locator("article").first().boundingBox())!;
			const h = (await heading.boundingBox())!;
			const c = (await compare.boundingBox())!;
			const clip = { x: rect.x, y: rect.y, width: rect.width, height: first.y + first.height - rect.y };
			await page.screenshot({ path: info.outputPath("pro-feature-section.png"), clip, fullPage: true, animations: "disabled" });
			await writeFile(info.outputPath("feature-rects.json"), JSON.stringify({ clip, heading: h, compare: c, first }));
			// The comparison belongs to the heading on every viewport, with one leading edge.
			expect(Math.abs(c.x - h.x)).toBeLessThan(2);
			expect(c.y).toBeGreaterThanOrEqual(h.y + h.height);
			expect(c.y - h.y - h.height).toBeLessThanOrEqual(25);
			await expect(compare).toHaveAttribute("href", "#pricing");
			await compare.focus();
			await compare.press("Enter");
			await expect(page).toHaveURL(/#pricing$/);
			const exports = page.getByRole("region", { name: "Your clips. Ready to share." });
			await expect(exports).toContainText("Free includes exports");
			await exports.getByRole("link", { name: "Explore clip exports", exact: true }).click();
			await expect(page).toHaveURL(/\/features#exports$/);
			await expect(page.locator("#exports")).toContainText("Original");
			await expect(page.locator("#exports")).toContainText("Mobile");
			await expect(page.locator("#exports")).toContainText("Free");
			await page.locator("#exports").getByRole("img").scrollIntoViewIfNeeded();
			await page
				.locator("#exports")
				.getByRole("img")
				.evaluate((img: HTMLImageElement) => img.decode());
			await page.locator("#exports").screenshot({ path: info.outputPath("export-feature.png"), animations: "disabled" });
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			const startExport = page.getByRole("link", { name: "Start exporting clips", exact: true });
			await startExport.focus();
			await startExport.evaluate((link) => link.scrollIntoView({ block: "center" }));
			await expect(startExport).toBeInViewport({ ratio: 1 });
			await startExport.press("Enter");
			await expect(page).toHaveURL(/\/login\?returnUrl=%2Fdashboard%2Fclips$/);
			await expect(page.getByRole("button", { name: "Login with Twitch", exact: true })).toBeVisible();
			const llms = await (await page.request.get("/llms.txt")).text();
			const full = await (await page.request.get("/llms-full.txt")).text();
			expect(llms).toContain("/features#exports");
			expect(full).toContain("## Clip inventory, exports and reusable layouts");
			expect(full).toContain("Original downloads remain untouched");
		});
