import "server-only";
import { z } from "zod";
import { dbPool } from "@/db/client";
import { getAccessTokenResultInternal } from "./tokens";
import { readBoundedResponse } from "@lib/clipExport";
export const broadcastVideoSchema = z.object({ id: z.string().regex(/^\d{1,200}$/), user_id: z.string().min(1).max(200), title: z.string().max(1000), created_at: z.string().datetime(), type: z.string(), duration: z.string().max(100), thumbnail_url: z.string().optional() });
const recordSchema = z.object({ video: broadcastVideoSchema, lastSeenAt: z.string().datetime(), unavailable: z.boolean().default(false) });
const syncSchema = z.object({ cursor: z.string().max(1024).optional(), cycleStartedAt: z.string().datetime().optional(), retryAt: z.string().datetime().optional() });
export type SavedBroadcast = z.infer<typeof recordSchema>;
function json(value: string) {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}
export async function saveBroadcasts(creatorId: string, videos: unknown[], seenAt: string) {
	const records = videos.flatMap((video) => {
		const parsed = broadcastVideoSchema.safeParse(video);
		return parsed.success && parsed.data.user_id === creatorId && parsed.data.type === "archive" ? [{ key: `broadcast:v1:${parsed.data.id}`, state: JSON.stringify(recordSchema.parse({ video: parsed.data, lastSeenAt: seenAt, unavailable: false })) }] : [];
	});
	if (!records.length) return;
	await dbPool.query(
		`INSERT INTO user_content_states(user_id,content_key,state,updated_at)
 SELECT $1,key,state,now() FROM jsonb_to_recordset($2::jsonb) AS records(key text,state text)
 ON CONFLICT(user_id,content_key) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at
 WHERE user_content_states.state::jsonb->>'lastSeenAt' < excluded.state::jsonb->>'lastSeenAt'`,
		[creatorId, JSON.stringify(records)],
	);
}
export async function readSavedBroadcasts(creatorId: string): Promise<SavedBroadcast[]> {
	const { rows } = await dbPool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key LIKE 'broadcast:v1:%'", [creatorId]);
	return rows.flatMap((row) => {
		const parsed = recordSchema.safeParse(json(row.state));
		return parsed.success && parsed.data.video.user_id === creatorId && parsed.data.video.type === "archive" ? [parsed.data] : [];
	});
}
export async function markBroadcastUnavailable(creatorId: string, videoId: string) {
	await dbPool.query("UPDATE user_content_states SET state=jsonb_set(state::jsonb,'{unavailable}','true')::text,updated_at=now() WHERE user_id=$1 AND content_key=$2", [creatorId, `broadcast:v1:${videoId}`]);
}
export async function ensureBroadcastCollection(creatorId: string) {
	await dbPool.query("INSERT INTO clip_crawl_jobs(creator_id,kind,next_run_at) SELECT id,'recent',now() FROM users WHERE id=$1 AND NOT disabled ON CONFLICT(creator_id,kind) DO NOTHING", [creatorId]);
}
async function syncState(creatorId: string, state: z.infer<typeof syncSchema>) {
	await dbPool.query("INSERT INTO user_content_states(user_id,content_key,state,updated_at) VALUES($1,'broadcast-sync:v1',$2,now()) ON CONFLICT(user_id,content_key) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at", [creatorId, JSON.stringify(state)]);
}
async function providerPage(creatorId: string, cursor: string | undefined) {
	const credentials = await getAccessTokenResultInternal(creatorId);
	if (!credentials.token) return { ok: false as const, code: "RECONNECT_REQUIRED", retrySeconds: 300 };
	const url = new URL("https://api.twitch.tv/helix/videos");
	url.searchParams.set("user_id", creatorId);
	url.searchParams.set("type", "archive");
	url.searchParams.set("first", "100");
	if (cursor) url.searchParams.set("after", cursor);
	const signal = AbortSignal.timeout(5000);
	const response = await fetch(url, { headers: { Authorization: `Bearer ${credentials.token.accessToken}`, "Client-Id": process.env.TWITCH_CLIENT_ID ?? "" }, signal, redirect: "error" });
	if (!response.ok) {
		await response.body?.cancel();
		const retry = Number(response.headers.get("retry-after"));
		return { ok: false as const, code: response.status === 429 ? "RATE_LIMITED" : response.status === 401 ? "RECONNECT_REQUIRED" : "SERVICE_UNAVAILABLE", retrySeconds: Number.isFinite(retry) && retry > 0 ? Math.min(retry, 86400) : 300, resetCursor: response.status === 400 };
	}
	const payload = z.object({ data: z.array(broadcastVideoSchema).max(100), pagination: z.object({ cursor: z.string().max(1024).optional() }).optional() }).parse(json(new TextDecoder().decode(await readBoundedResponse(response, 1024 * 1024, signal))));
	return { ok: true as const, payload };
}
/** Internal collector: callers must already own an authorized creator crawl/read. */
export async function syncBroadcastArchive(creatorId: string) {
	const stored = await dbPool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key='broadcast-sync:v1'", [creatorId]);
	const parsed = syncSchema.safeParse(stored.rows[0] ? json(stored.rows[0].state) : {}),
		state = parsed.success ? parsed.data : {};
	if (state.retryAt && Date.parse(state.retryAt) > Date.now()) return { ok: true as const };
	const startedAt = state.cycleStartedAt ?? new Date().toISOString();
	try {
		const page = await providerPage(creatorId, state.cursor);
		if (!page.ok) {
			await syncState(creatorId, { ...state, cursor: page.resetCursor ? undefined : state.cursor, retryAt: new Date(Date.now() + page.retrySeconds * 1000).toISOString() });
			return { ok: false as const, code: page.code };
		}
		await saveBroadcasts(creatorId, page.payload.data, new Date().toISOString());
		const cursor = page.payload.pagination?.cursor;
		if (cursor && cursor === state.cursor) {
			await syncState(creatorId, { retryAt: new Date(Date.now() + 300000).toISOString() });
			return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
		}
		if (!cursor) await dbPool.query("UPDATE user_content_states SET state=jsonb_set(state::jsonb,'{unavailable}','true')::text,updated_at=now() WHERE user_id=$1 AND content_key LIKE 'broadcast:v1:%' AND state::jsonb->>'lastSeenAt'<$2 AND coalesce((state::jsonb->>'unavailable')::boolean,false)=false", [creatorId, startedAt]);
		await syncState(creatorId, { cursor, cycleStartedAt: cursor ? startedAt : undefined, retryAt: new Date(Date.now() + (cursor ? 60000 : 300000)).toISOString() });
		return { ok: true as const };
	} catch {
		await syncState(creatorId, { ...state, retryAt: new Date(Date.now() + 300000).toISOString() });
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
