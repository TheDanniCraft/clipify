import { randomUUID, createHash } from "node:crypto";
import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { createAwardConfiguration } from "../../src/app/lib/eventDefaults";

for (const type of ["poll", "prediction"] as const) {
	test(`Presenter waits for Twitch ${type} and recovers its saved state`, { tag: "@event-twitch-interactions" }, async ({ page, request, tourWorld }, info) => {
		const failures: string[] = [];
		page.on("response", async (response) => {
			if (response.request().method() === "POST" && response.url().includes("/events/")) {
				const text = await response.text().catch(() => "");
				const code = text.match(/"code":"([A-Z_]+)"/);
				if (code) failures.push(code[1]);
			}
		});
		const { creatorId, authUserId } = await seedCreatorLibrary({ page, request, tourWorld });
		await tourWorld.fixture.pool.query("UPDATE auth.account SET scope=scope || ' channel:manage:polls channel:manage:predictions' WHERE provider_id='twitch' AND account_id=$1", [creatorId]);
		const eventId = randomUUID(),
			slideId = randomUUID(),
			secret = "s".repeat(43),
			configuration = createAwardConfiguration("Community show", "UTC");
		const category = configuration.categories[0];
		category.source = "text";
		category.title = "Best quote";
		configuration.schedule = { ...configuration.schedule, submissionsStart: new Date(Date.now() - 7200000).toISOString(), submissionsEnd: new Date(Date.now() - 6000000).toISOString(), votingStart: new Date(Date.now() - 3600000).toISOString(), votingEnd: new Date(Date.now() - 1000).toISOString() };
		configuration.slides = [{ id: slideId, type: "category", categoryId: category.id, title: "", text: "", statistics: [], interaction: { type, wait: true, duration: 15 } }];
		await tourWorld.fixture.pool.query("INSERT INTO award_events(id,owner_id,configuration,published_at,presenter_digest,review_released) VALUES($1,$2,$3,now(),$4,true)", [eventId, creatorId, JSON.stringify(configuration), createHash("sha256").update(secret).digest("hex")]);
		const ids = [randomUUID(), randomUUID()];
		for (const [i, id] of ids.entries()) await tourWorld.fixture.pool.query("INSERT INTO award_candidates(id,event_id,category_id,canonical_key,content,nominated) VALUES($1,$2,$3,$4,$5,true)", [id, eventId, category.id, `text:${i}`, JSON.stringify({ kind: "text", title: `Quote ${i + 1}`, description: "A readable community quote", reference: "" })]);
		await tourWorld.fixture.pool.query("INSERT INTO award_votes(event_id,category_id,candidate_id,auth_user_id) VALUES($1,$2,$3,$4)", [eventId, category.id, ids[1], authUserId]);
		await page.goto(`${tourWorld.origin}/events/${eventId}/present#${secret}`);
		const reject = page.getByRole("button", { name: "Reject optional", exact: true });
		if (await reject.isVisible()) await Promise.all([page.waitForEvent("load"), reject.click()]);
		const next = page.getByRole("button", { name: "Next slide", exact: true });
		for (let i = 0; i < 3; i++) {
			await expect(next).toBeEnabled();
			await next.click();
		}
		await expect(next).toBeDisabled();
		const read = async () => (await tourWorld.fixture.pool.query("SELECT twitch_interactions FROM award_events WHERE id=$1", [eventId])).rows[0].twitch_interactions[slideId];
		await expect.poll(async () => ({ status: (await read())?.status, failures }), {}).toEqual({ status: "ACTIVE", failures: [] });
		const remoteId = (await read()).id;
		await page.keyboard.press("ArrowRight");
		await expect(next).toBeDisabled();
		await expect.poll(async () => (await page.getByRole("heading", { name: "Best quote", exact: true }).boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
		await page.screenshot({ path: info.outputPath(`${type}-waiting.png`) });
		await expect(next).toBeEnabled({ timeout: 20000 });
		await page.reload();
		for (let i = 0; i < 3; i++) {
			await expect(next).toBeEnabled();
			await next.click();
		}
		await expect(next).toBeEnabled();
		expect((await read()).id).toBe(remoteId);
		await next.click(); // Only one nominee received votes: announce the winner, then reveal on Next.
		await expect(page.locator("[data-award-podium-cue]")).toHaveText("And the award goes to…");
		expect((await read()).status).toBe(type === "prediction" ? "LOCKED" : "COMPLETED");
		await next.click();
		await expect.poll(async () => (await read())?.status).toBe(type === "prediction" ? "RESOLVED" : "COMPLETED");
		await expect(page.getByRole("heading", { name: "First place", exact: true })).toBeVisible();
	});
}
