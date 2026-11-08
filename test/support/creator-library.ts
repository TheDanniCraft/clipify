import type { Page, APIRequestContext } from "@playwright/test";
import type { TourWorld } from "../bdd/support/user-tour";
import { defaultProgress, guideContentKey } from "../../src/app/lib/userTour";
import { expect } from "@playwright/test";
export async function seedCreatorLibrary({ page, request, tourWorld }: { page: Page; request: APIRequestContext; tourWorld: TourWorld }) {
	const response = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { withProviderCredentials: true, withPlaylist: true, billingState: "active" } });
	expect(response.status()).toBe(200);
	const owner = await response.json();
	tourWorld.owner = owner.fixture;
	await page.context().addCookies([owner.cookie]);
	const creatorId = tourWorld.owner!.creatorId;
	const id = `RunnerPresentation_${creatorId.slice("e2e-creator-".length)}`;
	const clip = { id, title: "Last night's clutch", broadcaster_id: creatorId, broadcaster_name: "Browser creator", creator_id: "maker", creator_name: "Clip maker", view_count: 42, duration: 12, created_at: "2026-11-02T12:00:00Z", thumbnail_url: "https://static-cdn.jtvnw.net/clip-library-fixture.png", game_id: "123", video_id: "12345", vod_offset: 10, language: "en", url: `https://clips.twitch.tv/${id}`, embed_url: `https://clips.twitch.tv/embed?clip=${id}`, is_featured: false };
	await tourWorld.fixture.pool.query('INSERT INTO "twitchCache" (type,key,value) VALUES ($1,$2,$3)', ["clip", `clip:${creatorId}:${id}`, JSON.stringify({ clip, lastValidatedAt: new Date().toISOString() })]);
	await tourWorld.fixture.pool.query('INSERT INTO "twitchCache" (type,key,value) VALUES ($1,$2,$3)', ["game", "123", JSON.stringify({ id: "123", name: "Strategy" })]);
	await tourWorld.fixture.pool.query("INSERT INTO playlist_clips (playlist_id,clip_id,position,clip_data) VALUES ($1,$2,0,$3)", [tourWorld.owner!.playlistId, id, JSON.stringify(clip)]);
	await tourWorld.fixture.pool.query("INSERT INTO user_content_states (user_id,content_key,state) VALUES ($1,$2,$3)", [creatorId, guideContentKey, JSON.stringify({ ...defaultProgress(), welcomeSeen: true })]);
	await page.route("https://static-cdn.jtvnw.net/clip-library-fixture.png", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#28203b"/><circle cx="160" cy="90" r="40" fill="#8b5cf6"/><path d="M150 65v50l35-25z" fill="white"/></svg>' }));
	return { creatorId, id, authUserId: owner.fixture.authUserId as string };
}
