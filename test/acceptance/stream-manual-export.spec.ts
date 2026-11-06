import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
test("saved stream exports every filtered clip across pages after Twitch removes its VOD", async ({ page, request, tourWorld }, info) => {
	test.setTimeout(180000);
	await page.setViewportSize({ width: 1440, height: 950 });
	const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("UPDATE auth.account SET scope='channel:manage:clips' WHERE account_id=$1", [creatorId]);
	const root = JSON.parse((await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE type=$1 AND key=$2', ["clip", `clip:${creatorId}:${id}`])).rows[0].value);
	root.clip.created_at = new Date(Date.now() - 3600000).toISOString();
	root.testProviderNoVod = true;
	await tourWorld.fixture.pool.query('UPDATE "twitchCache" SET value=$1 WHERE type=$2 AND key=$3', [JSON.stringify(root), "clip", `clip:${creatorId}:${id}`]);
	const expected = [id];
	for (let index = 1; index <= 60; index++) {
		const next = `LibrarySort${String(index).padStart(2, "0")}_${creatorId.slice("e2e-creator-".length)}`;
		const clip = { ...root.clip, id: next, title: `Stream clip ${index}`, video_id: index === 60 ? "12346" : "12345", view_count: index === 59 ? 9 : 10 };
		await tourWorld.fixture.pool.query('INSERT INTO "twitchCache"(type,key,value) VALUES($1,$2,$3)', ["clip", `clip:${creatorId}:${next}`, JSON.stringify({ ...root, clip })]);
		if (index < 59) expected.push(next);
	}
	await page.goto(`${tourWorld.origin}/dashboard/streams/12345?minViews=10`);
	await page.getByRole("button", { name: "Reject optional", exact: true }).click();
	await page.reload();
	await expect(page.getByRole("heading", { name: "Earlier stream", exact: true })).toBeVisible();
	await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText("59 clips");
	const automation = page.getByText("Automations", { exact: true });
	await expect(automation).toBeVisible();
	await expect(automation.locator('xpath=ancestor::*[@aria-disabled="true"]').first()).toBeVisible();
	await expect(page.getByText("Coming soon", { exact: true })).toBeVisible();
	await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,'test-videos-removed','true')", [creatorId]);
	await tourWorld.fixture.pool.query('DELETE FROM "twitchCache" WHERE type=$1 AND starts_with(key,$2)', ["user", `broadcasts:${creatorId}:`]);
	await page.getByRole("button", { name: "Refresh library", exact: true }).click();
	await expect.poll(async () => JSON.parse((await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE type=$1 AND key=$2', ["clip", `clip:${creatorId}:${id}`])).rows[0].value).clip.video_id, { timeout: 20000 }).toBe("");
	await page.reload();
	await expect(page.getByRole("heading", { name: "Earlier stream", exact: true })).toBeVisible();
	await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText("59 clips");
	await expect(page.getByText("Recording no longer available on Twitch. Your clips are kept.")).toBeVisible();
	await page.getByRole("button", { name: "Select all 59 clips", exact: true }).click();
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("59 selected");
	await page.screenshot({ path: info.outputPath("archived-filtered-stream.png"), fullPage: true, animations: "disabled" });
	const downloads: import("@playwright/test").Download[] = [];
	page.on("download", (download) => downloads.push(download));
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	await page.getByRole("button", { name: "Start export", exact: true }).click();
	await expect(page.getByRole("button", { name: "Cancel export", exact: true })).toHaveCount(0, { timeout: 130000 });
	await expect.poll(() => downloads.length).toBe(2);
	const included: string[] = [];
	for (const download of downloads) {
		const entries = unzipSync(await readFile((await download.path())!));
		const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
		for (const item of manifest.clips) {
			expect(item.status).toBe("included");
			expect(item.videoId).toBe("12345");
			expect(item.views).toBeGreaterThanOrEqual(10);
			included.push(item.id);
		}
		await download.delete();
	}
	expect(included.sort()).toEqual(expected.sort());
});
