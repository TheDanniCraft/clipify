import "./browser-admin-provider-preload.mjs";
// Controlled provider metadata for the isolated actual-Next browser acceptance.
// Native OAuth, SDK transport and application authorization remain real.
import { Pool } from "pg";
import { browserDatabaseUrl } from "./browser-database.cjs";
const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
	const url = new URL(input instanceof Request ? input.url : String(input));
	const ids = url.searchParams.getAll("id");
	if (url.origin !== "https://api.twitch.tv" || url.pathname !== "/helix/clips" || ids.length !== 1 || !/^SdkBrowser_[a-f0-9-]{36}$/.test(ids[0])) return nativeFetch(input, init);
	const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
	if (headers.get("Authorization") !== "Bearer isolated-dashboard-fixture-token" || headers.get("Client-Id") !== "isolated-browser-client") throw new Error("Unexpected controlled provider credential context");
	const creatorId = `e2e-creator-${ids[0].slice("SdkBrowser_".length)}`;
	const { rows } = await pool.query("SELECT username FROM users WHERE id=$1 AND disabled=false", [creatorId]);
	if (rows.length !== 1) return Response.json({ data: [] });
	return Response.json({ data: [{ id: ids[0], title: "Official SDK added clip", duration: 10, broadcaster_id: creatorId, broadcaster_name: rows[0].username, creator_name: rows[0].username, created_at: new Date().toISOString(), thumbnail_url: "https://example.invalid/sdk-clip.png", url: `https://clips.twitch.tv/${ids[0]}` }] });
};
process.once("beforeExit", () => void pool.end());
