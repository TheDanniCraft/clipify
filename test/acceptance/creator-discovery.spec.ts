import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";

for (const theme of ["light", "dark"]) {
	for (const width of [390, 1440]) {
		test(`discoverable creators are linked without an overlay and Unicode routes respect visibility at ${width}px in ${theme}`, async ({ page, request }, info) => {
			const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
			const id = randomUUID();
			const username = `家姐_${id.slice(0, 8)}`;
			const path = `/creators/${encodeURIComponent(username)}`;
			try {
				await pool.query("INSERT INTO users(id,username,email,avatar,role,plan) VALUES($1,$2,$3,'/logo.webp','user','free')", [id, username, `${id}@example.invalid`]);
				await pool.query("INSERT INTO \"userSettings\"(id,creator_page_enabled,creator_page_visibility,show_in_community) VALUES($1,true,'discoverable',true)", [id]);
				await pool.query('DELETE FROM "twitchCache" WHERE key=$1', ["community:snapshot:obs-presence"]);
				await page.setViewportSize({ width, height: 900 });
				await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
				await page.goto("/community");
				const reject = page.getByRole("button", { name: "Reject optional", exact: true });
				await reject.waitFor();
				await Promise.all([page.waitForEvent("load"), reject.click()]);
				const profile = page.getByRole("link", { name: username, exact: true });
				await expect(profile).toHaveAttribute("href", path);
				await profile.scrollIntoViewIfNeeded();
				await page.screenshot({ path: info.outputPath("community-profile-link.png"), fullPage: true });
				await profile.focus();
				await profile.press("Enter");
				await expect(page.getByRole("heading", { level: 1, name: username, exact: true })).toBeVisible();
				expect((await request.get(path)).status()).toBe(200);
				await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://clipify.us${path}`);
				expect(await (await request.get("/sitemap.xml")).text()).toContain(path);
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
				await page.screenshot({ path: info.outputPath("unicode-profile.png"), fullPage: true });

				await pool.query("UPDATE \"userSettings\" SET creator_page_visibility='unlisted' WHERE id=$1", [id]);
				await page.goto("/community");
				await expect(page.getByRole("link", { name: username, exact: true })).toHaveCount(0);
				expect(await (await request.get("/sitemap.xml")).text()).not.toContain(path);
				await page.goto(path);
				await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");

				await pool.query("UPDATE \"userSettings\" SET creator_page_visibility='discoverable',creator_page_enabled=false WHERE id=$1", [id]);
				await page.goto("/community");
				await expect(page.getByRole("link", { name: username, exact: true })).toHaveCount(0);
				expect((await request.get(path)).status()).toBe(404);

				await pool.query('UPDATE "userSettings" SET creator_page_enabled=true WHERE id=$1', [id]);
				await pool.query("UPDATE users SET disabled=true WHERE id=$1", [id]);
				await page.goto("/community");
				await expect(page.getByRole("link", { name: username, exact: true })).toHaveCount(0);
				expect((await request.get(path)).status()).toBe(404);
				expect(await (await request.get("/sitemap.xml")).text()).not.toContain(path);
			} finally {
				await pool.query("DELETE FROM users WHERE id=$1", [id]);
				await pool.query('DELETE FROM "twitchCache" WHERE key=$1', ["community:snapshot:obs-presence"]);
				await pool.end();
			}
		});
	}
}
