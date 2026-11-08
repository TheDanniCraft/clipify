import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { defaultProgress, guideContentKey } from "../../src/app/lib/userTour";

test.use({ actionTimeout: 12000, navigationTimeout: 15000 });

for (const width of [390, 1440])
	for (const theme of ["light", "dark"]) {
		test(`Discover library pages through sidebar navigation at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			test.setTimeout(120000);
			await page.setViewportSize({ width, height: 950 });
			await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
			const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
			await tourWorld.fixture.pool.query("UPDATE user_content_states SET state=$3 WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey, JSON.stringify({ ...defaultProgress(), welcomeSeen: true, minimized: true, journeyId: "explore", completed: ["overlay.name"] })]);
			await page.goto(`${tourWorld.origin}/dashboard`);
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			const openGuide = async () => {
				if (await page.getByRole("region", { name: "Your Clipify guide", exact: true }).isVisible()) return;
				if (width === 390) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
				await page.locator('button[aria-controls="clipify-guide-panel"]:visible').click();
				const panel = page.getByRole("region", { name: "Your Clipify guide", exact: true });
				await expect(panel).toBeVisible();
				await expect
					.poll(() =>
						panel.evaluate((node) => {
							const rect = node.getBoundingClientRect();
							return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + 20));
						}),
					)
					.toBe(true);
				await page.screenshot({ path: info.outputPath("guide-panel.png") });
			};
			for (const [task, label, target, title, path] of [
				["explore.home", "Understand your Home dashboard", "dashboard-home", "Your clips at a glance", "/dashboard"],
				["explore.streams", "Discover your streams", "streams-tab", "Your past streams", "/dashboard/streams"],
				["explore.clips", "Discover Clip Inventory", "clips-tab", "Your clip library", "/dashboard/clips"],
				["explore.layouts", "Discover clip layouts", "clip-layouts-tab", "Reusable clip layouts", "/dashboard/clip-layouts"],
			]) {
				if (task === "explore.layouts" && width === 1440) {
					await page.locator('[data-tour="resources-group"]:visible').click();
				}
				if (width === 1440) await expect(page.locator('[data-tour="dashboard-home"]')).toHaveCount(1);
				await openGuide();
				const chapter = page.getByRole("region", { name: "Your Clipify guide", exact: true }).getByRole("button", { name: /^Explore Clipify/ });
				if ((await chapter.getAttribute("aria-expanded")) !== "true") await chapter.click();
				await page.getByRole("button", { name: label, exact: true }).click();
				if (!page.url().endsWith(path)) {
					const destination = page.locator(`[data-guide-navigation][data-tour="${target}"]:visible`);
					await expect(destination).toBeVisible();
					if (width === 390) await expect(page.locator('[data-slot="sidebar-mobile"]')).toBeVisible();
					await destination.click();
				}
				await expect(page).toHaveURL(new RegExp(`${path}$`));
				const intro = page.getByRole("dialog", { name: title, exact: true });
				await expect(intro).toBeVisible();
				await expect(page.locator(".driver-overlay")).toHaveCount(1);
				await expect(intro).toHaveCSS("opacity", "1");
				await page.screenshot({ path: info.outputPath(`${task}.png`) });
				await intro.getByRole("button", { name: "Done", exact: true }).click();
				await expect.poll(async () => JSON.parse((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey])).rows[0].state).completed).toContain(task);
			}
			const progress = JSON.parse((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey])).rows[0].state);
			expect(progress.completed).toContain("overlay.name");
			expect(progress.completed).not.toContain("export.manual");
		});
	}

test("Export guide follows the real settings and completes after download", async ({ page, request, tourWorld }, info) => {
	const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("UPDATE auth.account SET scope='channel:manage:clips' WHERE provider_id='twitch' AND account_id=$1", [creatorId]);
	await tourWorld.fixture.pool.query(`UPDATE "twitchCache" SET value=jsonb_set(value::jsonb,'{testDownloadMode}','"audio"')::text WHERE key=$1`, [`clip:${creatorId}:${id}`]);
	await tourWorld.fixture.pool.query("UPDATE user_content_states SET state=$3 WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey, JSON.stringify({ ...defaultProgress(), welcomeSeen: true, minimized: false, journeyId: "export" })]);
	await page.goto(`${tourWorld.origin}/dashboard/clips`);
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await page.locator('button[aria-controls="clipify-guide-panel"]:visible').click();
	await page.getByRole("button", { name: "Export clips from your library", exact: true }).click();
	await page.getByRole("dialog", { name: "Find clips to export", exact: true }).getByRole("button", { name: "Continue", exact: true }).click();
	await page.getByRole("button", { name: "Select page", exact: true }).click();
	await page.getByRole("dialog", { name: "Select your clips", exact: true }).getByRole("button", { name: "Continue", exact: true }).click();
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	await page.getByRole("dialog", { name: "Choose versions and layouts", exact: true }).getByRole("button", { name: "Continue", exact: true }).click();
	await page.getByRole("dialog", { name: "Export clips", exact: true }).getByRole("button", { name: "Next", exact: true }).click();
	await page.getByRole("dialog", { name: "Choose an export preset", exact: true }).getByRole("button", { name: "Continue", exact: true }).click();
	const download = page.waitForEvent("download");
	await page.getByRole("button", { name: "Start export", exact: true }).click();
	await (await download).saveAs(info.outputPath("guided-export.mp4"));
	await expect.poll(async () => JSON.parse((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey])).rows[0].state).completed).toContain("export.manual");
});
