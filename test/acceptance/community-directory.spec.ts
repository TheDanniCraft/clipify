import { test, expect } from "../bdd/support/user-tour";
import { source as axeSource } from "axe-core";
import { writeFile } from "node:fs/promises";
import type { CommunityStreamer } from "@lib/community-types";

for (const theme of ["light", "dark"])
	for (const width of [390, 1440]) {
		test.describe(`${width}px in ${theme}`, () => {
			test.use({ hasTouch: width === 390 });
			test(`Browse the public creator directory at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
				test.setTimeout(120000);
				await page.setViewportSize({ width, height: 960 });
				await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
				const streamers: (Omit<CommunityStreamer, "plan"> & { plan: "free" | "pro" })[] = [];
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
					if (username === "directory_live") {
						await tourWorld.fixture.pool.query("DELETE FROM \"twitchCache\" WHERE type='clip' AND starts_with(key,$1)", [`clip:${fixture.creatorId}:`]);
						for (const id of ["preview-one", "preview-two"]) await tourWorld.fixture.pool.query("INSERT INTO \"twitchCache\"(type,key,value) VALUES('clip',$1,$2)", [`clip:${fixture.creatorId}:${id}`, JSON.stringify({ id, broadcaster_id: fixture.creatorId, created_at: new Date().toISOString() })]);
					}
					streamers.push({ id: fixture.creatorId, username, displayName, avatar: `/community-avatar-${username}.svg`, plan, partner, status, profileUrl: `/creators/${username}`, viewCount: 0, lastActiveAt: null });
				}
				await tourWorld.fixture.pool.query('INSERT INTO "twitchCache"(type,key,value,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(type,key) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at', ["user", "community:snapshot:obs-presence", JSON.stringify({ streamers, totalCount: 4, liveCount: 1, overlayActiveCount: 0, updatedAt: new Date().toISOString() }), new Date(Date.now() + 3600000)]);
				await page.route("**/community-avatar-*.svg", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="80" fill="#777"/><circle cx="80" cy="61" r="26" fill="#ddd"/><path d="M28 150a52 52 0 0 1 104 0" fill="#ddd"/></svg>' }));
				let previewRequests = 0;
				page.on("request", (request) => {
					if (request.method() === "POST" && request.headers()["next-action"] && streamers.some((creator) => request.postData()?.includes(JSON.stringify(creator.id)))) previewRequests++;
				});
				await page.goto(`${tourWorld.origin}/community`);
				await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
				await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find your next favorite creator.");
				await page.screenshot({ animations: "disabled", path: info.outputPath(`community-${width}-${theme}.png`), fullPage: true });
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
				await expect(page.getByRole("tablist")).toHaveCount(0);
				const avatars = page.getByRole("list", { name: "Creators", exact: true }).getByRole("button", { name: / creator$/ });
				await expect(avatars).toHaveCount(3);
				expect(previewRequests).toBe(0);
				await expect(page.getByText("Private creator", { exact: true })).toHaveCount(0);
				await expect(page.getByText("@directory_live", { exact: true })).toHaveCount(0);
				const liveAvatar = page.getByRole("button", { name: "Live creator creator", exact: true });
				if (width === 390) await liveAvatar.tap();
				else await liveAvatar.click();
				const liveProfile = page.getByRole("dialog", { name: "Live creator profile", exact: true });
				await expect(liveProfile).toBeVisible();
				await expect(liveProfile.getByText("2 clips on Clipify", { exact: true })).toBeVisible();
				expect(previewRequests).toBe(1);
				await expect(liveProfile.getByRole("link", { name: /Creator Page/ })).toHaveAttribute("href", "/creators/directory_live");
				await page.addScriptTag({ content: axeSource });
				expect(await page.evaluate(async () => (await (window as typeof window & { axe: typeof import("axe-core") }).axe.run(document.querySelector('[role="dialog"]')!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.map(({ id }) => id))).toEqual([]);
				const profileBounds = await liveProfile.boundingBox();
				expect(profileBounds!.x).toBeGreaterThanOrEqual(0);
				expect(profileBounds!.x + profileBounds!.width).toBeLessThanOrEqual(width);
				await liveProfile.screenshot({ animations: "disabled", path: info.outputPath(`creator-popover-${width}-${theme}.png`) });
				await page.keyboard.press("Escape");
				await expect(liveProfile).toHaveCount(0);
				await expect(liveAvatar).toBeFocused();
				await expect(avatars).toHaveCount(3);
				if (width === 1440) {
					await page.mouse.move(0, 0);
					await liveAvatar.hover();
					await expect(liveProfile).toBeVisible();
					await expect(liveAvatar).toBeFocused();
					await liveProfile.getByRole("link", { name: /Creator Page/ }).hover();
					await expect(liveProfile).toBeVisible();
				}
				await liveAvatar.click();
				await expect(liveProfile).toBeVisible();
				await expect(liveProfile).toBeFocused();
				await expect(liveProfile.getByRole("link", { name: "Open Twitch", exact: true })).toHaveAttribute("href", "https://twitch.tv/directory_live");
				await page.keyboard.press("Escape");
				await expect(liveProfile).toHaveCount(0);
				await search.fill("no such creator");
				await expect(page.getByText("No creators found", { exact: true })).toBeVisible();
				await page.getByRole("button", { name: "Show all creators", exact: true }).click();
				await expect(search).toBeFocused();
				await expect(avatars).toHaveCount(3);
				await search.fill("DIRECTORY_FREE");
				await expect(avatars).toHaveCount(1);
				let failStats = true;
				await page.route("**/community", (route) => {
					if (failStats && route.request().method() === "POST" && route.request().headers()["next-action"]) {
						failStats = false;
						return route.abort("failed");
					}
					return route.continue();
				});
				await page.getByRole("button", { name: "Free creator creator", exact: true }).click();
				const freeProfile = page.getByRole("dialog", { name: "Free creator profile", exact: true });
				await expect(freeProfile.getByText("Clip count unavailable", { exact: true })).toBeVisible();
				await freeProfile.getByRole("button", { name: "Retry", exact: true }).click();
				await expect(freeProfile.getByText("0 clips on Clipify", { exact: true })).toBeVisible();
				await expect(freeProfile.getByRole("link", { name: "Open Twitch", exact: true })).toHaveCount(0);
				await page.keyboard.press("Escape");
				await expect(freeProfile).toHaveCount(0);
				await search.fill("");
				// A directory-sized fixture catches layouts that only work with a few cards.
				const additional = Array.from({ length: 167 }, (_, index) => {
					const username = `directory_dense_${String(index).padStart(3, "0")}`;
					return { id: username, username, displayName: index === 0 ? "A creator with a particularly long display name" : `Creator ${String(index).padStart(3, "0")}`, avatar: "/community-avatar-directory_free.svg", plan: "free", partner: false, status: "offline", profileUrl: `/creators/${username}`, viewCount: 0, lastActiveAt: null };
				});
				await tourWorld.fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) SELECT id,id || '@example.test',id,'/community-avatar-directory_free.svg','user','free' FROM unnest($1::text[]) AS id", [additional.map((creator) => creator.id)]);
				await tourWorld.fixture.pool.query("INSERT INTO \"userSettings\"(id,creator_page_enabled,creator_page_visibility) SELECT id,true,'discoverable' FROM unnest($1::text[]) AS id", [additional.map((creator) => creator.id)]);
				await tourWorld.fixture.pool.query('UPDATE "twitchCache" SET value=$1 WHERE type=$2 AND key=$3', [JSON.stringify({ streamers: [...streamers, ...additional], totalCount: 171, liveCount: 1, overlayActiveCount: 0, updatedAt: new Date().toISOString() }), "user", "community:snapshot:obs-presence"]);
				await page.reload();
				await expect(avatars).toHaveCount(170);
				await page.getByRole("list", { name: "Creators", exact: true }).screenshot({ animations: "disabled", path: info.outputPath(`community-dense-${width}-${theme}.png`) });
				const layout = await page.getByRole("list", { name: "Creators", exact: true }).evaluate((list) => ({
					columns: getComputedStyle(list).gridTemplateColumns.split(" ").length,
					firstHeight: list.querySelector("button")!.getBoundingClientRect().height,
					avatarWidth: list.querySelector('[role="img"]')!.getBoundingClientRect().width,
					ringWidth: getComputedStyle(list.querySelector('[role="img"]')!).boxShadow,
					totalHeight: list.getBoundingClientRect().height,
				}));
				await writeFile(info.outputPath("community-density.json"), JSON.stringify(layout));
				expect(layout.columns).toBeGreaterThanOrEqual(width === 1440 ? 20 : 6);
				expect(layout.firstHeight).toBeGreaterThanOrEqual(44);
				expect(layout.avatarWidth).toBe(32);
				expect(layout.ringWidth).not.toBe("none");
				expect(layout.totalHeight).toBeLessThan(width === 1440 ? 600 : 1800);
				await avatars.first().click();
				const denseProfile = page.getByRole("dialog", { name: "Live creator profile", exact: true });
				await expect(denseProfile.getByText("2 clips on Clipify", { exact: true })).toBeVisible();
				const gridBounds = await page.getByRole("list", { name: "Creators", exact: true }).boundingBox();
				const cardBounds = await denseProfile.boundingBox();
				await writeFile(info.outputPath("community-profile-region.json"), JSON.stringify({ x: cardBounds!.x - gridBounds!.x, y: cardBounds!.y - gridBounds!.y, w: cardBounds!.width, h: cardBounds!.height }));
				await page.getByRole("list", { name: "Creators", exact: true }).screenshot({ animations: "disabled", path: info.outputPath(`community-dense-profile-${width}-${theme}.png`) });
				await page.keyboard.press("Escape");
				await expect(denseProfile).toHaveCount(0);
				await search.fill("directory_dense_166");
				await expect(avatars).toHaveCount(1);
				const finalAvatar = page.getByRole("button", { name: "Creator 166 creator", exact: true });
				await finalAvatar.focus();
				await finalAvatar.press("Enter");
				const finalProfile = page.getByRole("dialog", { name: "Creator 166 profile", exact: true });
				await expect(finalProfile).toBeVisible();
				await expect(finalProfile.getByRole("link", { name: /Creator Page/ })).toHaveAttribute("href", "/creators/directory_dense_166");
				await page.keyboard.press("Escape");
				await expect(finalAvatar).toBeFocused();
				await search.fill("");
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
				await page.addScriptTag({ content: axeSource });
				expect(await page.evaluate(async () => (await (window as typeof window & { axe: typeof import("axe-core") }).axe.run(document.querySelector("main")!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.map(({ id }) => id))).toEqual([]);
				await tourWorld.fixture.pool.query("UPDATE \"userSettings\" SET creator_page_visibility=CASE WHEN id=$1 THEN 'discoverable' ELSE 'unlisted' END", [streamers[0].id]);
				await page.reload();
				await expect(avatars).toHaveCount(1);
				await expect(page.getByRole("tablist")).toHaveCount(0);
				await expect(avatars.first()).toHaveCSS("width", "44px");
				await expect(avatars.first().getByRole("img")).toHaveCSS("width", "32px");
				await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
				await page.screenshot({ animations: "disabled", path: info.outputPath(`community-single-${width}-${theme}.png`), fullPage: true });
				await tourWorld.fixture.pool.query('UPDATE "userSettings" SET creator_page_visibility=$1', ["unlisted"]);
				await page.reload();
				await expect(page.getByText("No public creators yet", { exact: true })).toBeVisible();
				await expect(page.getByRole("searchbox")).toHaveCount(0);
			});
		});
	}
