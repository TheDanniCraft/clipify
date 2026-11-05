import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { createClipComposition } from "../../src/app/lib/clipComposition";
test.use({ actionTimeout: 10000, navigationTimeout: 15000 });
for (const width of [390, 1440])
	for (const theme of ["light", "dark"])
		test(`One template contains both formats, live reference search and matching layer colors at ${width} ${theme}`, async ({ page, request, tourWorld }, info) => {
			test.setTimeout(150000);
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
			const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
			await tourWorld.fixture.pool.query("UPDATE playlist_clips SET clip_data=jsonb_set(clip_data::jsonb,'{testPreviewOfficial}','true')::text WHERE clip_id=$1", [id]);
			const desktop = createClipComposition("desktop"),
				mobile = createClipComposition("mobile");
			await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,$2,$3)", [creatorId, "clip-layout-template:v2:paired", JSON.stringify({ name: "My stream", composition: mobile, compositions: { desktop, mobile } })]);
			await page.goto(`${tourWorld.origin}/dashboard/clip-layouts?layout=paired&reference=${id}&format=mobile`);
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			await expect(page.getByRole("button", { name: "Play preview", exact: true })).toBeEnabled({ timeout: 20000 });
			await expect(page.locator("video")).toHaveAttribute("src", /\/api\/clips\/preview\?/);
			const rendered = () => page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => [...canvas.getContext("2d")!.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 4), 1, 1).data].slice(0, 3).some((value) => value > 10));
			await expect.poll(rendered).toBe(true);
			await expect(page.getByRole("button", { name: "Search clips", exact: true })).toHaveCount(0);
			const picker = page.getByRole("region", { name: "Editor workspace" }).locator('[data-slot="autocomplete-trigger"]');
			await picker.click();
			const search = page.getByRole("searchbox", { name: "Find a reference clip" });
			await search.fill("not-a-matching-title");
			await expect(page.getByText("No clips found. Try another title.", { exact: true })).toBeVisible();
			await search.fill("clutch");
			await expect(page.getByRole("option", { name: "Last night's clutch", exact: true })).toBeVisible();
			await page.getByRole("option", { name: "Last night's clutch", exact: true }).click();
			await expect(page.getByRole("button", { name: "Play preview", exact: true })).toBeEnabled();
			const colors = await page.getByRole("button", { name: "Camera crop", exact: true }).evaluate((node) => getComputedStyle(node.parentElement!).borderColor);
			expect(colors).toBe(await page.getByRole("button", { name: "Camera output", exact: true }).evaluate((node) => getComputedStyle(node.parentElement!).borderColor));
			expect(colors).not.toBe(await page.getByRole("button", { name: "Gameplay crop", exact: true }).evaluate((node) => getComputedStyle(node.parentElement!).borderColor));
			await page.getByRole("textbox", { name: "Layer name", exact: true }).fill("Face camera");
			await page.getByRole("button", { name: "Save layout", exact: true }).click();
			await expect(page.getByRole("button", { name: "Save layout", exact: true })).toBeDisabled();
			await page.getByRole("tab", { name: "Desktop 16:9", exact: true }).click();
			await expect(page.getByRole("textbox", { name: "Layer name", exact: true })).toHaveValue("Gameplay");
			await page.getByRole("textbox", { name: "Layer name", exact: true }).fill("Full gameplay");
			await page.getByRole("button", { name: "Save layout", exact: true }).click();
			await expect(page.getByRole("button", { name: "Save layout", exact: true })).toBeDisabled();
			await expect.poll(async () => JSON.parse((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, "clip-layout-template:v2:paired"])).rows[0].state).compositions.desktop.layers[0].label).toBe("Full gameplay");
			const state = JSON.parse((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, "clip-layout-template:v2:paired"])).rows[0].state);
			expect(state.compositions.mobile.layers[0].label).toBe("Face camera");
			expect(state.compositions.desktop.layers[0].label).toBe("Full gameplay");
			await page.getByRole("tab", { name: "Mobile 9:16", exact: true }).click();
			await expect(page.getByRole("textbox", { name: "Layer name", exact: true })).toHaveValue("Face camera");
			const add = page.locator('[data-slot="select-trigger"]').filter({ hasText: "Add crop or widget" });
			await add.scrollIntoViewIfNeeded();
			const offset = await add.evaluate((node) => {
				const icon = node.querySelector("svg")!.getBoundingClientRect(),
					value = node.querySelector('[data-slot="select-value"]')!.getBoundingClientRect();
				return Math.abs(icon.y + icon.height / 2 - value.y - value.height / 2);
			});
			expect(offset).toBeLessThanOrEqual(2);
			await expect(page.getByRole("button", { name: "Play preview", exact: true })).toBeEnabled();
			await expect.poll(rendered).toBe(true);
			await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
			await page.waitForFunction(() => window.scrollY === 0);
			await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))));
			await page.screenshot({ path: info.outputPath("paired-editor.png"), fullPage: true, animations: "disabled" });
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		});
test("Concurrent Desktop and Mobile saves preserve both compositions", async ({ page, request, tourWorld }) => {
	test.setTimeout(120000);
	const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
	const desktop = createClipComposition("desktop"),
		mobile = createClipComposition("mobile");
	await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,$2,$3)", [creatorId, "clip-layout-template:v2:pair-race", JSON.stringify({ name: "Concurrent", composition: mobile, compositions: { desktop, mobile } })]);
	await page.goto(`${tourWorld.origin}/dashboard/clip-layouts?layout=pair-race&format=desktop`);
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	const second = await page.context().newPage();
	await second.goto(`${tourWorld.origin}/dashboard/clip-layouts?layout=pair-race&format=mobile`);
	await page.getByRole("textbox", { name: "Layer name", exact: true }).fill("Saved Desktop");
	await second.getByRole("textbox", { name: "Layer name", exact: true }).fill("Saved Mobile");
	await tourWorld.fixture.pool.query("CREATE FUNCTION clipify_pair_save_delay() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(1); RETURN NEW; END $$; CREATE TRIGGER pair_save_delay BEFORE INSERT OR UPDATE ON user_content_states FOR EACH ROW WHEN (NEW.content_key='clip-layout-template:v2:pair-race') EXECUTE FUNCTION clipify_pair_save_delay();");
	await Promise.all([page.getByRole("button", { name: "Save layout", exact: true }).click(), second.getByRole("button", { name: "Save layout", exact: true }).click()]);
	await expect
		.poll(
			async () => {
				const state = JSON.parse((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, "clip-layout-template:v2:pair-race"])).rows[0].state);
				return [state.compositions.desktop.layers[0].label, state.compositions.mobile.layers[0].label];
			},
			{ timeout: 10000 },
		)
		.toEqual(["Saved Desktop", "Saved Mobile"]);
	await second.close();
});
