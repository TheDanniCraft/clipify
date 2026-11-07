import { test, expect } from "../bdd/support/user-tour";
import { guideContentKey } from "../../src/app/lib/userTour";
import { seedCreatorLibrary } from "../support/creator-library";
import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
test.use({ actionTimeout: 15000, navigationTimeout: 15000 });
for (const theme of ["light", "dark"])
	for (const width of [390, 1440]) {
		test.describe(`${width}px ${theme}`, () => {
			test.use({ hasTouch: width === 390 });
			test(`Stream rows, grouped timeline and rule export at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
				test.setTimeout(120000);
				await page.setViewportSize({ width, height: 950 });
				await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
				const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
				await tourWorld.fixture.pool.query("UPDATE user_content_states SET state=jsonb_set(state::jsonb,'{minimized}','true')::text WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey]);
				const root = JSON.parse((await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE type=$1 AND key=$2', ["clip", `clip:${creatorId}:${id}`])).rows[0].value);
				root.clip.vod_offset = 14;
				root.clip.title = "Second perspective";
				root.clip.duration = 30;
				root.clip.view_count = 20;
				await tourWorld.fixture.pool.query('UPDATE "twitchCache" SET value=$1 WHERE type=$2 AND key=$3', [JSON.stringify(root), "clip", `clip:${creatorId}:${id}`]);
				const expected: string[] = [id];
				for (let i = 1; i <= 4; i++) {
					const clipId = `LibrarySort${String(i).padStart(2, "0")}_${creatorId.slice("e2e-creator-".length)}`;
					const clip = { ...root.clip, id: clipId, title: i === 1 ? "Earlier perspective" : i === 2 ? "Later perspective" : `Moment ${i}`, vod_offset: [10, 400, 120, 240][i - 1], duration: i === 4 || i === 2 ? 10 : 30, view_count: i === 4 ? 5 : i * 10 };
					await tourWorld.fixture.pool.query('INSERT INTO "twitchCache"(type,key,value) VALUES($1,$2,$3)', ["clip", `clip:${creatorId}:${clipId}`, JSON.stringify({ ...root, clip })]);
					if (i === 1 || i === 3) expected.push(clipId);
				}
				await page.goto(`${tourWorld.origin}/dashboard/streams`);
				const consentReload = page.waitForEvent("domcontentloaded");
				await page.getByRole("button", { name: "Reject optional", exact: true }).click();
				await consentReload;
				const row = page.locator('[data-broadcast-id="12345"]');
				await expect(row).toBeVisible();
				if (width === 1440) {
					const link = row.getByRole("link", { name: "Earlier stream", exact: true });
					// React Aria replaces its SSR collection during hydration; wait for its real focus state.
					await expect
						.poll(async () => {
							await link.focus();
							return link.getAttribute("data-focused");
						})
						.toBe("true");
					await expect(link).toBeFocused();
					await link.press("Enter");

					await expect(page).toHaveURL(/\/dashboard\/streams\/12345$/);
					await page.goBack();
					await expect(row).toBeVisible();
				}
				await expect.poll(() => row.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
				await page.screenshot({ path: info.outputPath("streams.png"), fullPage: true, animations: "disabled" });
				if (width === 390) await row.getByRole("gridcell").last().tap();
				else await row.getByRole("gridcell").last().click();
				await expect(page).toHaveURL(/\/dashboard\/streams\/12345$/);
				await expect(page.getByRole("list", { name: "Stream moments timeline" })).toBeVisible();
				const moments = page.getByRole("list", { name: "Stream moments timeline" });
				await expect(moments.getByRole("listitem").first()).toContainText("Stream start");
				await expect(moments.getByRole("listitem").last()).toContainText("Stream end");
				await expect(moments.getByRole("listitem").last()).toHaveAttribute("data-last", "true");
				if (width === 390) {
					await page.getByRole("link", { name: "Stream moments", exact: true }).click();
					await page.evaluate(() => document.getElementById("stream-moments")!.scrollIntoView({ behavior: "instant" }));
				} else await page.getByRole("heading", { name: "Stream moments", exact: true }).scrollIntoViewIfNeeded();
				const heading = page.getByRole("heading", { name: "Stream moments", exact: true });
				const navigation = page.locator("nav").first();
				await expect
					.poll(async () => {
						const titleBounds = (await heading.boundingBox())!;
						const navBounds = (await navigation.boundingBox())!;
						return titleBounds.y - navBounds.y - navBounds.height;
					})
					.toBeGreaterThanOrEqual(0);
				const group = page.getByRole("button", { name: "2 clips at 0:10", exact: true });
				if (width === 1440) await group.hover();
				else await group.tap();
				const overview = page.getByRole("dialog", { name: "Clips at 0:10", exact: true });
				await expect(overview.getByRole("button", { name: /Earlier perspective/ })).toBeVisible();
				const bounds = (await overview.boundingBox())!;
				expect(bounds.x).toBeGreaterThanOrEqual(0);
				expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
				expect(bounds.y).toBeGreaterThanOrEqual(0);
				expect(bounds.y + bounds.height).toBeLessThanOrEqual(950);
				await page.screenshot({ path: info.outputPath("moment-overview.png"), animations: "disabled" });
				await overview.getByRole("button", { name: /Second perspective/ }).click();
				await expect(page.getByRole("dialog", { name: "Second perspective", exact: true })).toBeVisible();
				await expect
					.poll(() =>
						page
							.getByRole("dialog", { name: "Second perspective", exact: true })
							.locator("video")
							.evaluate((video: HTMLVideoElement) => video.readyState),
					)
					.toBeGreaterThan(1);
				await page.keyboard.press("Escape");
				await tourWorld.fixture.pool.query("UPDATE auth.account SET scope='channel:manage:clips' WHERE account_id=$1", [creatorId]);
				await page.getByRole("textbox", { name: "Minimum views", exact: true }).fill("10");
				await page.getByRole("textbox", { name: "Minimum duration (seconds)", exact: true }).fill("20");
				await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText("5 clips");
				await page.getByRole("button", { name: "Apply filters", exact: true }).click();
				await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText("3 clips");
				const title = page.getByRole("link", { name: "Earlier perspective", exact: true });
				await expect(title).toBeVisible();
				expect((await title.boundingBox())!.width).toBeGreaterThan(100);
				await page.screenshot({ path: info.outputPath("stream-rules-timeline.png"), fullPage: true, animations: "disabled" });
				await page.getByRole("button", { name: "Export matching clips", exact: true }).click();
				await expect(page.getByText("Export clips", { exact: true })).toBeVisible();
				const pendingDownload = page.waitForEvent("download");
				await page.getByRole("dialog", { name: "Export clips", exact: true }).getByRole("button", { name: "Next", exact: true }).click();
				await page.getByRole("button", { name: "Start export", exact: true }).click();
				const download = await pendingDownload;
				const entries = unzipSync(await readFile((await download.path())!));
				const names = Object.keys(entries);
				expect(names).toHaveLength(expected.length);
				expect(names.every((name) => name.endsWith(".mp4"))).toBe(true);
				for (const id of expected) expect(names.filter((name) => name.includes(id))).toHaveLength(1);
				await download.delete();
			});
		});
	}

for (const width of [390, 1440])
	test(`Long stream timeline stays in document flow at ${width}px`, async ({ page, request, tourWorld }, info) => {
		await page.setViewportSize({ width, height: 950 });
		await page.addInitScript((t) => localStorage.setItem("theme", t), width === 390 ? "light" : "dark");
		const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
		const root = JSON.parse((await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE key=$1', [`clip:${creatorId}:${id}`])).rows[0].value);
		for (let i = 1; i < 60; i++) {
			const clipId = `LibrarySort${String(i).padStart(2, "0")}_${creatorId.slice("e2e-creator-".length)}`;
			const clip = { ...root.clip, id: clipId, title: `Timeline review ${i}`, vod_offset: i * 60, duration: 10, created_at: new Date(Date.UTC(2026, 10, 1 + Math.floor(i / 20), 12, i % 20)).toISOString() };
			await tourWorld.fixture.pool.query('INSERT INTO "twitchCache"(type,key,value) VALUES($1,$2,$3)', ["clip", `clip:${creatorId}:${clipId}`, JSON.stringify({ ...root, clip })]);
		}
		await page.goto(`${tourWorld.origin}/dashboard/streams/12345`);
		const reload = page.waitForEvent("domcontentloaded");
		await page.getByRole("button", { name: "Reject optional", exact: true }).click();
		await reload;
		const panel = page.getByRole("region", { name: "Stream moments", exact: true });
		await expect(panel.getByRole("listitem")).toHaveCount(62);
		await expect(page.getByRole("region", { name: "Stream moments scroll area" })).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Show more moments" })).toHaveCount(0);
		const overflow = await panel.evaluate((el) => ({ height: el.clientHeight, content: el.scrollHeight, overflow: getComputedStyle(el).overflowY }));
		expect(overflow.content).toBeLessThanOrEqual(overflow.height + 1);
		expect(overflow.overflow).toBe("visible");
		await panel.getByText("Stream end", { exact: true }).scrollIntoViewIfNeeded();
		await expect(panel.getByText("Stream end", { exact: true })).toBeInViewport();
		await page.screenshot({ path: info.outputPath("complete-timeline-end.png"), animations: "disabled" });
	});
