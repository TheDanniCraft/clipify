import { randomUUID } from "node:crypto";
import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { createAwardConfiguration } from "../../src/app/lib/eventDefaults";
import { openEventSection } from "../support/event-editor-navigation";
for (const [width, theme] of [
	[390, "dark"],
	[1440, "light"],
] as const) {
	test(`Category presentation options and complete Twitch choices at ${width}px ${theme}`, async ({ page, request, tourWorld }, info) => {
		await page.setViewportSize({ width, height: 950 });
		await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
		const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
		const eventId = randomUUID(),
			configuration = createAwardConfiguration("Awards", "UTC"),
			category = configuration.categories[0];
		category.selection = "data";
		category.title = "Clip of the year";
		category.presenterMode = "nominees";
		const slideId = randomUUID();
		configuration.slides = [{ id: slideId, type: "category", title: "Clip of the year", categoryId: category.id, text: "", statistics: [] }];
		await tourWorld.fixture.pool.query("INSERT INTO award_events(id,owner_id,configuration,presenter_digest) VALUES($1,$2,$3,$4)", [eventId, creatorId, JSON.stringify(configuration), "d".repeat(64)]);
		await page.goto(`${tourWorld.origin}/dashboard/events/${eventId}`);
		await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
		await openEventSection(page, "Categories");
		await page.getByRole("button", { name: "Edit Clip of the year", exact: true }).click();
		await page.getByRole("button", { name: "Presentation nominees" }).click();
		await page.getByRole("option", { name: "Selected by the team", exact: true }).click();
		const unlimited = page.locator('[data-slot="switch"]').filter({ hasText: "Unlimited nominees" });
		await unlimited.locator('[data-slot="switch-control"]').click();
		await expect(unlimited.getByRole("switch")).toBeChecked();
		await page.getByRole("button", { name: "Apply category", exact: true }).click();
		await page.getByRole("button", { name: "Save event", exact: true }).click();
		await expect(page.getByText("Event saved.", { exact: true })).toBeVisible();
		const saved = (await tourWorld.fixture.pool.query("SELECT configuration FROM award_events WHERE id=$1", [eventId])).rows[0].configuration;
		expect(saved.categories[0]).toMatchObject({ dataNomineeSource: "team", nomineeLimit: null, presenterMode: "nominees" });
		await openEventSection(page, "Connections");
		await expect(page.getByRole("button", { name: "Connect Twitch polls", exact: true })).toBeEnabled();
		await expect(page.getByRole("button", { name: "Connect YouTube", exact: true })).toHaveCount(0);
		await openEventSection(page, "Presentation");
		await page.getByRole("button", { name: "1. Clip of the year", exact: true }).click();
		await page.getByRole("button", { name: "Twitch interaction" }).click();
		await expect(page.getByRole("option", { name: "Poll", exact: true })).toHaveAttribute("aria-disabled", "true");
		await expect(page.getByRole("option", { name: "Channel Points prediction", exact: true })).toHaveAttribute("aria-disabled", "true");
		await page.keyboard.press("Escape");
		await page.getByRole("button", { name: "Category presentation" }).click();
		await page.getByRole("option", { name: "Winner only", exact: true }).click();
		await expect(page.getByText("Show nominees to enable a Twitch interaction.", { exact: true })).toBeVisible();
		await page.screenshot({ path: info.outputPath("category-slide-options.png"), fullPage: true });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		await openEventSection(page, "Connections");
		await page.route("https://id.twitch.tv/oauth2/authorize**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Isolated Twitch consent</h1>" }));
		const authorization = page.waitForRequest((request) => request.url().startsWith("https://id.twitch.tv/oauth2/authorize"));
		await page.getByRole("button", { name: "Connect Twitch polls", exact: true }).click();
		const twitch = new URL((await authorization).url());
		expect(twitch.searchParams.get("scope")!.split(" ")).toContain("channel:manage:polls");
		expect(twitch.searchParams.get("scope")!.split(" ")).not.toContain("channel:manage:predictions");
		expect(new URL(twitch.searchParams.get("redirect_uri")!).pathname).toBe("/api/auth/callback/twitch");
	});
}

test("Team can search and nominate a two-view clip for a data award", async ({ page, request, tourWorld }) => {
	const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query(`UPDATE "twitchCache" SET value=jsonb_set(value::jsonb,'{clip,view_count}','2')::text WHERE type='clip' AND key=$1`, [`clip:${creatorId}:${id}`]);
	const eventId = randomUUID(),
		configuration = createAwardConfiguration("Awards", "UTC"),
		category = configuration.categories[0];
	Object.assign(category, { selection: "data", presenterMode: "nominees", dataNomineeSource: "team", nomineeLimit: 5, title: "Clip of the year" });
	configuration.schedule = { ...configuration.schedule, submissionsStart: new Date(Date.now() - 7200000).toISOString(), submissionsEnd: new Date(Date.now() - 3600000).toISOString(), votingStart: new Date(Date.now() + 3600000).toISOString(), votingEnd: new Date(Date.now() + 7200000).toISOString() };
	await tourWorld.fixture.pool.query("INSERT INTO award_events(id,owner_id,configuration,published_at,presenter_digest) VALUES($1,$2,$3,now(),$4)", [eventId, creatorId, JSON.stringify(configuration), "d".repeat(64)]);
	await page.goto(`${tourWorld.origin}/dashboard/events/${eventId}`);
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await openEventSection(page, "Review");
	await page.getByRole("button", { name: "Add the first candidate", exact: true }).click();
	await page.getByRole("combobox", { name: "Search clips or paste a Twitch clip link" }).fill(`https://clips.twitch.tv/${id}`);
	const option = page.getByRole("option", { name: /Last night's clutch/ });
	await expect(option).toContainText("2 views");
	await option.click();
	await page.getByRole("dialog").getByRole("button", { name: "Add candidate", exact: true }).click();
	await expect(page.getByText("Candidate added.", { exact: true })).toBeVisible();
	const row = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: /Last night's clutch/ }) });
	await row.locator('[data-slot="checkbox-content"]').click();
	await page.getByRole("button", { name: "Nominate selected", exact: true }).click();
	await expect(page.getByText("Nominations saved.", { exact: true })).toBeVisible();
	const candidate = (await tourWorld.fixture.pool.query("SELECT content,nominated FROM award_candidates WHERE event_id=$1", [eventId])).rows[0];
	expect(candidate).toMatchObject({ nominated: true, content: { reference: id, views: 2 } });
	await expect(page.getByText("Additional nominees: 1 of 4", { exact: true })).toBeVisible();
	await tourWorld.fixture.pool.query("UPDATE award_events SET results_published_at=now(),frozen_results=$2 WHERE id=$1", [eventId, JSON.stringify({ [category.id]: { status: "ready", source: "manual", title: "Annual winner", description: "", asOf: new Date().toISOString() } })]);
	await page.goto(`${tourWorld.origin}/events/${eventId}`);
	await expect(page.getByRole("button", { name: "View Annual winner", exact: true })).toHaveCount(1);
	await expect(page.getByRole("button", { name: "View Last night's clutch", exact: true })).toBeVisible();
	await expect(page.getByText("Winner", { exact: true })).toBeVisible();
});
