import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { defaultProgress, guideContentKey } from "../../src/app/lib/userTour";

for (const width of [390, 1440])
	for (const theme of ["light", "dark"]) {
		test(`Resume setup with existing clips at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			test.setTimeout(120000);
			await page.setViewportSize({ width, height: 950 });
			await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
			const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
			await tourWorld.fixture.pool.query("UPDATE user_content_states SET state=$3 WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey, JSON.stringify({ ...defaultProgress(), welcomeSeen: true, minimized: true })]);
			await page.goto(`${tourWorld.origin}/dashboard`);
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			await expect(page.getByRole("status", { name: "Known clips" })).not.toHaveText("0");
			const card = page.locator('[aria-label="Finish your stream setup"]');
			await expect(card.getByText("Get your first overlay running", { exact: true })).toBeVisible();
			await card.scrollIntoViewIfNeeded();
			await card.screenshot({ path: info.outputPath(`setup-${theme}-${width}.png`) });
			const next = card.getByRole("button", { name: "Create and name your overlay", exact: true });
			await next.focus();
			await page.keyboard.press("Enter");
			await expect(page.locator(".driver-popover-title")).toBeVisible();
			await page.getByRole("button", { name: "Pause guide", exact: true }).click();
			await expect(page.locator(".driver-popover-title")).toHaveCount(0);
			await page.reload();
			await expect(card).toBeVisible();
			await card.getByRole("button", { name: "Create and name your overlay", exact: true }).click();
			await expect(page.locator(".driver-popover-title")).toBeVisible();
			expect((await tourWorld.fixture.pool.query("SELECT count(*) FROM overlays WHERE owner_id=$1", [creatorId])).rows[0].count).toBe("1");
		});
	}
