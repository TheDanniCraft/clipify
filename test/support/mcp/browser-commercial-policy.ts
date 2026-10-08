import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { OverlayType, StatusOptions } from "@types";

/** Public browser actions retain native session verification and shared backend policy. */
export async function observeBrowserCommercialPolicy(input: { pool: Pool; headers: Headers; overlayId: string; playlistId: string; mode: string }) {
	const { pool, headers, overlayId } = input;
	const mode = input.mode.replace("commercial:", "");
	const { RequestCookies } = createRequire(process.cwd() + "/package.json")("next/dist/compiled/@edge-runtime/cookies");
	const storage = new AsyncLocalStorage<{ headers: Headers; cookies: unknown }>();
	Reflect.set(globalThis, Symbol.for("next-ws.request-store"), storage);
	const actions = await import("@/app/actions/database");
	const snapshot = async (targetOverlay = overlayId, targetPlaylist = input.playlistId) =>
		JSON.stringify((await pool.query("SELECT id,name,status,theme_accent_color,configuration_revision FROM overlays WHERE id=$1", [targetOverlay])).rows) + JSON.stringify((await pool.query("SELECT id,name,configuration_revision FROM playlists WHERE id=$1", [targetPlaylist])).rows) + JSON.stringify((await pool.query("SELECT clip_id,position,clip_data FROM playlist_clips WHERE playlist_id=$1 ORDER BY position", [targetPlaylist])).rows);
	if (mode.startsWith("create-")) {
		const source = mode.slice("create-".length);
		await pool.query(
			"INSERT INTO auth.organization(id,name,slug,created_at) VALUES('personal-org','Personal creator','personal-org',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('personal-creator','personal@example.invalid','Personal','','user','free'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('personal-creator','personal-org','active'); INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES('personal-owner','personal-org','owner','owner',now()); INSERT INTO creator_identity_links(creator_id,auth_user_id,source) VALUES('personal-creator','owner','twitch_onboarding')",
		);
		if (source === "subscription") await pool.query("UPDATE users SET plan='pro' WHERE id='creator'");
		else if (source === "trial" || source === "grant") await pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at,ends_at) VALUES('creator','pro_access',$1,now()-interval '1 day',now()+interval '1 day')", [source === "trial" ? "reverse_trial" : "partner"]);
		else if (source === "allocation") await (await import("./seed-pro-allocation")).seedCreatorProAllocation(pool, "creator", "creator-org", "owner");
		else throw new Error("Invalid browser entitlement source");
		const result = await storage.run({ headers, cookies: new RequestCookies(headers) }, () => actions.createOverlayWithFeedback("creator"));
		return { created: Boolean(result.overlay), error: result.error, resources: Number((await pool.query("SELECT count(*) FROM overlays WHERE owner_id='creator'")).rows[0].count), actorPersonalPlan: (await pool.query("SELECT plan FROM users WHERE id='personal-creator'")).rows[0].plan };
	}
	if (mode.startsWith("paid-")) {
		const before = await snapshot();
		const patch = mode === "paid-volume" ? { playerVolume: 70 } : mode === "paid-filter" ? { minClipViews: 100 } : { themeAccentColor: "#123456" };
		const saved = await storage.run({ headers, cookies: new RequestCookies(headers) }, () => actions.saveOverlay(overlayId, patch, 1));
		return { saved: Boolean(saved), unchanged: before === (await snapshot()) };
	}
	const retainedOverlay = randomUUID(),
		retainedPlaylist = randomUUID();
	await pool.query("UPDATE overlays SET created_at=now()-interval '2 days'; UPDATE playlists SET created_at=now()-interval '2 days'");
	await pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type,theme_accent_color,created_at) VALUES($1,'creator','isolated-retained-secret','Retained browser overlay','paused','Featured','#123456',now()-interval '1 day')", [retainedOverlay]);
	await pool.query("INSERT INTO playlists(id,owner_id,name,created_at) VALUES($1,'creator','Retained browser playlist',now()-interval '1 day')", [retainedPlaylist]);
	await pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) VALUES($1,'RetainedClip',0,$2)", [retainedPlaylist, JSON.stringify({ id: "RetainedClip", title: "Saved retained clip", duration: 12 })]);
	const before = await snapshot(retainedOverlay, retainedPlaylist);
	const observed = await storage.run({ headers, cookies: new RequestCookies(headers) }, async () => {
		if (mode === "overlay-read") {
			const record = await actions.getOverlay(retainedOverlay);
			return { available: Boolean(record), savedAccent: record?.themeAccentColor ?? null };
		}
		if (mode === "overlay-update") return { saved: Boolean(await actions.saveOverlay(retainedOverlay, { name: "Attempt retained edit" }, 1)) };
		if (mode === "overlay-run") {
			const saved = await actions.saveOverlay(retainedOverlay, { status: StatusOptions.Active }, 1);
			const runtime = await (await import("@/server/overlays")).getOverlayRuntimeAccessInternal(retainedOverlay, "http");
			return { saved: Boolean(saved), runtimeAllowed: runtime.allowed };
		}
		if (mode === "playlist-read") {
			const clips = await actions.getPlaylistClips(retainedPlaylist);
			return { clipIds: clips.map((clip) => clip.id) };
		}
		if (mode === "playlist-update") return { saved: Boolean(await actions.savePlaylist(retainedPlaylist, { name: "Attempt retained edit" }, 1)) };
		if (mode === "playlist-run") {
			const saved = await actions.saveOverlay(overlayId, { type: OverlayType.Playlist, playlistId: retainedPlaylist }, 1);
			const runtime = await (await import("@/server/overlays")).getOverlayRuntimeAccessInternal(overlayId, "http");
			const clips = await actions.getPlaylistRuntimeClipsForOwnerServer("creator", retainedPlaylist);
			return { saved: Boolean(saved), runtimeClips: clips.length, effectivePlaylistId: runtime.allowed ? runtime.overlay.playlistId : null, storedRetainedSelection: (await pool.query("SELECT playlist_id FROM overlays WHERE id=$1", [overlayId])).rows[0].playlist_id === retainedPlaylist };
		}
		throw new Error("Invalid browser commercial operation");
	});
	return { ...observed, unchanged: before === (await snapshot(retainedOverlay, retainedPlaylist)) };
}
