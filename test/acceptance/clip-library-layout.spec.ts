import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { writeFile } from "node:fs/promises";
for (const width of [390, 1440])
	for (const theme of ["light", "dark"] as const) {
		test(`Clip library navigation, search and focus at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			test.setTimeout(120000);
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
			await seedCreatorLibrary({ page, request, tourWorld });
			await page.goto(`${tourWorld.origin}/dashboard/clips`);
			const privacy = page.getByRole("button", { name: "Reject optional", exact: true });
			await expect(privacy).toBeVisible();
			await privacy.click();
			await expect(privacy).not.toBeVisible();
			await page.reload();
			await expect(page.getByRole("heading", { name: "Clip Inventory", exact: true })).toBeVisible();
			await expect(page.locator('[data-tour="guide-launcher"]')).toBeVisible();
			await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /light/);
			const launcher = page.getByRole("button", { name: "Search clips and tools", exact: true });
			await expect(launcher).toBeVisible();
			const toggle = page.getByRole("button", { name: "Toggle navigation", exact: true });
			if (width === 390) {
				await expect(toggle).toHaveAttribute("aria-expanded", "false");
				await toggle.press("Enter");
				await expect(page.getByRole("treegrid", { name: "Creator navigation", exact: true })).toBeVisible();
				await page.keyboard.press("Control+k");
			} else {
				await launcher.click();
				await expect(page.getByRole("dialog", { name: "Search clips and tools", exact: true })).toBeVisible();
				await page.getByRole("button", { name: "Close search", exact: true }).click();
				await expect(page.getByRole("dialog", { name: "Search clips and tools", exact: true })).not.toBeVisible();
				await page.keyboard.press("Control+b");
				await expect(toggle).toHaveAttribute("aria-expanded", "false");
				await expect(page.locator("[data-slot=sidebar]")).toHaveCSS("width", "48px");
				await page.keyboard.press("Control+k");
			}
			const dialog = page.getByRole("dialog", { name: "Search clips and tools", exact: true });
			await expect(dialog).toBeVisible();
			await expect(page.getByRole("dialog")).toHaveCount(1);
			const input = dialog.locator("input");
			await expect(input).toBeFocused();
			await input.fill("clutch");
			await expect(dialog.getByRole("menuitem", { name: "Last night's clutch", exact: true })).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(dialog).not.toBeVisible();
			await expect(launcher).toBeFocused();
			if (width === 1440) {
				await page.keyboard.press("Control+b");
				await expect(toggle).toHaveAttribute("aria-expanded", "true");
				await expect(page.locator("[data-slot=sidebar]")).toHaveCSS("width", "256px");
			}
			await page.screenshot({ path: info.outputPath(`inventory-${width}-${theme}.png`), fullPage: true });
			const selectionBounds = await page.getByRole("status", { name: "Clip selection", exact: true }).evaluate((element) => {
				const box = element.closest('[data-slot="card"]')!.getBoundingClientRect();
				return { x: box.x + scrollX, y: box.y + scrollY, w: box.width, h: box.height, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight };
			});
			await page.goto(`${tourWorld.origin}/dashboard`);
			await expect(page.getByRole("status", { name: "Known clips", exact: true })).toHaveText("1");
			await expect(page.getByRole("link", { name: "Last night's clutch", exact: true })).toBeVisible();
			await expect(page.getByText("Recent streams", { exact: true })).toBeVisible();
			await expect(page.getByRole("link", { name: "Latest stream", exact: true })).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			await page.screenshot({ path: info.outputPath(`home-${width}-${theme}.png`), fullPage: true });
			const homeBounds = await page.getByRole("region", { name: "Clip performance", exact: true }).evaluate((element) => {
				const rect = (node: Element) => {
					const box = node.getBoundingClientRect();
					return { x: box.x + scrollX, y: box.y + scrollY, w: box.width, h: box.height };
				};
				return { header: rect(element.querySelector("header")!), panels: rect(element.nextElementSibling!.nextElementSibling!), width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight };
			});
			const measurementsPath = info.outputPath(`layout-regions-${width}-${theme}.json`);
			await writeFile(measurementsPath, JSON.stringify({ inventory: selectionBounds, home: homeBounds }));
			await info.attach(`layout-regions-${width}-${theme}.json`, { path: measurementsPath, contentType: "application/json" });
			const streams = await page.getByText("Recent streams", { exact: true }).boundingBox();
			const topClips = await page.getByText("Top clips", { exact: true }).boundingBox();
			expect(streams).not.toBeNull();
			expect(topClips).not.toBeNull();
			if (width === 1440) {
				expect(Math.abs(streams!.y - topClips!.y)).toBeLessThanOrEqual(2);
				expect(streams!.x).toBeLessThan(topClips!.x);
			} else expect(streams!.y).toBeLessThan(topClips!.y);
			await launcher.press("Enter");
			await expect(dialog).toBeVisible();
			await dialog.locator("input").fill("Streams");
			await dialog.getByRole("menuitem", { name: "Streams", exact: true }).press("Enter");
			await expect(page.getByRole("heading", { name: "Streams", exact: true })).toBeVisible();
			await expect(dialog).not.toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		});
	}
