// Controlled media transport for actual Next/OverlayPlayer browser acceptance.
// Only disposable E2E databases and explicitly seeded RunnerPresentation_ clips
// are accepted. Authentication, source ownership, selection and rendering stay real.
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { browserDatabaseUrl } from "./browser-database.cjs";

const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
const mediaByBackground = Object.fromEntries(["default", "light", "dark", "busy"].map((name) => [name, readFileSync(new URL(`../../fixtures/runner/presentation${name === "default" ? "" : `-${name}`}.mp4`, import.meta.url))]));
const prefix = /^RunnerPresentation_([a-f0-9-]{36})$/;
async function seededClip(id) {
	const match = typeof id === "string" && id.match(prefix);
	if (!match) return false;
	const { rows } = await pool.query("SELECT pc.clip_data::jsonb->>'title' AS title FROM playlist_clips pc JOIN playlists p ON p.id=pc.playlist_id WHERE pc.clip_id=$1 AND p.owner_id=$2", [id, `e2e-creator-${match[1]}`]);
	return rows.length === 1 ? (rows[0].title?.match(/^Runner readability (light|dark|busy)$/)?.[1] ?? "default") : false;
}
let origin;
async function respondGraphql(request, response) {
	let body = "";
	for await (const chunk of request) {
		body += chunk;
		if (body.length > 4096) {
			response.writeHead(413).end();
			return;
		}
	}
	let input;
	try {
		input = JSON.parse(body);
	} catch {
		response.writeHead(400).end();
		return;
	}
	const query = Array.isArray(input) && input.length === 1 ? input[0] : null;
	const id = query?.variables?.slug;
	if (query?.operationName !== "VideoAccessToken_Clip" || request.headers["client-id"] !== "kimne78kx3ncx6brgo4mv6wki5h1ko" || !(await seededClip(id))) {
		response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify([{ data: { clip: null } }]));
		return;
	}
	response.writeHead(200, { "Content-Type": "application/json" });
	response.end(JSON.stringify([{ data: { clip: { videoQualities: [{ quality: "720", sourceURL: `${origin}/clip/${id}.mp4` }], playbackAccessToken: { signature: "fixture-signature", value: "fixture-token" } } } }]));
	return;
}

function respondMedia(request, response, background) {
	const media = mediaByBackground[background];
	response.setHeader("Content-Type", "video/mp4");
	response.setHeader("Accept-Ranges", "bytes");
	const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
	if (range) {
		const start = Number(range[1]),
			end = range[2] ? Math.min(Number(range[2]), media.length - 1) : media.length - 1;
		if (start > end) {
			response.writeHead(416, { "Content-Range": `bytes */${media.length}` }).end();
			return;
		}
		response.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${media.length}`, "Content-Length": end - start + 1 });
		response.end(media.subarray(start, end + 1));
	} else {
		response.writeHead(200, { "Content-Length": media.length });
		response.end(media);
	}
	return;
}

const server = http.createServer(async (request, response) => {
	try {
		const url = new URL(request.url, origin);
		if (request.method === "POST" && url.pathname === "/gql") return await respondGraphql(request, response);
		const mediaId = url.pathname.match(/^\/clip\/(RunnerPresentation_[a-f0-9-]{36})\.mp4$/)?.[1];
		const background = mediaId && (await seededClip(mediaId));
		if (request.method === "GET" && background) return respondMedia(request, response, background);
		response.writeHead(404).end();
	} catch {
		response.writeHead(500).end("Controlled media fixture failed");
	}
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
server.unref();
origin = `http://127.0.0.1:${server.address().port}`;
const original = https.request;
https.request = function (input, options, callback) {
	const isUrl = typeof input === "string" || input instanceof URL;
	const opts = isUrl ? { ...(typeof options === "object" ? options : {}) } : input;
	const url = isUrl ? new URL(input) : new URL(`https://${opts.hostname ?? opts.host}${opts.path ?? "/"}`);
	if (url.hostname !== "gql.twitch.tv" || url.pathname !== "/gql") return original.call(this, input, options, callback);
	const done = typeof options === "function" ? options : callback;
	return http.request({ hostname: "127.0.0.1", port: server.address().port, path: "/gql", method: opts.method ?? "POST", headers: opts.headers }, done);
};
syncBuiltinESMExports();
process.once("beforeExit", () => {
	server.close();
	void pool.end();
});
