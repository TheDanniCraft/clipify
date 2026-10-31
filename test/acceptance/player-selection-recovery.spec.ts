import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";

const headers = { Authorization: "Bearer clipify-playwright-auth-fixture" };

test("overlay recovers failed startup and prefetch requests without a reload or unhandled rejection", async ({ page, request, context }, info) => {
	test.setTimeout(120000);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	let owner: AuthFixture | undefined;
	const errors: string[] = [];
	let selections = 0;
	page.on("pageerror", (error) => errors.push(error.message));
	try {
		owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
		const playlistId = randomUUID();
		const clipId = `RunnerPresentation_${owner.fixture.creatorId.slice("e2e-creator-".length)}`;
		const now = new Date().toISOString();
		const clip = { id: clipId, title: "Playback recovery highlight", duration: 30, broadcaster_id: owner.fixture.creatorId, broadcaster_name: "Fixture streamer", creator_id: "fixture", creator_name: "Fixture creator", game_id: "", view_count: 50, language: "en", thumbnail_url: "https://example.invalid/recovery.png", created_at: now, url: `https://clips.twitch.tv/${clipId}` };
		await pool.query("INSERT INTO playlists(id,owner_id,name) VALUES($1,$2,'Recovery playlist')", [playlistId, owner.fixture.creatorId]);
		await pool.query("UPDATE overlays SET type='Playlist',playlist_id=$2 WHERE id=$1", [owner.fixture.overlayId, playlistId]);
		await pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) VALUES($1,$2,0,$3)", [playlistId, clipId, JSON.stringify(clip)]);
		await pool.query(`INSERT INTO "twitchCache"(type,key,value,expires_at) VALUES('clip',$1,$2,now()+interval '1 hour')`, [`clip:${owner.fixture.creatorId}:${clipId}`, JSON.stringify({ clip, lastValidatedAt: now, lastSeenAt: now })]);
		const manifest = JSON.parse(readFileSync(".next-playwright/server/server-reference-manifest.json", "utf8")) as { node: Record<string, { exportedName?: string }> };
		const actionId = Object.entries(manifest.node).find(([, entry]) => entry.exportedName === "getFirstValidQueuedClip")?.[0];
		expect(actionId).toBeTruthy();
		await page.route("**/overlay/**", (route) => {
			if (route.request().method() === "POST" && route.request().headers()["next-action"] === actionId) {
				selections++;
				if (selections === 1 || selections === 3) return route.abort("failed");
			}
			return route.continue();
		});
		await page.setViewportSize({ width: 1920, height: 1080 });
		await page.goto(`/overlay/${owner.fixture.overlayId}?secret=${owner.fixture.overlaySecret}`);
		const documentStart = await page.evaluate(() => performance.timeOrigin);
		await expect.poll(() => selections).toBe(1);
		await expect(page.locator("video")).toHaveCount(0);
		await expect(page.getByText(clip.title, { exact: true })).toBeVisible({ timeout: 20000 });
		await expect.poll(() => selections).toBeGreaterThanOrEqual(3);
		const first = await page.locator("video").first().elementHandle();
		expect(first).toBeTruthy();
		await expect.poll(() => first!.evaluate((video) => !(video as HTMLVideoElement).paused && (video as HTMLVideoElement).currentTime > 0.2)).toBe(true);
		await page.screenshot({ path: info.outputPath("overlay-recovered-startup.png"), animations: "disabled" });
		await first!.evaluate((element) => {
			const video = element as HTMLVideoElement;
			video.currentTime = video.duration - 0.1;
		});
		await expect.poll(() => first!.evaluate((video) => video.getAttribute("src"))).toBeNull();
		await expect
			.poll(() =>
				page
					.locator("video[src]")
					.first()
					.evaluate((video) => !(video as HTMLVideoElement).paused && (video as HTMLVideoElement).currentTime > 0.2),
			)
			.toBe(true);
		expect(selections).toBeGreaterThanOrEqual(4);
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
		expect(errors).toEqual([]);
	} finally {
		await page.close();
		if (owner) {
			const response = await request.delete("/api/test/auth-fixture", { headers, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
			expect(response.ok()).toBe(true);
		}
		await pool.end();
	}
});
