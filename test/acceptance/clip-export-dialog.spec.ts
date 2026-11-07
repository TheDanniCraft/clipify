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
			const consentReload = page.waitForEvent("domcontentloaded");
			await page.getByRole("button", { name: "Reject optional", exact: true }).click();
			await consentReload;
			await expect(page.getByRole("button", { name: "Refresh library", exact: true })).toHaveCount(0);
			const actions = page.getByRole("group", { name: "Filter actions" });
			await expect(actions.getByRole("button", { name: "Clear filters", exact: true })).toBeVisible();
			await page.getByRole("button", { name: "Select page", exact: true }).click();
			await page.getByRole("button", { name: "Export selected", exact: true }).click();
			const dialog = page.getByRole("dialog", { name: "Export clips", exact: true });
			await expect(dialog.locator('[data-slot="autocomplete-trigger"]')).toBeVisible();
			await expect(dialog.getByText("Loading your saved layouts…", { exact: true })).toHaveCount(0);
			await dialog.screenshot({ path: info.outputPath("original-options.png"), animations: "disabled" });
			const box = (await dialog.boundingBox())!;
			const templateBox = (await dialog.locator('[data-slot="autocomplete-trigger"]').boundingBox())!;
			for (const version of ["Desktop", "Mobile"]) {
				await dialog.getByRole("checkbox", { name: version, exact: true }).focus();
				await page.keyboard.press("Space");
				expect((await dialog.boundingBox())!.height).toBeCloseTo(box.height, 0);
				expect((await dialog.locator('[data-slot="autocomplete-trigger"]').boundingBox())!.y).toBeCloseTo(templateBox.y, 0);
			}
			await expect(dialog.getByRole("status", { name: "Export file count" })).toHaveText("3 video files");
			await dialog.getByRole("button", { name: "Next", exact: true }).click();
			await expect(dialog.getByRole("button", { name: /Export for/ })).toBeFocused();
			await expect(dialog.getByRole("group", { name: "Discord account", exact: true })).toHaveCount(0);
			await page.keyboard.press("Space");
			await page.getByRole("option", { name: "Discord", exact: true }).click();
			await dialog.getByRole("radio", { name: "Nitro Basic", exact: true }).click();
			await expect(dialog.getByText("Within Nitro Basic’s 50 MB upload allowance.", { exact: true })).toBeVisible();
			await dialog.screenshot({ path: info.outputPath("discord-options.png"), animations: "disabled" });
			await dialog.getByRole("button", { name: "Back", exact: true }).click();
			for (const name of ["Original", "Desktop", "Mobile"]) await expect(dialog.getByRole("checkbox", { name, exact: true })).toBeChecked();
			await dialog.getByRole("button", { name: "Next", exact: true }).click();
			await expect(dialog.getByRole("radio", { name: "Nitro Basic", exact: true })).toBeChecked();
			await dialog.getByRole("button", { name: /Export for/ }).click();
			await page.getByRole("option", { name: "General", exact: true }).click();
			await expect(dialog.getByRole("group", { name: "Discord account", exact: true })).toHaveCount(0);
			await expect(dialog.getByRole("button", { name: "Start export", exact: true })).toBeEnabled();
			expect(requests).toHaveLength(0);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			await dialog.screenshot({ path: info.outputPath("combined-options.png"), animations: "disabled" });
			await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
			await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("1 selected");
		});
