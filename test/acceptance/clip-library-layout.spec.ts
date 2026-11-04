import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { writeFile } from "node:fs/promises";
for (const width of [390, 820, 1024, 1440])
	for (const theme of ["light", "dark"] as const) {
		test(`Clip library navigation, search and focus at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			test.setTimeout(120000);
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
			const seeded = await seedCreatorLibrary({ page, request, tourWorld });
			await page.goto(`${tourWorld.origin}/dashboard/clips`);
			const privacy = page.getByRole("button", { name: "Reject optional", exact: true });
			await expect(privacy).toBeVisible();
			if (width === 390) {
				await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
				await expect(page.getByRole("treegrid", { name: "Creator navigation", exact: true })).toBeVisible();
				await expect(page.locator('[data-slot="sidebar-mobile-overlay-container"]').getByRole("button", { name: "Reject optional", exact: true })).toBeVisible();
			}
			await Promise.all([page.waitForEvent("load"), privacy.click()]);
			await expect(privacy).not.toBeVisible();
			await page.reload();
			await expect(page.getByRole("heading", { name: "Clip Inventory", exact: true })).toBeVisible();
			if (width !== 390) await expect(page.locator('[data-tour="guide-launcher"]')).toBeVisible();
			await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /light/);
			const launcher = page.getByRole("button", { name: "Search clips and tools", exact: true });
			if (width !== 390) await expect(launcher).toBeVisible();
			const toggle = page.getByRole("button", { name: "Toggle navigation", exact: true });
			if (width === 390) {
				await expect(toggle).toHaveAttribute("aria-expanded", "false");
				await toggle.press("Enter");
				await expect(page.locator('[data-slot="sidebar-mobile"] [data-tour="guide-launcher"]')).toBeVisible();
				await expect(page.getByRole("treegrid", { name: "Creator navigation", exact: true })).toBeVisible();
				await page.screenshot({ path: info.outputPath(`drawer-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
				await page.keyboard.press("Control+k");
			} else {
				if (width === 390) await toggle.click();
				await launcher.click();
				await expect(page.getByRole("dialog", { name: "Search clips and tools", exact: true })).toBeVisible();
				await page.getByRole("button", { name: "Close search", exact: true }).click();
				await expect(page.getByRole("dialog", { name: "Search clips and tools", exact: true })).not.toBeVisible();
				await page.keyboard.press("Control+b");
				await expect(toggle).toHaveAttribute("aria-expanded", "false");
				await expect(page.locator("[data-slot=sidebar]")).toHaveCSS("width", "48px");
				await page.screenshot({ path: info.outputPath(`rail-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
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
			await expect(width === 390 ? toggle : launcher).toBeFocused();
			if (width !== 390) {
				await page.keyboard.press("Control+b");
				await expect(toggle).toHaveAttribute("aria-expanded", "true");
				await expect(page.locator("[data-slot=sidebar]")).toHaveCSS("width", "256px");
			}
			await page.evaluate(() => window.scrollTo(0, 0));
			await expect(page.getByRole("button", { name: "Preview Last night's clutch", exact: true })).toBeInViewport();
			await page.screenshot({ path: info.outputPath(`inventory-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
			const filters = page.getByRole("button", { name: "Filters and sorting", exact: true });
			await filters.click();
			await expect(page.getByRole("textbox", { name: "Minimum views", exact: true })).toBeVisible();
			await page.screenshot({ path: info.outputPath(`filters-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
			await page.getByRole("textbox", { name: "Minimum views", exact: true }).fill("42");
			await page.getByRole("button", { name: "Apply filters", exact: true }).click();
			await expect(page).toHaveURL(/minViews=42/);
			await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText("1 clip");
			await page.getByRole("button", { name: "Clear filters", exact: true }).click();
			await expect(page).not.toHaveURL(/minViews=/);
			await filters.click();
			if (width === 390) await toggle.click();
			await launcher.click();
			await input.fill("clutch");
			await dialog.getByRole("menuitem", { name: "Last night's clutch", exact: true }).click();
			await expect(page).toHaveURL(`${tourWorld.origin}/dashboard/clips/${seeded.id}`);
			await expect(page.getByRole("heading", { name: "Last night's clutch", exact: true })).toBeVisible();
			await expect(page.getByRole("link", { name: "Open on Twitch", exact: true })).toHaveAttribute("href", `https://clips.twitch.tv/${seeded.id}`);
			await page.getByRole("button", { name: "Back to clip inventory", exact: true }).click();
			const selectionBounds = await page.getByRole("status", { name: "Clip selection", exact: true }).evaluate((element) => {
				const box = element.closest('[data-slot="card"]')!.getBoundingClientRect();
				return { x: box.x + scrollX, y: box.y + scrollY, w: box.width, h: box.height, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight };
			});
			await page.goto(`${tourWorld.origin}/dashboard`);
			await expect(page.getByRole("status", { name: "Known clips", exact: true })).toHaveText("1");
			await expect(page.getByRole("button", { name: "Last night's clutch", exact: true })).toBeVisible();
			await expect(page.getByText("Recent streams", { exact: true })).toBeVisible();
			await expect(page.getByRole("link", { name: "Latest stream", exact: true })).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			await page.screenshot({ path: info.outputPath(`home-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
			const homeBounds = await page.getByRole("region", { name: "Clip performance", exact: true }).evaluate((element) => {
				const rect = (node: Element) => {
					const box = node.getBoundingClientRect();
					return { x: box.x + scrollX, y: box.y + scrollY, w: box.width, h: box.height };
				};
				return { header: rect(element.querySelector("header")!), panels: rect(element.nextElementSibling!), width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight };
			});
			const measurementsPath = info.outputPath(`layout-regions-${width}-${theme}.json`);
			await writeFile(measurementsPath, JSON.stringify({ inventory: selectionBounds, home: homeBounds }));
			await info.attach(`layout-regions-${width}-${theme}.json`, { path: measurementsPath, contentType: "application/json" });
			const streams = await page.getByText("Recent streams", { exact: true }).boundingBox();
			const topClips = await page.getByText("Top clips", { exact: true }).boundingBox();
			expect(streams).not.toBeNull();
			expect(topClips).not.toBeNull();
			if (width >= 1024) {
				expect(Math.abs(streams!.y - topClips!.y)).toBeLessThanOrEqual(2);
				expect(streams!.x).toBeLessThan(topClips!.x);
			} else expect(streams!.y).toBeLessThan(topClips!.y);
			if (width === 390) await toggle.click();
			await launcher.press("Enter");
			await expect(dialog).toBeVisible();
			await dialog.locator("input").fill("Streams");
			await dialog.getByRole("menuitem", { name: "Streams", exact: true }).press("Enter");
			await expect(page.getByRole("heading", { name: "Streams", exact: true })).toBeVisible();
			await expect(dialog).not.toBeVisible();
			await page.screenshot({ path: info.outputPath(`streams-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
			await page.getByRole("link", { name: "Latest stream", exact: true }).click();
			await expect(page.getByRole("heading", { name: "Latest stream", exact: true })).toBeVisible();
			await page.screenshot({ path: info.outputPath(`stream-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
			const cached = await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE type=$1 AND key=$2', ["clip", `clip:${seeded.creatorId}:${seeded.id}`]);
			const value = JSON.parse(cached.rows[0].value);
			for (let index = 1; index <= 8; index++) {
				const id = `LibrarySort${String(index).padStart(2, "0")}_${seeded.creatorId.slice("e2e-creator-".length)}`;
				const clip = { ...value.clip, id, url: `https://clips.twitch.tv/${id}`, title: index === 1 ? "An unexpectedly close finish after a long evening of matches with the community" : `Community highlights ${index}`, view_count: 1200 + index };
				await tourWorld.fixture.pool.query('INSERT INTO "twitchCache" (type,key,value) VALUES ($1,$2,$3)', ["clip", `clip:${seeded.creatorId}:${id}`, JSON.stringify({ ...value, clip })]);
			}
			await page.goto(`${tourWorld.origin}/dashboard/clips`);
			await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText("9 clips");
			if (width === 390) await expect(page.locator('[data-tour="guide-launcher"]')).toBeHidden();
			else await expect(page.locator('[data-tour="guide-launcher"]')).toBeVisible();
			await page.getByRole("button", { name: "Select page", exact: true }).click();
			await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("9 selected");
			const title = page.getByRole("link", { name: "An unexpectedly close finish after a long evening of matches with the community", exact: true });
			const row = page.getByRole("row").filter({ has: title });
			const thumbnailBounds = await row.locator("img").boundingBox();
			const titleBounds = await title.boundingBox();
			expect(thumbnailBounds).not.toBeNull();
			expect(titleBounds).not.toBeNull();
			expect(thumbnailBounds!.x + thumbnailBounds!.width).toBeLessThanOrEqual(titleBounds!.x);
			expect(titleBounds!.y).toBeLessThan(thumbnailBounds!.y + thumbnailBounds!.height);
			expect(titleBounds!.y + titleBounds!.height).toBeGreaterThan(thumbnailBounds!.y);
			await page.screenshot({ path: info.outputPath(`selected-library-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			if (width === 390) {
				await toggle.click();
				await page.locator('[data-slot="sidebar-mobile"] [data-tour="guide-launcher"]').click();
				await expect(toggle).toHaveAttribute("aria-expanded", "false");
				await expect(page.getByRole("region", { name: "Your Clipify guide" })).toBeVisible();
			}
		});
	}
