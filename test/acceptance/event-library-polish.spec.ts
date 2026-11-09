import { openEventSection } from "../support/event-editor-navigation";
import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { guideContentKey } from "../../src/app/lib/userTour";

for (const width of [390, 1440])
	for (const theme of ["light", "dark"])
		test(`Event creation and compact error recovery at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			await page.setViewportSize({ width, height: 950 });
			await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
			const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
			await tourWorld.fixture.pool.query("UPDATE user_content_states SET state=jsonb_set(state::jsonb,'{minimized}','true')::text WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey]);
			const url = `${tourWorld.origin}/dashboard/events`;
			await page.goto(url);
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			await expect(page.getByText("No events yet", { exact: true })).toBeVisible();
			const failAction = (route: import("@playwright/test").Route) => (route.request().method() === "POST" && route.request().headers()["next-action"] ? route.fulfill({ status: 503, contentType: "text/plain", body: "Temporarily unavailable" }) : route.continue());
			await page.route(url, failAction);
			await page.reload();
			const error = page.getByRole("alert").filter({ hasText: "Events could not be loaded." });
			await expect(error).toBeVisible();
			await expect(error).toHaveCSS("font-size", "14px");
			expect(await error.evaluate((node) => getComputedStyle(node).color)).not.toBe(
				await page
					.getByRole("heading", { name: "Events", exact: true })
					.first()
					.evaluate((node) => getComputedStyle(node).color),
			);
			const recovery = error.locator("..");
			await expect(recovery.getByRole("button", { name: "Retry events" })).toBeVisible();
			await recovery.screenshot({ path: info.outputPath("load-error.png"), animations: "disabled" });
			await page.unroute(url, failAction);
			await recovery.getByRole("button", { name: "Retry events" }).focus();
			await page.keyboard.press("Enter");
			await expect(page.getByText("No events yet", { exact: true })).toBeVisible();
			await page.route(url, failAction);
			await page.getByRole("button", { name: "Create event", exact: true }).click();
			await expect(page.getByRole("alert").filter({ hasText: "Your event could not be created." })).toHaveText("Your event could not be created. Please try again.");
			await page.unroute(url, failAction);
			let releaseCreation!: () => void;
			const creationGate = new Promise<void>((resolve) => {
				releaseCreation = resolve;
			});
			const holdCreation = async (route: import("@playwright/test").Route) => {
				if (route.request().method() === "POST" && route.request().headers()["next-action"]) await creationGate;
				await route.continue();
			};
			await page.route(url, holdCreation);
			const create = page.getByRole("button", { name: "Create event", exact: true });
			await create.click();
			await expect(create).toBeDisabled();
			await expect(page.getByRole("status").filter({ hasText: "Creating event…" })).toBeVisible();
			await expect(create.locator('[data-slot="spinner"]')).toBeVisible();
			await page.screenshot({ path: info.outputPath("creating-event.png"), fullPage: true, animations: "disabled" });
			releaseCreation();
			await expect(page).toHaveURL(/\/dashboard\/events\/[0-9a-f-]{36}$/);
			await expect(page.getByRole("dialog")).toHaveCount(0);
			await expect(page.getByRole("textbox", { name: "Event title", exact: true })).toHaveValue("New event");
			await expect(page.getByRole("button", { name: "Save event", exact: true })).toBeEnabled();
			await page.getByRole("textbox", { name: "Event title", exact: true }).fill("Community event");
			await page.getByRole("button", { name: "Save event", exact: true }).click();
			await expect(page.getByRole("status").filter({ hasText: "Event saved." })).toHaveText("Event saved.");
			await expect(page.getByRole("heading", { name: "Community event", exact: true })).toBeVisible();
			expect((await tourWorld.fixture.pool.query("SELECT configuration->>'title' AS title FROM award_events WHERE owner_id=$1", [creatorId])).rows).toEqual([{ title: "Community event" }]);
			await page.screenshot({ path: info.outputPath("event-editor.png"), fullPage: true, animations: "disabled" });
			await openEventSection(page, "Review");
			await expect(page.getByText("No proposals yet", { exact: true })).toBeVisible();
			await expect(page.getByRole("button", { name: "Nominate selected" })).toHaveCount(0);
			await expect(page.getByRole("grid", { name: "Award proposals" })).toHaveCount(0);
			await page.screenshot({ path: info.outputPath("empty-review.png"), fullPage: true, animations: "disabled" });
		});
