import { openEventSection } from "../support/event-editor-navigation";
import { randomUUID } from "node:crypto";
import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { createAwardConfiguration } from "../../src/app/lib/eventDefaults";
import { guideContentKey } from "../../src/app/lib/userTour";

for (const width of [390, 1440])
	for (const theme of ["light", "dark"])
		test(`Event editor sections and mouse nominations at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			await page.setViewportSize({ width, height: 950 });
			await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
			const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
			await tourWorld.fixture.pool.query("UPDATE user_content_states SET state=jsonb_set(state::jsonb,'{minimized}','true')::text WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey]);
			const configuration = createAwardConfiguration("Community event", "UTC"),
				now = Date.now(),
				eventId = randomUUID(),
				candidateId = randomUUID();
			configuration.schedule = { ...configuration.schedule, submissionsStart: new Date(now - 7200000).toISOString(), submissionsEnd: new Date(now - 3600000).toISOString(), votingStart: new Date(now + 3600000).toISOString(), votingEnd: new Date(now + 7200000).toISOString() };
			configuration.categories[0] = { ...configuration.categories[0], title: "Funniest community moment of the year", source: "text" };
			configuration.slides = [{ id: randomUUID(), type: "category", title: "The most unexpectedly chaotic community moment of the entire year", text: "", statistics: [], categoryId: configuration.categories[0].id }];
			configuration.categories.push({ ...configuration.categories[0], id: randomUUID(), title: "Community watchtime", selection: "data" });
			await tourWorld.fixture.pool.query("INSERT INTO award_events(id,owner_id,configuration,published_at,presenter_digest) VALUES($1,$2,$3,now(),$4)", [eventId, creatorId, JSON.stringify(configuration), "d".repeat(64)]);
			const title = "The lamp exploded during the most unexpectedly chaotic community stream";
			await tourWorld.fixture.pool.query("INSERT INTO award_candidates(id,event_id,category_id,canonical_key,content) VALUES($1,$2,$3,$4,$5)", [candidateId, eventId, configuration.categories[0].id, "text:lamp", JSON.stringify({ kind: "text", title, description: "A description that should remain readable without squeezing nomination controls.", reference: "" })]);
			await page.goto(`${tourWorld.origin}/dashboard/events/${eventId}`);
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			await expect(page.getByRole("button", { name: "Save presentation", exact: true })).toBeEnabled();
			for (const section of ["Event", "Roadmap", "Categories", "Data awards", "Connections", "Presentation", "Review"]) {
				const failConnections = (route: import("@playwright/test").Route) => (route.request().method() === "POST" && route.request().headers()["next-action"] ? route.fulfill({ status: 503, contentType: "text/plain", body: "Unavailable" }) : route.continue());
				if (section === "Connections") await page.route(new RegExp(`/dashboard/events/${eventId}(?:[?].*)?$`), failConnections);
				await openEventSection(page, section);
				if (section === "Review") await expect(page.getByRole("grid", { name: "Award proposals" })).toBeVisible();
				if (section === "Data awards") {
					await expect(page.getByRole("textbox", { name: "Winner name", exact: true })).toBeVisible();
					const numeric = page.locator('[data-slot="switch"]').filter({ hasText: "Include a number" });
					await numeric.locator('[data-slot="switch-control"]').click();
					await expect(numeric.getByRole("switch")).toBeChecked();
				}
				if (section === "Connections") {
					await expect(page.getByRole("alert").filter({ hasText: "Connections could not be loaded." })).toBeVisible();
					await page.unroute(new RegExp(`/dashboard/events/${eventId}(?:[?].*)?$`), failConnections);
					await page.getByRole("button", { name: "Retry connections", exact: true }).click();
					await expect(page.getByRole("button", { name: "Connect Google Drive", exact: true })).toBeEnabled();
					await expect(page.getByRole("button", { name: "Connect S3", exact: true })).toHaveCount(0);
					await page.getByRole("button", { name: "Storage location" }).click();
					await page.getByRole("option", { name: "S3", exact: true }).click();
					await expect(page.getByRole("button", { name: "Connect S3", exact: true })).toBeEnabled();
					await page.getByRole("button", { name: "Connect S3", exact: true }).click();
					await expect(page.getByRole("textbox", { name: "S3 endpoint", exact: true })).toBeVisible();
					await page.getByRole("button", { name: "Cancel", exact: true }).click();
				}

				if (section === "Presentation") {
					const preview = page.getByLabel("Live presentation preview", { exact: true });
					await expect(preview.locator("header")).toHaveCSS("opacity", "1");
					await expect(
						preview
							.getByRole("button", { name: `View ${title}`, exact: true })
							.locator("span")
							.first(),
					).toHaveCSS("white-space", "normal");
				}
				await page.screenshot({ path: info.outputPath(`${section.replaceAll(" ", "-")}.png`), fullPage: true, animations: "disabled" });
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
				if (section === "Presentation") {
					await page.getByRole("button", { name: "1. The most unexpectedly chaotic community moment of the entire year", exact: true }).click();
					await expect(page.getByRole("textbox", { name: "Slide title", exact: true })).toHaveValue("The most unexpectedly chaotic community moment of the entire year");
				}
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
			}
			const row = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${title}`) }) });
			await row.locator('[data-slot="checkbox-content"]').click();
			await expect(row.getByRole("checkbox")).toBeChecked();
			await page.getByRole("button", { name: "Nominate selected", exact: true }).click();
			await expect(page.getByText("Nominations saved.", { exact: true })).toBeVisible();
			await expect(row.getByRole("gridcell", { name: "Nominated", exact: true })).toBeVisible();
			expect((await tourWorld.fixture.pool.query("SELECT nominated FROM award_candidates WHERE id=$1", [candidateId])).rows[0].nominated).toBe(true);
			await page.screenshot({ path: info.outputPath("review-nominated.png"), fullPage: true, animations: "disabled" });
			await row.locator('[data-slot="checkbox-content"]').click();
			await page.getByRole("button", { name: "Remove nomination", exact: true }).click();
			await expect(row.getByRole("gridcell", { name: "Not nominated", exact: true })).toBeVisible();
			await page.getByRole("button", { name: `Preview ${title}`, exact: true }).click();
			await expect(page.getByRole("dialog", { name: title, exact: true })).toBeVisible();
			await page.screenshot({ path: info.outputPath("review-preview.png"), fullPage: true, animations: "disabled" });
			await page.keyboard.press("Escape");
			await expect(page.getByRole("dialog")).toHaveCount(0);
		});
