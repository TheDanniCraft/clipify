import { openEventSection } from "../../support/event-editor-navigation";
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
	await expect(page).toHaveURL(/\/dashboard\/events\/[0-9a-f-]{36}$/);
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Save event", exact: true })).toBeEnabled();
	await page.getByRole("textbox", { name: /^Event title/ }).fill(name);
	await page.getByRole("button", { name: "Save event", exact: true }).click();
	await expect(page.getByText("Event saved.", { exact: true })).toHaveText("Event saved.");
});
Then("the award editor preserves its name and shows editable phase dates", async ({ page }) => {
	await expect(page.getByRole("textbox", { name: /^Event title/ })).toHaveValue("Babbler Awards");
	await expect(page.getByRole("button", { name: "Save event", exact: true })).toBeEnabled();
	await openEventSection(page, "Roadmap");
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
	await expect(page.getByRole("button", { name: "Submit proposal", exact: true })).toBeEnabled();
	await expect(page.getByText("Your proposal was submitted.", { exact: true }).first()).toBeVisible();
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
	await tourWorld.fixture.pool.query("INSERT INTO auth.account(id,account_id,provider_id,user_id,access_token,access_token_expires_at,scope,created_at,updated_at) VALUES($1,$2,'google-drive',$3,$4,$5,$6,now(),now())", [accountId, "drive-fixture-account", authUserId, token, new Date(Date.now() + 3600000), "https://www.googleapis.com/auth/drive.file"]);
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
	await expect(page.getByText("Your proposal was submitted.", { exact: true }).first()).toBeVisible();
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
	await expect(page.getByRole("button", { name: /^Save (event|presentation)$/ })).toBeEnabled();
	await openEventSection(page, "Review");
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
	await expect(page.getByRole("button", { name: /^Save (event|presentation)$/ })).toBeEnabled();
	await openEventSection(page, "Data awards");
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
	await page.getByRole("button", { name: /^(Add candidate|Add the first candidate)$/ }).click();
	const dialog = page.getByRole("dialog", { name: "Add award candidate", exact: true });
	await dialog.getByRole("textbox", { name: "Proposal name", exact: true }).fill(title);
	await dialog.getByRole("button", { name: "Add candidate", exact: true }).click();
	await expect(dialog).not.toBeVisible();
	await expect(page.getByRole("rowheader", { name: new RegExp(`^${title}`) })).toBeVisible();
});
When("the team adds an image candidate named {string}", async ({ page, tourWorld }, name: string) => {
	await page.goto(`${tourWorld.origin}/dashboard/events/${awardWorld(tourWorld).eventId}`);
	await expect(page.getByRole("button", { name: /^Save (event|presentation)$/ })).toBeEnabled();
	await openEventSection(page, "Review");
	await page.getByRole("button", { name: /^(Add candidate|Add the first candidate)$/ }).click();
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

Given("a completed award show has a nominated text winner", async ({ page, tourWorld }) => {
	const now = Date.now(),
		instant = (offset: number) => new Date(now + offset).toISOString(),
		configuration = createAwardConfiguration("Babbler Awards", "UTC");
	configuration.categories[0] = { ...configuration.categories[0], source: "text", title: "Best fail" };
	configuration.schedule = { submissionsStart: instant(-14400000), submissionsEnd: instant(-10800000), votingStart: instant(-7200000), votingEnd: instant(-3600000), reviewRequired: false, timezone: "UTC" };
	const eventId = randomUUID(),
		categoryId = configuration.categories[0].id,
		secret = "s".repeat(43),
		candidateId = randomUUID();
	tourWorld.result = { eventId, categoryId, configuration };
	await tourWorld.fixture.pool.query("INSERT INTO award_events(id,owner_id,configuration,published_at,presenter_digest) VALUES($1,$2,$3,now(),$4)", [eventId, tourWorld.owner!.creatorId, JSON.stringify(configuration), createHash("sha256").update(secret).digest("hex")]);
	await tourWorld.fixture.pool.query("INSERT INTO award_candidates(id,event_id,category_id,canonical_key,content,nominated) VALUES($1,$2,$3,'fixture',$4,true)", [candidateId, eventId, categoryId, JSON.stringify({ kind: "text", title: "Lampe raucht ab", description: "Der Stromausfall des Jahres", reference: "" })]);
	const linked = await tourWorld.fixture.pool.query("SELECT user_id FROM auth.account WHERE provider_id='twitch' AND account_id=$1", [tourWorld.owner!.creatorId]);
	await tourWorld.fixture.pool.query("INSERT INTO award_votes(event_id,category_id,candidate_id,auth_user_id) VALUES($1,$2,$3,$4)", [eventId, categoryId, candidateId, linked.rows[0].user_id]);
	await page.goto(`${tourWorld.origin}/events/${eventId}/present#${secret}`);
	await expect(page.getByRole("heading", { name: "Babbler Awards", exact: true })).toBeVisible();
});
When("the host presents the nominees and reveals the winner", async ({ page }) => {
	await page.keyboard.press("ArrowRight");
	await expect(page.getByRole("heading", { name: "Best fail", exact: true })).toBeVisible();
	await page.keyboard.press("ArrowRight");
	await page.getByRole("button", { name: "View Lampe raucht ab", exact: true }).click();
	await expect(page.getByText("Der Stromausfall des Jahres", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("button", { name: "Close preview", exact: true })).toHaveCount(0);
	await page.keyboard.press("ArrowRight");
	await expect(page.getByLabel("Nominee results").getByRole("button")).toHaveCount(1);
	await expect(page.getByLabel("Nominee results").getByRole("progressbar")).toHaveCount(0);
	await page.keyboard.press("ArrowRight");
	await expect(page.getByText("Winner", { exact: true })).toBeVisible();
	await expect(page.getByText("100% (1 vote)", { exact: true })).toBeVisible();
});
Then("results remain hidden from the public", async ({ page, tourWorld }) => {
	const audience = await page.context().newPage();
	await audience.goto(`${tourWorld.origin}/events/${awardWorld(tourWorld).eventId}`);
	await expect(audience.getByText(/Voting has ended/)).toBeVisible();
	await expect(audience.getByText("Winner", { exact: true })).toHaveCount(0);
	await audience.close();
});
When("the host explicitly publishes from the last presenter slide", async ({ page }) => {
	await page.keyboard.press("ArrowRight");
	await expect(page.getByRole("heading", { name: "Thank you!", exact: true })).toBeVisible();
	await page.keyboard.press("ArrowRight");
	await page.keyboard.press("ArrowRight");
	await page.getByRole("button", { name: "Publish results", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Results are published", exact: true })).toBeVisible();
});
Then("the public archive shows the presented winner", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/events/${awardWorld(tourWorld).eventId}`);
	await expect(page.getByText("Winner", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "View Lampe raucht ab", exact: true })).toBeVisible();
});

Given("presenter live chat is enabled with a hidden bot and command prefix", async ({ page, tourWorld }) => {
	const world = awardWorld(tourWorld);
	await page.goto(`${tourWorld.origin}/dashboard/events/${world.eventId}`);
	await expect(page.getByRole("button", { name: "Save presentation", exact: true })).toBeEnabled();
	await openEventSection(page, "Chat");
	const dialog = page.getByRole("tabpanel", { name: "Chat", exact: true });
	await dialog.getByText("Show Twitch chat", { exact: true }).click();
	await expect(dialog.getByRole("switch")).toBeChecked();
	await dialog.getByRole("textbox", { name: /^Hidden accounts/ }).fill("spam_bot");
	await dialog.getByRole("textbox", { name: /^Hidden command prefixes/ }).fill("?");
	await page.getByRole("button", { name: "Save presentation", exact: true }).click();
	await expect(page.getByText("Event saved.", { exact: true })).toBeVisible();

	await page.route("https://static-cdn.jtvnw.net/isolated-event-badge.png", (route) => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVZkAAAAASUVORK5CYII=", "base64") }));
	await page.route("https://cdn.7tv.app/emote/isolated-event/2x.webp", (route) => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVZkAAAAASUVORK5CYII=", "base64") }));
	await page.route("https://static-cdn.jtvnw.net/emoticons/v2/isolated-event-emote/default/dark/2.0", (route) => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVZkAAAAASUVORK5CYII=", "base64") }));
	await page.goto(`${tourWorld.origin}/events/${world.eventId}/present#${"s".repeat(43)}`);
	await expect(page.getByRole("heading", { name: "Babbler Awards", exact: true })).toBeVisible();
});
When("the host opens a nominee and receives signed Twitch reactions", async ({ page, tourWorld }) => {
	await page.keyboard.press("ArrowRight");
	await page.keyboard.press("ArrowRight");
	await page.getByRole("button", { name: "View Lampe raucht ab", exact: true }).click();
	await expect(page.getByText("Waiting for live reactions…", { exact: true })).toBeVisible();
	for (const [login, text] of [
		["viewer", "Great moment peepoHappy"],
		["viewer", "?song"],
		["spam_bot", "spam message"],
	]) {
		const messageId = randomUUID(),
			timestamp = new Date().toISOString(),
			body = JSON.stringify({
				subscription: { type: "channel.chat.message" },
				event: {
					broadcaster_user_id: tourWorld.owner!.creatorId,
					message_id: messageId,
					chatter_user_login: login,
					chatter_user_name: login,
					color: "#abcdef",
					message: {
						text,
						fragments:
							login === "viewer" && !text.startsWith("?")
								? [
										{ type: "text", text },
										{ type: "emote", text: "Kappa", emote: { id: "isolated-event-emote", emote_set_id: "fixture", owner_id: "0", format: ["static"] } },
									]
								: [{ type: "text", text }],
					},
					badges: [{ set_id: "subscriber", id: "1", info: "" }],
				},
			});
		const { createHmac } = await import("node:crypto"),
			signature =
				"sha256=" +
				createHmac("sha256", "isolated-event-webhook-secret")
					.update(messageId + timestamp + body)
					.digest("hex");
		expect((await page.request.post(`${tourWorld.origin}/eventsub`, { data: body, headers: { "Content-Type": "application/json", "Twitch-Eventsub-Message-Id": messageId, "Twitch-Eventsub-Message-Timestamp": timestamp, "Twitch-Eventsub-Message-Signature": signature, "Twitch-Eventsub-Message-Type": "notification" } })).status()).toBe(204);
	}
});
Then("the presenter chat shows badges and emotes while hiding commands and bots", async ({ page }) => {
	const chat = page.getByRole("complementary", { name: "Twitch chat", exact: true });
	await expect(chat.getByText(/Great moment/)).toBeVisible();
	await expect(chat.getByText("?song", { exact: true })).toHaveCount(0);
	await expect(chat.getByText("spam message", { exact: true })).toHaveCount(0);
	for (const name of ["subscriber", "peepoHappy", "Kappa"]) await expect.poll(() => chat.getByRole("img", { name, exact: true }).evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(1);
});

Then("the award editor and presenter can be reviewed in both themes and viewport sizes", async ({ page, tourWorld }) => {
	const eventId = awardWorld(tourWorld).eventId;
	for (const [size, width, height] of [
		["desktop", 1440, 1000],
		["phone", 390, 844],
	] as const) {
		await page.setViewportSize({ width, height });
		for (const theme of ["light", "dark"]) {
			await page.evaluate((theme) => {
				localStorage.setItem("theme", theme);
				document.documentElement.classList.remove("light", "dark");
				document.documentElement.classList.add(theme);
			}, theme);
			await page.goto(`${tourWorld.origin}/dashboard/events/${eventId}`);
			await expect(page.getByRole("button", { name: /^Save (event|presentation)$/ })).toBeEnabled();
			await expect(page.getByRole("button", { name: "Save presentation", exact: true })).toBeEnabled();
			await openEventSection(page, "Presentation");
			await expect(page.getByRole("button", { name: "Add slide", exact: true })).toBeVisible();
			await page.screenshot({ path: test.info().outputPath(`awards-editor-${size}-${theme}.png`), fullPage: true });
			await page.goto(`${tourWorld.origin}/events/${eventId}/present#${"s".repeat(43)}`);
			await expect(page.getByRole("heading", { name: "Babbler Awards", exact: true })).toBeVisible();
			await page.getByRole("button", { name: "Next slide", exact: true }).click();
			await page.getByRole("button", { name: "Next slide", exact: true }).click();
			await expect(page.getByRole("button", { name: "View Lampe raucht ab", exact: true })).toBeVisible();
			await expect(page.getByRole("heading", { name: "Best fail", exact: true }).locator("..")).toHaveCSS("opacity", "1");
			await page.screenshot({ path: test.info().outputPath(`awards-presenter-${size}-${theme}.png`), fullPage: true });
			await page.getByRole("button", { name: "View Lampe raucht ab", exact: true }).click();
			await expect(page.getByRole("button", { name: "Close preview", exact: true })).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(page.getByRole("button", { name: "View Lampe raucht ab", exact: true })).toBeFocused();
			await page.goto(`${tourWorld.origin}/events/${eventId}`);
			await expect(page.getByText(/Voting has ended/)).toBeVisible();
			await expect(page.locator('[aria-current="step"]')).toBeInViewport({ ratio: 1 });
			await page.screenshot({ path: test.info().outputPath(`awards-public-${size}-${theme}.png`), fullPage: true });
		}
	}
});

Then("the public event list explains that no events are available", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/events`);
	await expect(page.getByRole("heading", { name: "No public events right now", exact: true })).toBeVisible();
});
When("the creator lists the event with an active partner grant", async ({ page, tourWorld }) => {
	await tourWorld.fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,reason,starts_at) VALUES($1,'pro_access','partner','Award browser fixture',now()-interval '1 hour')", [tourWorld.owner!.creatorId]);
	await tourWorld.fixture.pool.query("UPDATE award_events SET configuration=jsonb_set(configuration,'{visibility}','\"public\"') WHERE id=$1", [awardWorld(tourWorld).eventId]);
	await page.reload();
});
Then("the public event card opens the award page", async ({ page, tourWorld }) => {
	await expect(page.getByRole("heading", { name: "Babbler Awards", exact: true })).toBeVisible();
	await page.getByRole("main").getByRole("link", { name: "Voting closed", exact: true }).click();
	await expect(page).toHaveURL(`${tourWorld.origin}/events/${awardWorld(tourWorld).eventId}`);
	await expect(page.getByText(/Voting has ended/)).toBeVisible();
});
When("the partner grant is revoked", async ({ tourWorld }) => {
	await tourWorld.fixture.pool.query("UPDATE entitlement_grants SET revoked_at=now() WHERE user_id=$1 AND source='partner'", [tourWorld.owner!.creatorId]);
});

Given("the full Babbler pilot is prepared as an unpublished draft", async ({ page, tourWorld }) => {
	const world = awardWorld(tourWorld),
		{ babblerAwardPilot } = await import("../../support/events/pilot");
	world.configuration = babblerAwardPilot(world.configuration.storageConnectionId!);
	world.categoryId = world.configuration.categories[0].id;
	await tourWorld.fixture.pool.query("UPDATE award_events SET configuration=$2,published_at=null WHERE id=$1", [world.eventId, JSON.stringify(world.configuration)]);
	await page.goto(`${tourWorld.origin}/dashboard/events/${world.eventId}`);
	await expect(page.getByRole("button", { name: /^Save (event|presentation)$/ })).toBeEnabled();
});
When("the creator reviews the pilot categories and publishes the announcement", async ({ page, tourWorld }) => {
	await openEventSection(page, "Categories");
	for (const category of awardWorld(tourWorld).configuration.categories) await expect(page.getByText(category.title, { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Publish event", exact: true }).click();
	await expect(page.getByText("Your event is published.", { exact: true })).toBeVisible();
});
Then("the public event announces the coming nomination period", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/events/${awardWorld(tourWorld).eventId}`);
	await expect(page.getByRole("heading", { name: "Nominations open soon", exact: true })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Babbler Awards", exact: true })).toBeVisible();
});

Given("an award category accepts creator clips with at least two views", async ({ page, tourWorld }) => {
	const configuration = createAwardConfiguration("Babbler Awards", "UTC"),
		now = Date.now(),
		eventId = randomUUID(),
		owner = tourWorld.owner!.creatorId;
	configuration.categories[0].title = "Best fail";
	configuration.categories[0].rules = { minViews: 2 };
	configuration.schedule = { ...configuration.schedule, submissionsStart: new Date(now - 3600000).toISOString(), reviewRequired: false };
	tourWorld.result = { eventId, categoryId: configuration.categories[0].id, configuration };
	await tourWorld.fixture.pool.query("INSERT INTO award_events(id,owner_id,configuration,published_at,presenter_digest) VALUES($1,$2,$3,now(),$4)", [eventId, owner, JSON.stringify(configuration), createHash("sha256").update("s".repeat(43)).digest("hex")]);
	for (const [prefix, title, views] of [
		["Eligible", "Lampe raucht ab", 10],
		["Ineligible", "Unpopular clip", 1],
	] as const) {
		const id = `${prefix}_${eventId}`,
			clip = { id, title, broadcaster_id: owner, broadcaster_name: "Host", creator_name: "ActualClipper", creator_id: "clipper", created_at: new Date(now - 86400000).toISOString(), duration: 30, view_count: views, thumbnail_url: "https://static-cdn.jtvnw.net/isolated-event-clip.jpg", url: `https://clips.twitch.tv/${id}` };
		await tourWorld.fixture.pool.query('INSERT INTO "twitchCache"(type,key,value) VALUES($1,$2,$3)', ["clip", `clip:${owner}:${id}`, JSON.stringify({ clip, lastValidatedAt: new Date().toISOString() })]);
	}
	await page.goto(`${tourWorld.origin}/events/${eventId}`);
});
When("the participant pastes a clip link outside the rules", async ({ page, tourWorld }) => {
	await page.getByRole("combobox", { name: /Choose Best fail/ }).fill(`https://clips.twitch.tv/Ineligible_${awardWorld(tourWorld).eventId}`);
});
Then("the autocomplete explains that the clip is not eligible", async ({ page }) => {
	await expect(page.getByRole("option", { name: "No matching item was found within this category's rules. Try another search or link.", exact: true })).toBeVisible();
});
When("the participant searches and selects the eligible clip link", async ({ page, tourWorld }) => {
	const input = page.getByRole("combobox", { name: /Choose Best fail/ });
	await input.fill("Lampe");
	await expect(page.getByRole("option", { name: /^Lampe raucht ab/ })).toBeVisible();
	await input.fill(`https://clips.twitch.tv/Eligible_${awardWorld(tourWorld).eventId}`);
	await expect(page.getByText("Clipped by ActualClipper", { exact: true })).toBeVisible();
	await page.getByRole("option", { name: /^Lampe raucht ab/ }).click();
	await page.getByRole("button", { name: "Submit proposal", exact: true }).click();
	await expect(page.getByText("Your proposal was submitted.", { exact: true }).first()).toBeVisible();
	const receipts = await tourWorld.fixture.pool.query("SELECT original->>'reference' AS reference FROM award_submissions WHERE event_id=$1 AND withdrawn_at IS NULL", [awardWorld(tourWorld).eventId]);
	expect(receipts.rows.map((row) => row.reference)).toEqual([`Eligible_${awardWorld(tourWorld).eventId}`]);
});
When("the creator adds and arranges a statistic with {int} watched hours", async ({ page, tourWorld }, hours: number) => {
	const world = awardWorld(tourWorld),
		{ defaultAwardSlides } = await import("../../../src/app/lib/eventPresenter");
	world.configuration.slides = defaultAwardSlides(world.configuration.categories);
	await tourWorld.fixture.pool.query("UPDATE award_events SET configuration=$2 WHERE id=$1", [world.eventId, JSON.stringify(world.configuration)]);
	await page.goto(`${tourWorld.origin}/dashboard/events/${world.eventId}`);
	await expect(page.getByRole("button", { name: /^Save (event|presentation)$/ })).toBeEnabled();
	await expect(page.getByRole("button", { name: "Save presentation", exact: true })).toBeEnabled();
	await openEventSection(page, "Presentation");
	await page.getByRole("button", { name: "Add slide", exact: true }).click();
	await page.getByRole("menuitem", { name: "Add statistics slide", exact: true }).click();
	await page.getByRole("textbox", { name: "Slide title", exact: true }).fill("Your year in numbers");
	await page.getByRole("button", { name: "Add statistic", exact: true }).click();
	await page.getByRole("textbox", { name: "Statistic 1 label", exact: true }).fill("Watched hours");
	await page.getByRole("textbox", { name: "Statistic 1 value", exact: true }).fill(String(hours));
	await page.getByRole("button", { name: "Move slide 3 up", exact: true }).click();
	await page.getByRole("button", { name: "Save presentation", exact: true }).click();
	await expect(page.getByText("Event saved.", { exact: true })).toBeVisible();
});
Then("the presenter shows the saved statistics before the category", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/events/${awardWorld(tourWorld).eventId}/present#${"s".repeat(43)}`);
	await expect(page.getByRole("heading", { name: "Babbler Awards", exact: true })).toBeVisible();
	await page.keyboard.press("ArrowRight");
	await expect(page.getByRole("heading", { name: "Your year in numbers", exact: true })).toBeVisible();
	await page.keyboard.press("ArrowRight");
	await expect(page.getByText("Watched hours", { exact: true })).toBeVisible();
	await expect(page.getByText("321", { exact: true })).toBeVisible();
	await page.keyboard.press("ArrowRight");
	await expect(page.getByRole("heading", { name: "Best fail", exact: true })).toBeVisible();
});

Then("a failed image can be retried inside the same preview", async ({ page }) => {
	const dialog = page.getByRole("dialog", { name: "Lampe", exact: true });
	await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
	let fail = true;
	await page.route(/\/api\/events\/[^/]+\/media\//, (route) => (fail ? route.fulfill({ status: 503, body: "Unavailable" }) : route.continue()));
	await page.reload();
	await page.getByRole("button", { name: "View Lampe", exact: true }).click();
	await expect(dialog.getByRole("status")).toHaveText(/This media could not load/);
	fail = false;
	await dialog.getByRole("button", { name: "Retry media", exact: true }).click();
	await expect.poll(() => dialog.getByRole("img", { name: "Lampe", exact: true }).evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(1);
	await expect(dialog).toBeVisible();
});
