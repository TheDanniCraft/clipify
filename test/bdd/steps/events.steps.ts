import { openConsentPage } from "../../support/consent-page";
import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/user-tour";
import { defaultProgress, guideContentKey } from "../../../src/app/lib/userTour";
const { Given, When, Then } = createBdd(test);
Given("a creator is ready to organize an award show", async ({ page, request, tourWorld }) => {
	const response = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { withProviderCredentials: true, billingState: "active" } });
	expect(response.status()).toBe(200);
	const owner = await response.json();
	tourWorld.owner = owner.fixture;
	await page.context().addCookies([owner.cookie]);
	await openConsentPage(page, tourWorld.origin);
	await page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true }).click();
	const privacy = page.getByRole("dialog", { name: "Privacy preferences", exact: true });
	await Promise.all([page.waitForEvent("load"), privacy.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await tourWorld.fixture.pool.query("INSERT INTO user_content_states (user_id,content_key,state) VALUES ($1,$2,$3) ON CONFLICT (user_id,content_key) DO UPDATE SET state=EXCLUDED.state", [tourWorld.owner!.creatorId, guideContentKey, JSON.stringify({ ...defaultProgress(), welcomeSeen: true, minimized: true })]);
	await page.goto(`${tourWorld.origin}/dashboard/events`);
});
When("the creator creates an event named {string}", async ({ page }, name: string) => {
	await page.getByRole("button", { name: "Create event", exact: true }).click();
	await page.getByRole("textbox", { name: /^Event title/ }).fill(name);
	await page.getByRole("button", { name: "Create awards", exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard\/events\/[0-9a-f-]{36}$/);
});
Then("the award editor preserves its name and shows editable phase dates", async ({ page }) => {
	await expect(page.getByRole("textbox", { name: /^Event title/ })).toHaveValue("Babbler Awards");
	await page.getByRole("tab", { name: "Roadmap", exact: true }).click();
	for (const label of ["Submissions open", "Submissions close", "Voting opens", "Voting closes"]) await expect(page.getByRole("group", { name: label, exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Save event", exact: true })).toBeVisible();
});

import { randomUUID, createHash } from "node:crypto";
import { createAwardConfiguration } from "../../../src/app/lib/eventDefaults";
import type { TourWorld } from "../support/user-tour";
type AwardWorld = { eventId: string; categoryId: string; configuration: ReturnType<typeof createAwardConfiguration> };
const awardWorld = (world: TourWorld) => world.result as AwardWorld;
Given("a published award show is accepting text proposals without review", async ({ page, tourWorld }) => {
	const now = Date.now(),
		instant = (offset: number) => new Date(now + offset).toISOString();
	const configuration = createAwardConfiguration("Babbler Awards", "UTC");
	configuration.schedule = { submissionsStart: instant(-3600000), submissionsEnd: instant(3600000), votingStart: instant(7200000), votingEnd: instant(10800000), timezone: "UTC", reviewRequired: false };
	configuration.categories[0] = { ...configuration.categories[0], title: "Insider of the year", source: "text", submissionLimit: 1 };
	const eventId = randomUUID();
	tourWorld.result = { eventId, categoryId: configuration.categories[0].id, configuration };
	await tourWorld.fixture.pool.query("INSERT INTO award_events(id,owner_id,configuration,published_at,presenter_digest) VALUES($1,$2,$3,now(),$4)", [eventId, tourWorld.owner!.creatorId, JSON.stringify(configuration), createHash("sha256").update("fixture-presenter-secret").digest("hex")]);
	await page.goto(`${tourWorld.origin}/events/${eventId}`);
});
When("the participant submits the proposal {string}", async ({ page }, title: string) => {
	await page.getByRole("tab", { name: "Categories", exact: true }).click();
	await page.getByRole("textbox", { name: /^Proposal name/ }).fill(title);
	await page.getByRole("button", { name: "Submit proposal", exact: true }).click();
	await expect(page.getByText("Your proposal was submitted.", { exact: true })).toBeVisible();
});
Then("the personal proposals show {string}", async ({ page }, title: string) => {
	await page.getByRole("tab", { name: "My proposals", exact: true }).click();
	await expect(page.getByRole("tabpanel", { name: "My proposals" }).getByText(title, { exact: true })).toBeVisible();
});
When("the participant withdraws that proposal", async ({ page }) => {
	await page.getByRole("button", { name: "Withdraw proposal", exact: true }).click();
	await expect(page.getByText("You have not submitted any proposals.", { exact: true })).toBeVisible();
});
When("voting opens for the award show", async ({ page, tourWorld }) => {
	const world = awardWorld(tourWorld),
		now = Date.now();
	world.configuration.schedule = { ...world.configuration.schedule, submissionsEnd: new Date(now - 120000).toISOString(), votingStart: new Date(now - 60000).toISOString(), votingEnd: new Date(now + 3600000).toISOString() };
	await tourWorld.fixture.pool.query("UPDATE award_events SET configuration=$2 WHERE id=$1", [world.eventId, JSON.stringify(world.configuration)]);
	await page.reload();
});
When("the participant votes for {string}", async ({ page }, title: string) => {
	const choice = page.getByRole("checkbox", { name: new RegExp(`^Vote for ${title}`) });
	await page.locator('[data-slot="checkbox"]').filter({ has: choice }).getByText(title, { exact: true }).click({ timeout: 10000 });
	await expect(choice).toBeChecked();
});
Then("the award vote is persisted", async ({ page, tourWorld }) => {
	const world = awardWorld(tourWorld);
	await expect.poll(async () => Number((await tourWorld.fixture.pool.query("SELECT count(*) FROM award_votes WHERE event_id=$1", [world.eventId])).rows[0].count)).toBe(1);
	await page.reload();
	await expect(page.getByRole("checkbox", { name: /^Vote for Lampe raucht ab/ })).toBeChecked();
});
When("voting closes for the award show", async ({ page, tourWorld }) => {
	const world = awardWorld(tourWorld);
	world.configuration.schedule.votingEnd = new Date(Date.now() - 1000).toISOString();
	await tourWorld.fixture.pool.query("UPDATE award_events SET configuration=$2 WHERE id=$1", [world.eventId, JSON.stringify(world.configuration)]);
	await page.reload();
});
Then("the saved choice stays visible without revealing results", async ({ page }) => {
	await expect(page.getByText(/Voting has ended/)).toBeVisible();
	await expect(page.getByText("Your selection", { exact: true })).toBeVisible();
	await expect(page.getByRole("checkbox")).toHaveCount(0);
	await expect(page.getByText(/\d+%/)).toHaveCount(0);
});

Given("a published award show is accepting images into connected Google Drive", async ({ page, tourWorld }) => {
	const { symmetricEncrypt } = await import("better-auth/crypto");
	const owner = tourWorld.owner!.creatorId;
	const linked = await tourWorld.fixture.pool.query("SELECT user_id FROM auth.account WHERE provider_id='twitch' AND account_id=$1", [owner]);
	const authUserId = linked.rows[0].user_id;
	const accountId = randomUUID(),
		connectionId = randomUUID(),
		eventId = randomUUID();
	const token = await symmetricEncrypt({ key: "clipify-e2e-better-auth-secret-not-for-production", data: "isolated-event-drive-token" });
	await tourWorld.fixture.pool.query("INSERT INTO auth.account(id,account_id,provider_id,user_id,access_token,access_token_expires_at,scope,created_at,updated_at) VALUES($1,$2,'google',$3,$4,$5,$6,now(),now())", [accountId, "drive-fixture-account", authUserId, token, new Date(Date.now() + 3600000), "https://www.googleapis.com/auth/drive.file"]);
	await tourWorld.fixture.pool.query("INSERT INTO event_connections(id,owner_id,provider,auth_account_id,auth_user_id,identity_id,identity_name) VALUES($1,$2,'drive',$3,$4,'fixture-folder','Google Drive')", [connectionId, owner, accountId, authUserId]);
	const configuration = createAwardConfiguration("Babbler Awards", "UTC");
	configuration.storageConnectionId = connectionId;
	configuration.categories[0] = { ...configuration.categories[0], source: "image", title: "Lustigstes Bild", submissionLimit: 1 };
	configuration.schedule = { ...configuration.schedule, submissionsStart: new Date(Date.now() - 3600000).toISOString(), reviewRequired: false };
	tourWorld.result = { eventId, categoryId: configuration.categories[0].id, configuration };
	await tourWorld.fixture.pool.query("INSERT INTO award_events(id,owner_id,configuration,published_at,presenter_digest) VALUES($1,$2,$3,now(),$4)", [eventId, owner, JSON.stringify(configuration), createHash("sha256").update("fixture-presenter-secret").digest("hex")]);
	await page.goto(`${tourWorld.origin}/events/${eventId}`);
});
When("the participant uploads a picture named {string}", async ({ page }, name: string) => {
	await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVZkAAAAASUVORK5CYII=", "base64") });
	const [response] = await Promise.all([page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/upload") && response.request().method() === "POST"), page.getByRole("button", { name: "Submit proposal", exact: true }).click()]);
	const outcome = await response.json();
	expect(outcome, JSON.stringify(outcome)).toMatchObject({ ok: true });
	await expect(page.getByText("Your proposal was submitted.", { exact: true })).toBeVisible();
});
Then("the nominated image opens as a full preview", async ({ page }) => {
	await page.getByRole("button", { name: "View Lampe", exact: true }).click();
	const preview = page.getByRole("dialog", { name: "Lampe", exact: true });
	await expect(preview).toBeVisible();
	await expect.poll(() => preview.getByRole("img", { name: "Lampe", exact: true }).evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(1);
});

Given("the team is reviewing two related text proposals after the planned voting start", async ({ page, tourWorld }) => {
	const now = Date.now(),
		instant = (offset: number) => new Date(now + offset).toISOString();
	const configuration = createAwardConfiguration("Babbler Awards", "UTC");
	configuration.categories[0] = { ...configuration.categories[0], source: "text", title: "Insider des Jahres", submissionLimit: null };
	configuration.schedule = { submissionsStart: instant(-7200000), submissionsEnd: instant(-3600000), votingStart: instant(-1800000), votingEnd: instant(3600000), reviewRequired: true, timezone: "UTC" };
	const eventId = randomUUID(),
		categoryId = configuration.categories[0].id;
	tourWorld.result = { eventId, categoryId, configuration };
	await tourWorld.fixture.pool.query("INSERT INTO award_events(id,owner_id,configuration,published_at,presenter_digest) VALUES($1,$2,$3,now(),$4)", [eventId, tourWorld.owner!.creatorId, JSON.stringify(configuration), createHash("sha256").update("fixture-presenter-secret").digest("hex")]);
	for (const title of ["hahaha die Lampe", "Birne explodiert"]) {
		const id = randomUUID();
		await tourWorld.fixture.pool.query("INSERT INTO award_candidates(id,event_id,category_id,canonical_key,content) VALUES($1,$2,$3,$4,$5)", [id, eventId, categoryId, `submission:${id}`, JSON.stringify({ kind: "text", title, description: "Original proposal", reference: "" })]);
	}
	await page.goto(`${tourWorld.origin}/dashboard/events/${eventId}`);
	await page.getByRole("tab", { name: "Review", exact: true }).click();
});
When("the team groups those proposals as {string}", async ({ page }, title: string) => {
	for (const proposal of ["hahaha die Lampe", "Birne explodiert"]) {
		const checkbox = page
			.getByRole("row")
			.filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${proposal}`) }) })
			.getByRole("checkbox");
		await checkbox.focus();
		await checkbox.press("Space");
		await expect(checkbox).toBeChecked();
	}
	await page.getByRole("button", { name: "Group selected", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Group proposals", exact: true });
	await dialog.getByRole("textbox", { name: "Presentation title", exact: true }).fill(title);
	await dialog.getByRole("button", { name: "Create group", exact: true }).click();
	await expect(page.getByText("Proposals grouped. You can now nominate the group.", { exact: true })).toBeVisible();
});
When("nominates the group and finishes review", async ({ page }) => {
	const checkbox = page
		.getByRole("row")
		.filter({ has: page.getByRole("rowheader", { name: /^Lampe raucht ab/ }) })
		.getByRole("checkbox");
	await checkbox.focus();
	await checkbox.press("Space");
	await page.getByRole("button", { name: "Nominate selected", exact: true }).click();
	await expect(page.getByText("Nominations saved.", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Finish review", exact: true }).click();
	await page.getByRole("dialog", { name: "Finish award review", exact: true }).getByRole("button", { name: "Confirm nominees", exact: true }).click();
	await expect(page.getByText("Review completed. Voting follows your roadmap.", { exact: true })).toBeVisible();
});
Then("viewers see one nominee without its original grouped proposals", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/events/${awardWorld(tourWorld).eventId}`);
	await expect(page.getByRole("button", { name: "View Lampe raucht ab", exact: true })).toBeVisible();
	await expect(page.getByText("hahaha die Lampe", { exact: true })).toHaveCount(0);
	await expect(page.getByText("Birne explodiert", { exact: true })).toHaveCount(0);
	await expect(page.getByRole("checkbox")).toHaveCount(1);
});

Given("an award show has closed with an unconfirmed watchtime result", async ({ page, tourWorld }) => {
	const now = Date.now(),
		instant = (offset: number) => new Date(now + offset).toISOString();
	const configuration = createAwardConfiguration("Babbler Awards", "UTC");
	configuration.categories[0] = { ...configuration.categories[0], source: "text", title: "Top Watchtime", selection: "data" };
	configuration.schedule = { submissionsStart: instant(-14400000), submissionsEnd: instant(-10800000), votingStart: instant(-7200000), votingEnd: instant(-3600000), reviewRequired: false, timezone: "UTC" };
	const eventId = randomUUID(),
		categoryId = configuration.categories[0].id;
	tourWorld.result = { eventId, categoryId, configuration };
	await tourWorld.fixture.pool.query("INSERT INTO award_events(id,owner_id,configuration,published_at,presenter_digest,frozen_at,frozen_results) VALUES($1,$2,$3,now(),$4,$5,$6)", [eventId, tourWorld.owner!.creatorId, JSON.stringify(configuration), createHash("sha256").update("fixture-presenter-secret").digest("hex"), configuration.schedule.submissionsEnd, JSON.stringify({ [categoryId]: { status: "missing", reason: "manual_required" } })]);
	await page.goto(`${tourWorld.origin}/dashboard/events/${eventId}`);
	await page.getByRole("tab", { name: "Data awards", exact: true }).click();
});
When("the team records {string} with {int} watched hours", async ({ page }, name: string, hours: number) => {
	await page.getByRole("textbox", { name: "Winner name", exact: true }).fill(name);
	await page.getByText("Include a number", { exact: true }).click();
	await page.getByRole("textbox", { name: "Result value", exact: true }).fill(String(hours), { timeout: 10000 });
	await page.getByRole("button", { name: "Save result", exact: true }).click();
	await expect(page.getByText("Result saved.", { exact: true })).toBeVisible();
});
When("explicitly publishes the award results", async ({ page }) => {
	await page.getByRole("button", { name: "Publish results", exact: true }).click();
	await expect(page.getByText("Results published.", { exact: true })).toBeVisible();
});
Then("the public archive shows that data winner and its number", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/events/${awardWorld(tourWorld).eventId}`);
	await expect(page.getByRole("heading", { name: "Top Watchtime", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "View Babbler One", exact: true })).toBeVisible();
	await expect(page.getByText("321", { exact: true })).toBeVisible();
	await expect(page.getByRole("checkbox")).toHaveCount(0);
});

When("the team adds a candidate named {string}", async ({ page }, title: string) => {
	await page.getByRole("button", { name: "Add candidate", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Add award candidate", exact: true });
	await dialog.getByRole("textbox", { name: "Proposal name", exact: true }).fill(title);
	await dialog.getByRole("button", { name: "Add candidate", exact: true }).click();
	await expect(dialog).not.toBeVisible();
	await expect(page.getByRole("rowheader", { name: new RegExp(`^${title}`) })).toBeVisible();
});
When("the team adds an image candidate named {string}", async ({ page, tourWorld }, name: string) => {
	await page.goto(`${tourWorld.origin}/dashboard/events/${awardWorld(tourWorld).eventId}`);
	await page.getByRole("tab", { name: "Review", exact: true }).click();
	await page.getByRole("button", { name: "Add candidate", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Add award candidate", exact: true });
	await dialog.locator('input[type="file"]').setInputFiles({ name, mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVZkAAAAASUVORK5CYII=", "base64") });
	await dialog.getByRole("button", { name: "Add candidate", exact: true }).click();
	await expect(dialog).not.toBeVisible();
	await expect(page.getByRole("rowheader", { name: "Lampe", exact: true })).toBeVisible();
});
Then("the team image is available as a public nominee", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/events/${awardWorld(tourWorld).eventId}`);
	await page.getByRole("button", { name: "View Lampe", exact: true }).click();
	const preview = page.getByRole("dialog", { name: "Lampe", exact: true });
	await expect(preview).toBeVisible();
	await expect.poll(() => preview.getByRole("img", { name: "Lampe", exact: true }).evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(1);
});
