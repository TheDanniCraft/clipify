import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { guideContentKey } from "../../src/app/lib/userTour";
import { createClipComposition } from "../../src/app/lib/clipComposition";

for (const width of [390, 1440])
	for (const theme of ["light", "dark"])
		test(`Resource library tables at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			await page.setViewportSize({ width, height: 950 });
			await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
			const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
			await tourWorld.fixture.pool.query("UPDATE user_content_states SET state=jsonb_set(state::jsonb,'{minimized}','true')::text WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey]);
			for (const id of ["main", "spare"]) await tourWorld.fixture.pool.query("INSERT INTO user_content_states (user_id,content_key,state) VALUES ($1,$2,$3)", [creatorId, `clip-layout-template:v2:${id}`, JSON.stringify({ name: `${id} layout`, composition: createClipComposition("desktop") })]);
			await page.goto(`${tourWorld.origin}/dashboard/events`);
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			await page.getByRole("button", { name: "Create event", exact: true }).click();
			await expect(page).toHaveURL(/\/dashboard\/events\/[0-9a-f-]{36}$/);
			const eventUrl = page.url();
			await page.goto(`${tourWorld.origin}/dashboard/events`);
			const events = page.getByRole("grid", { name: "Events", exact: true });
			await expect(events).toBeVisible();
			await expect(events.getByRole("rowheader", { name: "New event", exact: true })).toBeVisible();
			await page.screenshot({ path: info.outputPath("events.png"), fullPage: true });
			await events.getByRole("link", { name: "New event", exact: true }).click();
			await expect(page).toHaveURL(eventUrl);
			if (width < 768) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
			const home = page.getByRole("treegrid", { name: "Event workspace", exact: true }).getByRole("row", { name: "Back to home", exact: true });
			await home.focus();
			await page.keyboard.press("Enter");
			await expect(page).toHaveURL(`${tourWorld.origin}/dashboard`);
			await page.goto(`${tourWorld.origin}/dashboard/clip-layouts`);
			const layouts = page.getByRole("grid", { name: "Clip layouts", exact: true });
			await expect(layouts).toBeVisible();
			const main = layouts.getByRole("row").filter({ hasText: "main layout" });
			await main.getByRole("button", { name: "Make default", exact: true }).click();
			await expect(main.getByText("Default", { exact: true })).toBeVisible();
			await page.screenshot({ path: info.outputPath("layouts.png"), fullPage: true });
			const spare = layouts.getByRole("row").filter({ hasText: "spare layout" });
			await spare.getByRole("button", { name: "Delete", exact: true }).click();
			await expect(page.getByRole("dialog")).toBeVisible();
			await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
			await expect(spare).toBeVisible();
			await main.focus();
			await page.keyboard.press("Enter");
			await expect(page).toHaveURL(/layout=main/);
			await expect(page.getByRole("button", { name: "Save layout", exact: true })).toBeVisible();
		});
