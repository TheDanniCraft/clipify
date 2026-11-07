import { readFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import { Pool } from "pg";
import { browserDatabaseUrl } from "./browser-database.cjs";
const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
const video = readFileSync(new URL("../../fixtures/runner/presentation.mp4", import.meta.url));
const nativeFetch = globalThis.fetch.bind(globalThis);
const downloadModes = new Map();
const fixtureId = /^(?:RunnerPresentation|LibrarySort\d{2})_([a-f0-9-]{36})$/;
async function creatorVideos(url, input, init, headers) {
	const requested = url.searchParams.get("user_id");
	const result = await pool.query("SELECT id FROM users WHERE id LIKE 'e2e-creator-%' AND disabled=false AND ($1::text IS NULL OR id=$1) LIMIT 1", [requested]);
	if (!result.rows.length) return nativeFetch(input, init);
	if (headers.get("Authorization") !== "Bearer isolated-dashboard-fixture-token") throw new Error("Unexpected videos provider context");
	const creatorId = result.rows[0].id;
	const removed = await pool.query("SELECT 1 FROM user_content_states WHERE user_id=$1 AND content_key='test-videos-removed' AND state='true'", [creatorId]);
	if (removed.rows.length) return Response.json({ data: [], pagination: {} });
	const make = (id, title, type, date) => ({ id, title, type, user_id: creatorId, created_at: date, duration: "1h", thumbnail_url: "" });
	let data = [make("12346", "Latest stream", "archive", "2026-11-02T00:00:00Z"), make("12345", "Earlier stream", "archive", "2026-11-01T00:00:00Z"), make("77777", "Highlight", "highlight", "2026-11-03T00:00:00Z"), make("88888", "Upload", "upload", "2026-11-03T00:00:00Z")];
	if (url.searchParams.get("after")) data = [make("12347", "Older stream", "archive", "2026-10-01T00:00:00Z")];
	const id = url.searchParams.get("id");
	if (id) data = data.filter((video) => video.id === id);
	return Response.json({ data, pagination: id || url.searchParams.get("after") ? {} : { cursor: "library-next" } });
}
async function creatorClips(url, input, init, headers) {
	if (headers.get("Authorization") !== "Bearer isolated-dashboard-fixture-token") throw new Error("Unexpected clip sync provider context");
	const creatorId = url.searchParams.get("broadcaster_id");
	const { rows } = await pool.query('SELECT value FROM "twitchCache" WHERE type=$1 AND starts_with(key,$2)', ["clip", `clip:${creatorId}:`]);
	const start = Date.parse(url.searchParams.get("started_at") ?? "1970-01-01");
	const end = Date.parse(url.searchParams.get("ended_at") ?? new Date().toISOString());
	const data = rows
		.map((row) => JSON.parse(row.value))
		.map((value) => ({ ...value.clip, title: value.testProviderTitle ?? value.clip.title, ...(value.testProviderNoVod ? { video_id: "", vod_offset: null } : {}) }))
		.filter((clip) => Date.parse(clip.created_at) >= start && Date.parse(clip.created_at) <= end);
	return Response.json({ data, pagination: {} });
}
async function clipDownloads(url, input, init, headers) {
	const ids = url.searchParams.getAll("clip_id");
	if (!ids.length || ids.length > 10 || ids.some((id) => !fixtureId.test(id))) return nativeFetch(input, init);
	if (headers.get("Authorization") !== "Bearer isolated-dashboard-fixture-token" || headers.get("Client-Id") !== "isolated-browser-client") throw new Error("Unexpected export provider credential context");
	const creatorId = url.searchParams.get("broadcaster_id");
	if (ids.some((id) => `e2e-creator-${fixtureId.exec(id)[1]}` !== creatorId)) return Response.json({ data: [] });
	const { rows } = await pool.query('SELECT key,value FROM "twitchCache" WHERE type=$1 AND key=ANY($2::text[])', ["clip", ids.map((id) => `clip:${creatorId}:${id}`)]);
	for (const id of ids) downloadModes.set(id, JSON.parse(rows.find((row) => row.key.endsWith(`:${id}`))?.value ?? "{}").testDownloadMode);
	const modes = ids.map((id) => downloadModes.get(id));
	if (modes.includes("revoked")) return new Response(null, { status: 401 });
	if (modes.includes("provider_429")) return new Response(null, { status: 429, headers: { "retry-after": "2" } });
	if (modes.includes("provider_5xx")) return new Response(null, { status: 503 });
	return Response.json({ data: ids.filter((id) => rows.some((row) => row.key.endsWith(`:${id}`))).map((id) => ({ clip_id: id, ...(downloadModes.get(id) === "portrait_only" ? { portrait_download_url: `https://production.assets.clips.twitchcdn.net/library/${id}.mp4` } : { landscape_download_url: `https://${downloadModes.get(id) === "legacy_cdn" ? "d1ndex63qxojbr.cloudfront.net" : "production.assets.clips.twitchcdn.net"}/library/${id}.mp4` }) })) });
}
async function clipMedia(url, input, init, headers) {
	const id = url.pathname.slice("/library/".length, -4);
	if (!fixtureId.test(id)) return nativeFetch(input, init);
	if (headers.has("Authorization") || headers.has("Client-Id")) throw new Error("Provider credentials leaked into a media request");
	const mode = downloadModes.get(id);
	if (mode === "audio" || mode === "audio_untagged") {
		const media = readFileSync(new URL(mode === "audio" ? "../../fixtures/clips/export-audio.mp4" : "../../fixtures/clips/export-audio-untagged.mp4", import.meta.url));
		return new Response(media, { headers: { "Content-Type": "video/mp4", "Content-Length": String(media.length) } });
	}
	if (mode === "deleted") return new Response(null, { status: 404 });
	if (mode === "media_5xx") return new Response(null, { status: 503 });
	if (mode === "html") return new Response("<html>provider failure</html>", { headers: { "Content-Type": "text/html" } });
	if (mode === "truncated") return new Response(video.subarray(0, video.length - 1));
	if (mode === "delay") await pool.query(`UPDATE "twitchCache" SET value=jsonb_set(value::jsonb, '{testMediaStarted}', 'true')::text WHERE type=$1 AND key=$2`, ["clip", `clip:e2e-creator-${fixtureId.exec(id)[1]}:${id}`]);
	if (mode === "delay")
		await new Promise((resolve, reject) => {
			const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
			if (signal?.aborted) {
				reject(signal.reason);
				return;
			}
			const abort = () => {
				clearTimeout(timer);
				reject(signal.reason);
			};
			const timer = setTimeout(() => {
				signal?.removeEventListener("abort", abort);
				resolve();
			}, 5000);
			signal?.addEventListener("abort", abort, { once: true });
		});
	if (mode === "maximum_file") {
		const media = Buffer.alloc(32 * 1024 * 1024);
		video.copy(media);
		media.writeUInt32BE(media.length - video.length, video.length);
		media.write("free", video.length + 4, "ascii");
		return new Response(media, { headers: { "Content-Type": "video/mp4", "Content-Length": String(media.length) } });
	}
	return new Response(video, { headers: { "Content-Type": "video/mp4", "Content-Length": String(video.byteLength) } });
}
function providerHeaders(input, init) {
	return new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
}
function fixtureFont(url) {
	// Deterministic licensed font bytes for the real browser/native brand journey.
	if (url.origin === "https://fonts.googleapis.com" && url.pathname === "/css" && url.searchParams.get("family") === "Laila:400,700") return new Response("@font-face {font-weight:400;src:url(https://fonts.gstatic.com/s/laila/fixture.ttf)} @font-face {font-weight:700;src:url(https://fonts.gstatic.com/s/laila/fixture.ttf)}", { headers: { "content-type": "text/css" } });
	if (url.href === "https://fonts.gstatic.com/s/laila/fixture.ttf") return new Response(readFileSync(new URL("../../fixtures/fonts/Laila-Regular.ttf", import.meta.url)), { headers: { "content-type": "font/ttf" } });
}
globalThis.fetch = async (input, init) => {
	const url = new URL(input instanceof Request ? input.url : String(input));
	const font = fixtureFont(url);
	if (font) return font;
	const headers = providerHeaders(input, init);
	if (url.origin === "https://api.twitch.tv" && url.pathname === "/helix/videos") return creatorVideos(url, input, init, headers);
	if (url.origin === "https://api.twitch.tv" && url.pathname === "/helix/clips" && /^e2e-creator-[a-f0-9-]{36}$/.test(url.searchParams.get("broadcaster_id") ?? "")) return creatorClips(url, input, init, headers);
	if (url.origin === "https://api.twitch.tv" && url.pathname === "/helix/clips/downloads") return clipDownloads(url, input, init, headers);
	if (["https://production.assets.clips.twitchcdn.net", "https://d1ndex63qxojbr.cloudfront.net"].includes(url.origin) && url.pathname.startsWith("/library/")) return clipMedia(url, input, init, headers);
	return nativeFetch(input, init);
};
process.once("beforeExit", () => void pool.end());

// Bundled Axios uses Node HTTPS rather than fetch. Its fixture GETs use a real loopback transport.
const provider = createServer(async (request, response) => {
	try {
		const url = new URL(request.url, "https://api.twitch.tv");
		if (request.method !== "GET" || url.origin !== "https://api.twitch.tv" || url.pathname !== "/helix/clips" || !/^e2e-creator-[a-f0-9-]{36}$/.test(url.searchParams.get("broadcaster_id") ?? "")) {
			response.writeHead(404).end();
			return;
		}
		const result = await globalThis.fetch(`https://api.twitch.tv/helix/clips?${url.searchParams}`, { headers: request.headers });
		response.writeHead(result.status, Object.fromEntries(result.headers));
		response.end(Buffer.from(await result.arrayBuffer()));
	} catch {
		response.writeHead(500).end("Fixture provider request failed");
	}
});
await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
provider.unref();
const nativeRequest = https.request;
https.request = function (...args) {
	const [options, callback] = args;
	if (options && typeof options === "object" && options.hostname === "api.twitch.tv") {
		const url = new URL(options.path, "https://api.twitch.tv");
		if (url.pathname === "/helix/clips" && /^e2e-creator-[a-f0-9-]{36}$/.test(url.searchParams.get("broadcaster_id") ?? "")) {
			return httpRequest({ ...options, protocol: "http:", hostname: "127.0.0.1", host: "127.0.0.1", port: provider.address().port, agent: undefined }, callback);
		}
	}
	return nativeRequest.apply(this, args);
};
syncBuiltinESMExports();
