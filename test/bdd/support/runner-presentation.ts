import { spawn } from "node:child_process";
import { join } from "node:path";
import type { APIRequestContext, BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect } from "./mcp-support";
import { browserDatabaseUrl } from "../../support/mcp/browser-database.cjs";

export const fixtureHeaders = { Authorization: "Bearer clipify-playwright-auth-fixture" };
export type PresentationWorld = {
	owner: { fixture: { authUserId: string; creatorId: string; creatorOrganizationId: string; agencyOrganizationId: string; overlayId: string; playlistId: string }; cookie: Parameters<BrowserContext["addCookies"]>[0][number] };
	runnerId: string;
	token: string;
	sessionId: string;
	generation: string;
	sourceSecret?: string;
	clipId?: string;
	clipTitle?: string;
	nativeResult?: { live: { whitePixels: number; redPixels: number }; fallback: { whitePixels: number; bluePixels: number; attributionWhitePixels: number; attributionVisible: boolean }; returned: { whitePixels: number; redPixels: number }; authenticatedPresentation: boolean; realPlayback: boolean };
	status?: number;
	body?: { url?: string; expiresAt?: number };
};
export const state = (input?: Record<string, unknown>) => input?.runnerPresentation as PresentationWorld;

export async function preparePresentationFixture(request: APIRequestContext, mcpWorld: { input?: Record<string, unknown> }, playable = false, background?: "light" | "dark" | "busy", clipTitle?: string) {
	const response = await request.post("http://127.0.0.1:3107/api/test/auth-fixture", { headers: fixtureHeaders, data: { withProviderCredentials: true, withPlaylist: true } });
	expect(response.status()).toBe(200);
	const owner = (await response.json()) as PresentationWorld["owner"];
	const world: PresentationWorld = { owner, runnerId: randomUUID(), token: randomUUID(), sessionId: randomUUID(), generation: randomUUID() };
	mcpWorld.input = { runnerPresentation: world };
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("UPDATE users SET plan='free' WHERE id=$1", [owner.fixture.creatorId]);
		const source = await pool.query("UPDATE overlays SET type='Playlist',playlist_id=$2 WHERE id=$1 RETURNING secret", [owner.fixture.overlayId, owner.fixture.playlistId]);
		world.sourceSecret = source.rows[0].secret;
		if (playable) {
			world.clipId = `RunnerPresentation_${owner.fixture.creatorId.slice("e2e-creator-".length)}`;
			const now = new Date().toISOString();
			const clip = { id: world.clipId, title: clipTitle ?? (background ? `Runner readability ${background}` : "Controlled Runner clip"), duration: 30, broadcaster_id: owner.fixture.creatorId, broadcaster_name: "Fixture streamer", creator_name: "Fixture creator", game_id: "", view_count: 1, language: "en", thumbnail_url: "https://example.invalid/runner-clip.jpg", created_at: now, url: `https://clips.twitch.tv/${world.clipId}` };
			world.clipTitle = clip.title;
			await pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) VALUES($1,$2,0,$3)", [owner.fixture.playlistId, world.clipId, JSON.stringify(clip)]);
			await pool.query(`INSERT INTO "twitchCache"(type,key,value,expires_at) VALUES('clip',$1,$2,now()+interval '1 hour')`, [`clip:${owner.fixture.creatorId}:${world.clipId}`, JSON.stringify({ clip, lastValidatedAt: now, lastSeenAt: now })]);
		}
		await pool.query("INSERT INTO runners(id,owner_id,name,token,status,protocol_version) VALUES($1,$2,'Presentation Runner',$3,'online',2)", [world.runnerId, owner.fixture.creatorId, world.token]);
		await pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,desired_state,actual_state,rtmp_url) VALUES($1,$2,$3,$4,'24/7','running','running','rtmp://127.0.0.1:1949/live')", [world.sessionId, owner.fixture.creatorId, world.runnerId, owner.fixture.overlayId]);
		await pool.query("INSERT INTO runner_broadcast_admissions(owner_id,runner_id,session_id,execution_generation,state,configuration_revision,started_at,benefits_at_start,lease_expires_at,lease_id,protocol_supports_lease,dispatched_at) VALUES($1,$2,$3,$4,'active',1,now(),$5::jsonb,now()+interval '5 minutes',gen_random_uuid(),true,now())", [
			owner.fixture.creatorId,
			world.runnerId,
			world.sessionId,
			world.generation,
			JSON.stringify({ runnerPro: false, sourceIdAtStart: owner.fixture.overlayId, sourceRevisionAtStart: 1 }),
		]);
	} finally {
		await pool.end();
	}
}

/** One bounded stdin transport for the actual native presentation probe. */
export async function runNativePresentationProbe<T>(world: PresentationWorld, options: Record<string, unknown> = {}): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const child = spawn(process.execPath, [join(process.cwd(), "packages/runner/test/support/fallback-presentation-probe.mjs")], { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, NODE_OPTIONS: "" } });
		let output = "",
			errors = "",
			hardStop: ReturnType<typeof setTimeout> | undefined;
		const timer = setTimeout(() => {
			child.kill("SIGTERM");
			hardStop = setTimeout(() => child.kill("SIGKILL"), 10000);
		}, 90000);
		child.stdout.on("data", (data) => {
			output = (output + String(data)).slice(-65536);
		});
		child.stderr.on("data", (data) => {
			errors = (errors + String(data)).slice(-6000);
		});
		child.on("error", (error) => {
			clearTimeout(timer);
			if (hardStop) clearTimeout(hardStop);
			reject(error);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			if (hardStop) clearTimeout(hardStop);
			if (code !== 0) {
				reject(new Error(`Native fallback presentation failed (${code}): ${errors}`));
				return;
			}
			const line = output
				.trim()
				.split("\n")
				.findLast((value) => value.startsWith("{"));
			try {
				resolve(JSON.parse(line ?? ""));
			} catch {
				reject(new Error("Native fallback presentation returned no result"));
			}
		});
		child.stdin.end(JSON.stringify({ overlayId: world.owner.fixture.overlayId, overlaySecret: world.sourceSecret, sessionId: world.sessionId, executionGeneration: world.generation, apiBase: "http://127.0.0.1:3107", runnerToken: world.token, ...options }));
	});
}
