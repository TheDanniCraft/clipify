import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { createClipComposition } from "../../src/app/lib/clipComposition";
import { guideContentKey } from "../../src/app/lib/userTour";
test.use({ actionTimeout: 15000, navigationTimeout: 15000 });
for (const theme of ["light", "dark"])
	for (const width of [390, 1440])
		test(`Export options stay stable across formats at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			await page.setViewportSize({ width, height: 950 });
			await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
			const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
			await tourWorld.fixture.pool.query("UPDATE user_content_states SET state=jsonb_set(state::jsonb,'{minimized}','true')::text WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey]);
			const desktop = createClipComposition("desktop"),
				mobile = createClipComposition("mobile");
			await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,'clip-layout-template:v2:main',$2)", [creatorId, JSON.stringify({ name: "Main", composition: desktop, compositions: { desktop, mobile } })]);
			const requests: string[] = [];
			page.on("request", (r) => {
				if (r.method() === "POST" && new URL(r.url()).pathname.startsWith("/api/clips/export")) requests.push(r.url());
			});
			await page.goto(`${tourWorld.origin}/dashboard/clips`);
			await page.getByRole("button", { name: "Reject optional", exact: true }).click();
			await page.reload();
			await expect(page.getByRole("button", { name: "Refresh library", exact: true })).toHaveCount(0);
			const actions = page.getByRole("group", { name: "Filter actions" });
			await expect(actions.getByRole("button", { name: "Clear filters", exact: true })).toBeVisible();
			await page.getByRole("button", { name: "Select page", exact: true }).click();
			await page.getByRole("button", { name: "Export selected", exact: true }).click();
			const dialog = page.getByRole("dialog", { name: "Export clips", exact: true });
			await expect(dialog.locator('[data-slot="autocomplete-trigger"]')).toBeVisible();
			await expect(dialog.getByText("Loading your saved layouts…", { exact: true })).toHaveCount(0);
			await dialog.screenshot({ path: info.outputPath("original-options.png"), animations: "disabled" });
			await expect(dialog.getByRole("radiogroup", { name: "Export for", exact: true })).toBeVisible();
			await expect(dialog.getByRole("radio", { name: "Discord", exact: true })).toBeVisible();
			await expect(dialog.getByRole("radiogroup", { name: "Processing" })).toHaveCount(0);
			const box = (await dialog.boundingBox())!,
				templateBox = (await dialog.locator('[data-slot="autocomplete-trigger"]').boundingBox())!,
				targetBox = (await dialog.getByRole("radiogroup", { name: "Export for" }).boundingBox())!,
				buttonBox = (await dialog.getByRole("button", { name: "Start export", exact: true }).boundingBox())!;
			for (const version of ["Desktop", "Mobile"]) {
				await dialog.getByRole("checkbox", { name: version, exact: true }).focus();
				await page.keyboard.press("Space");
				expect((await dialog.boundingBox())!.height).toBeCloseTo(box.height, 0);
				expect((await dialog.locator('[data-slot="autocomplete-trigger"]').boundingBox())!.y).toBeCloseTo(templateBox.y, 0);
				expect((await dialog.getByRole("radiogroup", { name: "Export for" }).boundingBox())!.y).toBeCloseTo(targetBox.y, 0);
				expect((await dialog.getByRole("button", { name: "Start export", exact: true }).boundingBox())!.y).toBeCloseTo(buttonBox.y, 0);
			}
			await expect(dialog.getByRole("status", { name: "Export file count" })).toHaveText("3 video files");
			await dialog.getByText("Discord", { exact: true }).click();
			await expect(dialog.getByRole("radio", { name: "Discord", exact: true })).toBeChecked();
			await dialog.getByRole("radio", { name: "Discord", exact: true }).focus();
			await page.keyboard.press("ArrowLeft");
			await expect(dialog.getByRole("radio", { name: "General", exact: true })).toBeChecked();
			await page.keyboard.press("ArrowRight");
			await expect(dialog.getByRole("radio", { name: "Discord", exact: true })).toBeChecked();
			expect(requests).toHaveLength(0);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			await dialog.screenshot({ path: info.outputPath("combined-options.png"), animations: "disabled" });
			await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
			await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("1 selected");
		});
