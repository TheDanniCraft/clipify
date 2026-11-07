import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { guideContentKey } from "../../src/app/lib/userTour";
import { unzipSync } from "fflate";
import { readFile } from "node:fs/promises";
for (const width of [390, 1440])
	for (const theme of ["light", "dark"])
		test(`Batch exports stay stable and continue through navigation at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			test.setTimeout(120000);
			await page.setViewportSize({ width, height: 950 });
			await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
			const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
			const pool = tourWorld.fixture.pool;
			await pool.query("UPDATE auth.account SET scope=$1 WHERE provider_id='twitch' AND account_id=$2", ["channel:manage:clips", creatorId]);
			await pool.query("UPDATE user_content_states SET state=jsonb_set(state::jsonb,'{minimized}','true')::text WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey]);
			await pool.query(`UPDATE "twitchCache" SET value=jsonb_set(value::jsonb,'{testDownloadMode}','"delay"')::text WHERE key=$1`, [`clip:${creatorId}:${id}`]);
			await page.goto(`${tourWorld.origin}/dashboard/clips`);
			await page.getByRole("button", { name: "Reject optional", exact: true }).click();
			await expect(page.getByRole("button", { name: "Reject optional", exact: true })).not.toBeVisible();
			await page.reload();
			await expect(page.getByRole("button", { name: "Check for new clips", exact: true })).toHaveCount(0);
			await page.getByRole("button", { name: "Select page", exact: true }).click();
			const button = page.getByRole("button", { name: "Export selected", exact: true }),
				before = await button.boundingBox();
			await button.click();
			const settings = page.getByRole("dialog", { name: "Export clips", exact: true });
			await expect(settings.getByRole("link")).toHaveCount(0);
			await expect(settings.getByRole("button", { name: /layouts/i })).toHaveCount(0);
			await settings.screenshot({ path: info.outputPath("settings.png") });
			await page.getByRole("dialog", { name: "Export clips", exact: true }).getByRole("button", { name: "Next", exact: true }).click();
			await page.getByRole("button", { name: "Start export", exact: true }).click();
			const modal = page.getByRole("dialog", { name: "Clip exports", exact: true });
			await expect(modal).toBeVisible();
			await expect(modal.getByRole("list", { name: "Export 1 files" })).toContainText("Last night's clutch");
			await expect(modal.getByText("Downloading", { exact: true })).toBeVisible();
			const cancelBounds = (await modal.getByRole("button", { name: "Cancel export", exact: true }).boundingBox())!;
			const backgroundBounds = (await modal.getByRole("button", { name: "Continue in background", exact: true }).boundingBox())!;
			expect(cancelBounds.y + cancelBounds.height / 2).toBeCloseTo(backgroundBounds.y + backgroundBounds.height / 2, 0);
			const after = await button.boundingBox();
			expect(after!.width).toBeCloseTo(before!.width, 0);
			expect(after!.height).toBeCloseTo(before!.height, 0);
			await page.screenshot({ path: info.outputPath("processing.png"), fullPage: true, animations: "disabled" });
			const download = page.waitForEvent("download");
			await modal.getByRole("button", { name: "Continue in background", exact: true }).click();
			await page.getByRole("link", { name: "Last night's clutch", exact: true }).click();
			await expect(page).toHaveURL(/\/dashboard\/clips\//);
			if (width === 390) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
			await expect(page.getByRole("button", { name: "Exports", exact: true })).toBeVisible();
			await page.getByRole("row", { name: "Streams", exact: true }).click();
			await expect(page).toHaveURL(/\/dashboard\/streams$/);
			const media = await download;
			expect(media.suggestedFilename()).toMatch(/\.mp4$/);
			await media.saveAs(info.outputPath("single.mp4"));
			if (width === 390) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
			const sidebar = page.locator(`[data-slot="${width === 390 ? "sidebar-mobile" : "sidebar"}"]`);
			const utilities = sidebar.locator("[data-dashboard-utility]");
			expect(await utilities.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-dashboard-utility")))).toEqual(["admin", "guide", "exports", "chat", "help", "report", "account"]);
			await expect(sidebar.locator('[data-dashboard-utility="exports"]').getByRole("button", { name: "Exports", exact: true })).toBeVisible();
			await page.screenshot({ path: info.outputPath("export-footer.png"), fullPage: true, animations: "disabled" });
			await sidebar.getByRole("button", { name: "Exports", exact: true }).click();
			await expect(modal).toContainText("1 file ready");
			await expect(modal.getByText("Ready", { exact: true })).toBeVisible();
			await expect(page.getByText("Download started", { exact: true })).not.toBeVisible();
			await page.screenshot({ path: info.outputPath("completed.png"), fullPage: true, animations: "disabled" });
			await modal.getByRole("button", { name: "Close exports", exact: true }).click();
			if (width === 390) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
			await page.getByRole("row", { name: "Clip Inventory", exact: true }).click();
			await expect(page).toHaveURL(/\/dashboard\/clips$/);
			await page.getByRole("button", { name: "Select page", exact: true }).click();
			await page.getByRole("button", { name: "Export selected", exact: true }).click();
			await page.getByRole("dialog", { name: "Export clips", exact: true }).getByRole("button", { name: "Next", exact: true }).click();
			await page.getByRole("button", { name: "Start export", exact: true }).click();
			await expect(modal.locator('button[data-export-id="1"]')).toBeVisible();
			const historyRow = modal.locator('button[data-export-id="1"]');
			await expect
				.poll(() =>
					historyRow.evaluate((row) => {
						const label = row.querySelector("span")!.getBoundingClientRect();
						const chevron = row.querySelector("svg")!.getBoundingClientRect();
						return Math.abs(label.y + label.height / 2 - chevron.y - chevron.height / 2);
					}),
				)
				.toBeLessThanOrEqual(2);
			await modal.screenshot({ path: info.outputPath("collapsed-history.png") });
			await historyRow.click();
			await expect(modal.getByRole("list", { name: "Export 1 files" })).toBeVisible();
			await page.screenshot({ path: info.outputPath("history.png"), fullPage: true, animations: "disabled" });
			await modal.getByRole("button", { name: "Cancel export", exact: true }).click();
			await page.getByRole("dialog", { name: "Cancel export?", exact: true }).getByRole("button", { name: "Stop export", exact: true }).click();
		});
test("Fifty-one clips split at the minute boundary and share the server quota with individual downloads", async ({ page, request, tourWorld }, info) => {
	test.setTimeout(120000);
	const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
	const pool = tourWorld.fixture.pool;
	await pool.query("UPDATE auth.account SET scope=$1 WHERE provider_id='twitch' AND account_id=$2", ["channel:manage:clips", creatorId]);
	await pool.query("UPDATE user_content_states SET state=jsonb_set(state::jsonb,'{minimized}','true')::text WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey]);
	const row = (await pool.query('SELECT value FROM "twitchCache" WHERE key=$1', [`clip:${creatorId}:${id}`])).rows[0];
	const stored = JSON.parse(row.value);
	for (let index = 0; index < 50; index++) {
		const clipId = `LibrarySort${String(index).padStart(2, "0")}_${creatorId.slice("e2e-creator-".length)}`;
		await pool.query('INSERT INTO "twitchCache"(type,key,value) VALUES($1,$2,$3)', ["clip", `clip:${creatorId}:${clipId}`, JSON.stringify({ clip: { ...stored.clip, id: clipId, title: `Batch clip ${index}` } })]);
	}
	await page.goto(`${tourWorld.origin}/dashboard/clips`);
	await page.getByRole("button", { name: "Reject optional", exact: true }).click();
	await expect(page.getByRole("button", { name: "Reject optional", exact: true })).not.toBeVisible();
	await page.reload();
	await page.getByRole("button", { name: "Select page", exact: true }).click();
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await expect(page).toHaveURL(/page=2/);
	await expect(page.getByRole("grid", { name: "Clip inventory" }).locator("[data-clip-id]")).toHaveCount(25);
	await page.getByRole("button", { name: "Select page", exact: true }).click();
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Clip inventory" }).locator("[data-clip-id]")).toHaveCount(1);
	await page.getByRole("button", { name: "Select page", exact: true }).click();
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("51 selected");
	const downloads: import("@playwright/test").Download[] = [];
	page.on("download", (file) => downloads.push(file));
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	await page.getByRole("dialog", { name: "Export clips", exact: true }).getByRole("button", { name: "Next", exact: true }).click();
	await page.getByRole("button", { name: "Start export", exact: true }).click();
	await expect(page.getByText(/Waiting for the download limit/)).toBeVisible();
	expect(downloads).toHaveLength(0);
	const blocked = await page.request.post(`${tourWorld.origin}/api/clips/export?format=mp4`, { headers: { Origin: tourWorld.origin }, data: { creatorId, clipIds: [id] } });
	expect(blocked.status()).toBe(429);
	await expect.poll(() => downloads.length, { timeout: 75000 }).toBe(1);
	const file = downloads[0];
	expect(file.suggestedFilename()).toMatch(/^clipify-export-.*Z\.zip$/);
	await file.saveAs(info.outputPath("complete.zip"));
	expect(Object.keys(unzipSync(new Uint8Array(await readFile(info.outputPath("complete.zip"))))).filter((name) => name.endsWith(".mp4"))).toHaveLength(51);
	await file.delete();
});
test("Concurrent bulk requests reserve quantities atomically without charging rejected work", async ({ page, request, tourWorld }) => {
	test.setTimeout(120000);
	const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
	const pool = tourWorld.fixture.pool;
	await pool.query("UPDATE auth.account SET scope=$1 WHERE provider_id='twitch' AND account_id=$2", ["channel:manage:clips", creatorId]);
	const stored = JSON.parse((await pool.query('SELECT value FROM "twitchCache" WHERE key=$1', [`clip:${creatorId}:${id}`])).rows[0].value);
	const ids = [id];
	for (let index = 0; index < 29; index++) {
		const next = `LibrarySort${String(index).padStart(2, "0")}_${creatorId.slice("e2e-creator-".length)}`;
		ids.push(next);
		await pool.query('INSERT INTO "twitchCache"(type,key,value) VALUES($1,$2,$3)', ["clip", `clip:${creatorId}:${next}`, JSON.stringify({ clip: { ...stored.clip, id: next } })]);
	}
	const replies = await Promise.all([0, 1].map(() => page.request.post(`${tourWorld.origin}/api/clips/export`, { headers: { Origin: tourWorld.origin }, data: { creatorId, clipIds: ids } })));
	expect(replies.map((response) => response.status()).sort()).toEqual([200, 429]);
	const individual = await page.request.post(`${tourWorld.origin}/api/clips/export?format=mp4`, { headers: { Origin: tourWorld.origin }, data: { creatorId, clipIds: [id] } });
	expect(individual.status()).toBe(200);
});
