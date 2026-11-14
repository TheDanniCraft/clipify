import { test, expect } from "../bdd/support/user-tour";
import { source as axeSource } from "axe-core";
import { writeFile } from "node:fs/promises";

for (const theme of ["light", "dark"])
	for (const width of [390, 1440]) {
		test(`Browse the public creator directory at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			test.setTimeout(120000);
			await page.setViewportSize({ width, height: 960 });
			await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
			const streamers = [];
			for (const [username, displayName, plan, partner, status, visibility] of [
				["directory_live", "Live creator", "pro", false, "live", "discoverable"],
				["directory_partner", "Partner creator", "pro", true, "offline", "discoverable"],
				["directory_free", "Free creator", "free", false, "offline", "discoverable"],
				["directory_private", "Private creator", "pro", false, "offline", "unlisted"],
			] as const) {
				const response = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { withProviderCredentials: true } });
				expect(response.status()).toBe(200);
				const { fixture } = await response.json();
				await tourWorld.fixture.pool.query("UPDATE users SET username=$2 WHERE id=$1", [fixture.creatorId, username]);
				await tourWorld.fixture.pool.query('INSERT INTO "userSettings"(id,creator_page_enabled,creator_page_visibility) VALUES($1,true,$2) ON CONFLICT(id) DO UPDATE SET creator_page_enabled=true,creator_page_visibility=excluded.creator_page_visibility', [fixture.creatorId, visibility]);
				streamers.push({ id: fixture.creatorId, username, displayName, avatar: `/community-avatar-${username}.svg`, plan, partner, status, profileUrl: `/creators/${username}`, viewCount: 0, lastActiveAt: null });
			}
			await tourWorld.fixture.pool.query('INSERT INTO "twitchCache"(type,key,value,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(type,key) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at', ["user", "community:snapshot:obs-presence", JSON.stringify({ streamers, totalCount: 4, liveCount: 1, overlayActiveCount: 0, updatedAt: new Date().toISOString() }), new Date(Date.now() + 3600000)]);
			await page.route("**/community-avatar-*.svg", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="80" fill="#777"/><circle cx="80" cy="61" r="26" fill="#ddd"/><path d="M28 150a52 52 0 0 1 104 0" fill="#ddd"/></svg>' }));
			await page.goto(`${tourWorld.origin}/community`);
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find your next favorite creator.");
			await page.screenshot({ path: info.outputPath(`community-${width}-${theme}.png`), fullPage: true });
			const regions = await page.evaluate(() => {
				const measure = (element: Element | null) => {
					if (!element) return undefined;
					const rect = element.getBoundingClientRect();
					return { x: (rect.left / innerWidth) * 100, y: ((rect.top + scrollY) / document.documentElement.scrollHeight) * 100, w: (rect.width / innerWidth) * 100, h: (rect.height / document.documentElement.scrollHeight) * 100 };
				};
				return { intro: measure(document.querySelector("main header") ?? document.querySelector("h1")?.closest("section") ?? null), directory: measure(document.querySelector('[aria-label="Creator directory"]') ?? document.querySelector("section.border-t.border-default")?.parentElement ?? null) };
			});
			await writeFile(info.outputPath("community-regions.json"), JSON.stringify(regions));
			const search = page.getByRole("searchbox", { name: "Search creators", exact: true });
			await expect(search).toBeVisible();
			await expect(page.getByRole("tab", { name: "Partners", exact: true })).toBeInViewport();
			await expect(page.getByRole("article")).toHaveCount(3);
			await expect(page.getByText("Private creator", { exact: true })).toHaveCount(0);
			await expect(page.getByRole("link", { name: "Live creator", exact: true })).toHaveAttribute("href", "/creators/directory_live");
			await page.getByRole("tab", { name: "Now live", exact: true }).click();
			await expect(page.getByRole("article")).toHaveCount(1);
			await expect(page.getByRole("link", { name: "Open Twitch", exact: true })).toHaveAttribute("href", "https://twitch.tv/directory_live");
			const all = page.getByRole("tab", { name: "All creators", exact: true });
			await all.focus();
			await all.press("End");
			await expect(page.getByRole("tab", { name: "Offline", exact: true })).toHaveAttribute("aria-selected", "true");
			await expect(page.getByRole("article")).toHaveCount(2);
			await search.fill("no such creator");
			await expect(page.getByText("No creators found", { exact: true })).toBeVisible();
			await page.getByRole("button", { name: "Reset filters", exact: true }).click();
			await expect(search).toBeFocused();
			await expect(page.getByRole("article")).toHaveCount(3);
			await search.fill("DIRECTORY_FREE");
			await expect(page.getByRole("article")).toHaveCount(1);
			await expect(page.getByRole("link", { name: "Open Twitch", exact: true })).toHaveCount(0);
			await search.fill("");
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			await page.addScriptTag({ content: axeSource });
			expect(await page.evaluate(async () => (await (window as typeof window & { axe: typeof import("axe-core") }).axe.run(document.querySelector("main")!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.map(({ id }) => id))).toEqual([]);
			await tourWorld.fixture.pool.query('UPDATE "userSettings" SET creator_page_visibility=$1', ["unlisted"]);
			await page.reload();
			await expect(page.getByText("No public creators yet", { exact: true })).toBeVisible();
			await expect(page.getByRole("searchbox")).toHaveCount(0);
		});
	}
