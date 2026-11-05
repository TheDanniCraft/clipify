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
				await consent.click();
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
				if (plan === "free" && width === 390 && theme === "dark") {
					const upgrade = insights.getByRole("link", { name: "Unlock with Pro" });
					await upgrade.focus();
					await page.keyboard.press("Enter");
					await expect(page).toHaveURL(/upgrade=1.*feature=creator_analytics/);
					await expect(page.getByRole("dialog")).toBeVisible();
				}
			});
