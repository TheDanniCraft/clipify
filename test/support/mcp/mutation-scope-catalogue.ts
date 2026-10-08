import { SignJWT, importJWK } from "jose";
import { symmetricDecrypt } from "better-auth/crypto";
import type { Pool } from "pg";

export async function runMutationScopeCatalogue(input: { pool: Pool; auth: any; origin: string; token: string; claims: Record<string, any>; readsOnly?: boolean }) {
	const key = (await input.pool.query("SELECT id,alg,private_key FROM auth.jwks ORDER BY created_at DESC LIMIT 1")).rows[0];
	const decrypted = await symmetricDecrypt({ key: process.env.BETTER_AUTH_SECRET!, data: JSON.parse(key.private_key) });
	const algorithm = key.alg ?? "EdDSA";
	const privateKey = await importJWK(JSON.parse(decrypted), algorithm);
	const mutations = [
		["create_overlay", "overlay:create"],
		["update_overlay_settings", "overlay:update"],
		["delete_overlay", "overlay:delete"],
		["create_playlist", "playlist:create"],
		["update_playlist", "playlist:update"],
		["delete_playlist", "playlist:delete"],
		["add_playlist_items", "playlist-items:manage"],
		["remove_playlist_items", "playlist-items:manage"],
		["reorder_playlist_items", "playlist-items:manage"],
	] as const;
	const reads = [
		["list_creators", "creator:read"],
		["get_capabilities", "creator:read"],
		["list_overlays", "overlay:read"],
		["get_overlay", "overlay:read"],
		["list_playlists", "playlist:read"],
		["get_playlist", "playlist:read"],
	] as const;
	const cases = input.readsOnly ? reads : mutations;
	const overlayId = "79e6c5a3-5368-4813-9780-49d22d99175f",
		playlistId = "a1dca8b8-089a-47ce-b649-1c32bb3842c1";
	if (input.readsOnly) {
		await input.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','private-read-scope-secret','PRIVATE_SCOPE_OVERLAY','active','Featured')", [overlayId]);
		await input.pool.query("INSERT INTO playlists(id,owner_id,name) VALUES($1,'fixture-creator','PRIVATE_SCOPE_PLAYLIST')", [playlistId]);
		await input.pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) VALUES($1,'PrivateScopeClip',0,$2)", [playlistId, JSON.stringify({ id: "PrivateScopeClip", title: "PRIVATE_SCOPE_CLIP", url: "https://example.invalid/private-scope-url" })]);
	}
	const route = await import("@/app/mcp/route");
	const originalFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== input.origin) throw new Error("SCOPE_CATALOGUE_EXTERNAL_IO_FORBIDDEN");
		return input.auth.handler(request);
	}) as typeof fetch;
	try {
		const outcomes = [];
		for (const [name, permission] of cases) {
			// Keep the actual provider's issuer/key/subject/client/grant binding; narrow
			// only the scope to isolate the resource-server permission check.
			const scopes = input.claims.scope.split(" ").filter((scope: string) => scope !== permission);
			const token = await new SignJWT({ ...input.claims, scope: scopes.join(" ") }).setProtectedHeader({ alg: algorithm, kid: key.id }).sign(privateKey);
			const response = await route.POST(
				new Request(input.origin + "/mcp", {
					method: "POST",
					headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" },
					body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: input.readsOnly ? (name === "list_creators" ? {} : { creatorId: "fixture-creator", ...(name === "get_overlay" ? { overlayId } : {}), ...(name === "get_playlist" ? { playlistId } : {}) }) : { creatorId: "fixture-creator" } } }),
				}),
			);
			const text = await response.text();
			const counts = (await input.pool.query("SELECT (SELECT count(*) FROM overlays)::int AS overlays,(SELECT count(*) FROM playlists)::int AS playlists,(SELECT count(*) FROM mcp_mutation_retries)::int AS retries,(SELECT count(*) FROM overlay_effect_jobs)::int AS effects")).rows[0];
			outcomes.push({ name, permission, status: response.status, insufficientScope: response.headers.get("www-authenticate")?.includes("insufficient_scope") ?? false, counts, ...(input.readsOnly ? { leakedData: /private-read-scope-secret|PRIVATE_SCOPE_|PrivateScopeClip|private-scope-url/.test(text) } : {}) });
		}
		return { outcomes };
	} finally {
		globalThis.fetch = originalFetch;
	}
}
