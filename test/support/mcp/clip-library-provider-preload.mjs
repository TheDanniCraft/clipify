import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { browserDatabaseUrl } from "./browser-database.cjs";
const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
const video = readFileSync(new URL("../../fixtures/runner/presentation.mp4", import.meta.url));
const nativeFetch = globalThis.fetch.bind(globalThis);
const downloadModes = new Map();
const fixtureId = /^(?:RunnerPresentation|LibrarySort\d{2})_([a-f0-9-]{36})$/;
globalThis.fetch = async (input, init) => {
	const url = new URL(input instanceof Request ? input.url : String(input));
	const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
	if (url.origin === "https://api.twitch.tv" && url.pathname === "/helix/videos") {
		const requested = url.searchParams.get("user_id");
		const result = await pool.query("SELECT id FROM users WHERE id LIKE 'e2e-creator-%' AND disabled=false AND ($1::text IS NULL OR id=$1) LIMIT 1", [requested]);
		if (!result.rows.length) return nativeFetch(input, init);
		if (headers.get("Authorization") !== "Bearer isolated-dashboard-fixture-token") throw new Error("Unexpected videos provider context");
		const creatorId = result.rows[0].id;
		const make = (id, title, type, date) => ({ id, title, type, user_id: creatorId, created_at: date, duration: "1h", thumbnail_url: "" });
		let data = [make("12346", "Latest stream", "archive", "2026-11-02T00:00:00Z"), make("12345", "Earlier stream", "archive", "2026-11-01T00:00:00Z"), make("77777", "Highlight", "highlight", "2026-11-03T00:00:00Z"), make("88888", "Upload", "upload", "2026-11-03T00:00:00Z")];
		if (url.searchParams.get("after")) data = [make("12347", "Older stream", "archive", "2026-10-01T00:00:00Z")];
		const id = url.searchParams.get("id");
		if (id) data = data.filter((video) => video.id === id);
		return Response.json({ data, pagination: id || url.searchParams.get("after") ? {} : { cursor: "library-next" } });
	}
	if (url.origin === "https://api.twitch.tv" && url.pathname === "/helix/clips/downloads") {
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
		return Response.json({ data: ids.filter((id) => rows.some((row) => row.key.endsWith(`:${id}`))).map((id) => ({ clip_id: id, ...(downloadModes.get(id) === "portrait_only" ? { portrait_download_url: `https://production.assets.clips.twitchcdn.net/library/${id}.mp4` } : { landscape_download_url: `https://production.assets.clips.twitchcdn.net/library/${id}.mp4` }) })) });
	}
	if (url.origin === "https://production.assets.clips.twitchcdn.net" && url.pathname.startsWith("/library/")) {
		const id = url.pathname.slice("/library/".length, -4);
		if (!fixtureId.test(id)) return nativeFetch(input, init);
		if (headers.has("Authorization") || headers.has("Client-Id")) throw new Error("Provider credentials leaked into a media request");
		const mode = downloadModes.get(id);
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
		return new Response(video, { headers: { "Content-Type": "video/mp4", "Content-Length": String(video.byteLength) } });
	}
	return nativeFetch(input, init);
};
process.once("beforeExit", () => void pool.end());
