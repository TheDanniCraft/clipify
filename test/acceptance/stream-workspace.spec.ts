import { test, expect } from "../bdd/support/user-tour";
import { guideContentKey } from "../../src/app/lib/userTour";
import { seedCreatorLibrary } from "../support/creator-library";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
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
				await page.getByRole("button", { name: "Reject optional", exact: true }).click();
				await page.reload();
				const row = page.locator('[data-broadcast-id="12345"]');
				await expect(row).toBeVisible();
				if (width === 1440) {
					const link = row.getByRole("link", { name: "Earlier stream", exact: true });
					await link.focus();
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
				const group = page.getByRole("button", { name: "2 clips at 0:10", exact: true });
				if (width === 1440) await group.hover();
				else await group.tap();
				const overview = page.getByRole("dialog", { name: "Clips at 0:10", exact: true });
				await expect(overview.getByRole("button", { name: /Earlier perspective/ })).toBeVisible();
				const bounds = (await overview.boundingBox())!;
				expect(bounds.x).toBeGreaterThanOrEqual(0);
				expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
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
				await page.getByRole("button", { name: "Start export", exact: true }).click();
				const download = await pendingDownload;
				const entries = unzipSync(await readFile((await download.path())!));
				const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
				expect(manifest.clips.map((clip: { id: string }) => clip.id).sort()).toEqual(expected.sort());
				await download.delete();
			});
		});
	}
