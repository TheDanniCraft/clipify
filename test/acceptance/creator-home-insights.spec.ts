import { writeFile } from "node:fs/promises";
import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { createEmptyCreatorAnalytics } from "../../src/app/lib/plausibleCreatorAnalytics";
import { guideContentKey } from "../../src/app/lib/userTour";
for (const plan of ["free", "pro"])
	for (const width of [390, 1440])
		for (const theme of ["light", "dark"])
			test(`Inactive creator Home with ${plan} insights at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
				test.setTimeout(120000);
				await page.setViewportSize({ width, height: 1000 });
				await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
				const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
				const pool = tourWorld.fixture.pool;
				await pool.query("UPDATE users SET plan=$1, created_at='2020-01-01' WHERE id=$2", [plan, creatorId]);
				await pool.query(`UPDATE "twitchCache" SET value=jsonb_set(value::jsonb,'{clip,created_at}','"2020-01-01T00:00:00Z"')::text WHERE key=$1`, [`clip:${creatorId}:${id}`]);
				const stored = JSON.parse((await pool.query('SELECT value FROM "twitchCache" WHERE key=$1', [`clip:${creatorId}:${id}`])).rows[0].value);
				for (let index = 1; index <= 4; index++) {
					const clipId = `LibrarySort${String(index).padStart(2, "0")}_${creatorId.slice("e2e-creator-".length)}`;
					await pool.query('INSERT INTO "twitchCache"(type,key,value) VALUES($1,$2,$3)', ["clip", `clip:${creatorId}:${clipId}`, JSON.stringify({ ...stored, clip: { ...stored.clip, id: clipId, title: `Earlier highlight ${index}`, view_count: 42 + index } })]);
				}
				await pool.query('INSERT INTO "twitchCache"(type,key,value) VALUES($1,$2,$3)', ["user", `broadcasts:${creatorId}:first`, JSON.stringify({ data: [], fetchedAt: new Date().toISOString() })]);
				await pool.query("UPDATE user_content_states SET state=jsonb_set(state::jsonb,'{minimized}','true')::text WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey]);
				const username = (await pool.query("SELECT username FROM users WHERE id=$1", [creatorId])).rows[0].username;
				const end = new Date().toISOString().slice(0, 10),
					start = new Date(Date.parse(end) - 29 * 86400000).toISOString().slice(0, 10);
				const analytics = createEmptyCreatorAnalytics(start, end);
				analytics.metrics = { ...analytics.metrics, visitors: 12, pageviews: 30, visits: 15, clipPlays: 8 };
				await pool.query("INSERT INTO plausible_stats_cache(owner_id,cache_key,value,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')", [creatorId, `umami-v2::127.0.0.1:${username}:${start}:${end}`, JSON.stringify(analytics)]);
				await page.goto(`${tourWorld.origin}/dashboard`);
				const consent = page.getByRole("button", { name: "Reject optional", exact: true });
				await Promise.all([page.waitForEvent("load"), consent.click()]);
				await expect(consent).not.toBeVisible();
				await expect(page.getByText("No clips from the last 30 days", { exact: true })).toBeVisible();
				await expect(page.getByText("No available broadcasts. Twitch may remove older broadcasts.", { exact: true })).toBeVisible();
				const shortcuts = page.getByRole("navigation", { name: "Quick access", exact: true });
				for (const name of ["Overlays", "Playlists", "Galleries", "Runner", "Clip Inventory"]) {
					const link = shortcuts.getByRole("link", { name, exact: true });
					await expect(link).toHaveClass(/button--secondary/);
					await expect(link.locator("svg")).toBeVisible();
				}
				await expect(page.getByRole("grid", { name: "Top clips" }).getByRole("button", { name: "Last night's clutch", exact: true })).toBeVisible();
				const insights = page.getByLabel("Creator Page insights", { exact: true });
				if (plan === "pro") {
					await expect(insights.getByRole("status", { name: "Creator Page visitors" })).toHaveText("12");
					await expect(insights.getByRole("status", { name: "Creator Page clip plays" })).toHaveText("8");
					await expect(insights.getByRole("link", { name: "Unlock with Pro" })).toHaveCount(0);
				} else await expect(insights.getByRole("link", { name: "Unlock with Pro" })).toBeVisible();
				await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
				await page.screenshot({ path: info.outputPath("home.png"), fullPage: true, animations: "disabled" });
				await shortcuts.locator("..").screenshot({ path: info.outputPath("home-cards.png"), animations: "disabled" });
				const actions = await Promise.all(
					["Browse clip inventory", "View all streams", "View all clips", ...(plan === "pro" ? ["Manage Creator Page"] : [])].map((name) =>
						page.getByRole("link", { name, exact: true }).evaluate((element) => {
							const style = getComputedStyle(element);
							return { font: style.fontSize, weight: style.fontWeight, decoration: style.textDecorationLine };
						}),
					),
				);
				const performance = page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name: "Clip performance", exact: true }) });
				const regions = { target: await shortcuts.locator("..").boundingBox(), performance: await performance.boundingBox(), insights: await insights.boundingBox(), action: await page.getByRole("link", { name: "View all clips", exact: true }).boundingBox(), header: await insights.locator('[data-slot="card-header"]').boundingBox(), metrics: plan === "pro" ? await insights.locator("dl").boundingBox() : null };
				await writeFile(info.outputPath("home-regions.json"), JSON.stringify({ regions, actions }));
				for (const action of actions) {
					expect(action.font).toBe(actions[0].font);
					expect(action.weight).toBe(actions[0].weight);
					expect(action.decoration).toContain("underline");
				}
				await expect(page.getByText(/Library synchronized|Dates use|older clips may still be syncing/)).toHaveCount(0);
				const emptySize = await page.getByText("No clips from the last 30 days", { exact: true }).evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
				const descriptionSize = await performance.locator('[data-slot="card-description"]').evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
				expect(emptySize).toBeLessThanOrEqual(descriptionSize);
				if (plan === "pro") {
					expect(regions.metrics!.y - regions.header!.y - regions.header!.height).toBeLessThanOrEqual(20);
					if (width >= 1024) expect(regions.insights!.height).toBeLessThan((await page.getByRole("region", { name: "Top clips", exact: true }).boundingBox())!.height);
				}
				if (plan === "free" && width === 390 && theme === "dark") {
					const upgrade = insights.getByRole("link", { name: "Unlock with Pro" });
					await upgrade.focus();
					await page.keyboard.press("Enter");
					await expect(page).toHaveURL(/upgrade=1.*feature=creator_analytics/);
					await expect(page.getByRole("dialog")).toBeVisible();
				}
			});
