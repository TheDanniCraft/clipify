import { randomUUID } from "node:crypto";
import { symmetricEncrypt } from "better-auth/crypto";
import type { createMcpPostgresFixture } from "./postgres";

export async function runToolResultsCatalogue(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; auth: any; origin: string; token: string; actorId: string }) {
	const { fixture, auth, origin, actorId } = input;
	const overlayId = "79e6c5a3-5368-4813-9780-49d22d99175f";
	const playlistId = "a1dca8b8-089a-47ce-b649-1c32bb3842c1";
	const providerToken = "private-tool-catalogue-provider-token";
	process.env.TWITCH_CLIENT_ID = "isolated-tool-catalogue-client";
	process.env.TWITCH_CLIENT_SECRET = "private-tool-catalogue-client-secret";
	const encrypted = await symmetricEncrypt({ key: process.env.BETTER_AUTH_SECRET!, data: providerToken });
	await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
	await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','private-tool-catalogue-overlay-secret','Catalogue overlay','active','Featured')", [overlayId]);
	await fixture.pool.query("INSERT INTO playlists(id,owner_id,name) VALUES($1,'fixture-creator','Catalogue playlist')", [playlistId]);
	await fixture.pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) VALUES($1,'ExistingCatalogueClip',0,$2)", [playlistId, JSON.stringify({ id: "ExistingCatalogueClip", title: "Existing clip", duration: 10, token: "private-tool-catalogue-clip-token" })]);
	await fixture.pool.query("INSERT INTO creator_identity_links(creator_id,auth_user_id,source) VALUES('fixture-creator',$1,'twitch_onboarding')", [actorId]);
	await fixture.pool.query("INSERT INTO auth.account(id,account_id,provider_id,user_id,access_token,access_token_expires_at,scope,created_at,updated_at) VALUES($1,'fixture-twitch-identity','twitch',$2,$3,now()+interval '1 hour','user:read:email',now(),now())", [randomUUID(), actorId, encrypted]);
	const route = await import("@/app/mcp/route");
	const originalFetch = globalThis.fetch;
	let providerCalls = 0;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		const url = new URL(request.url);
		if (url.origin === origin) return auth.handler(request);
		if (url.origin !== "https://api.twitch.tv" || url.pathname !== "/helix/clips" || request.headers.get("Authorization") !== `Bearer ${providerToken}`) throw new Error("TOOL_RESULTS_EXTERNAL_IO_FORBIDDEN");
		providerCalls++;
		return Promise.resolve(Response.json({ data: url.searchParams.getAll("id").map((id) => ({ id, title: "Provider clip", duration: 12, broadcaster_id: "fixture-creator", created_at: "2026-10-04T00:00:00Z", secret: "private-tool-catalogue-provider-secret" })) }));
	}) as typeof fetch;
	let id = 0;
	const privateValues = [input.token, providerToken, encrypted, process.env.TWITCH_CLIENT_SECRET!, "private-tool-catalogue-overlay-secret", "private-tool-catalogue-clip-token", "private-tool-catalogue-provider-secret"];
	const request = async (method: string, params: Record<string, unknown> = {}) => {
		const response = await route.POST(new Request(origin + "/mcp", { method: "POST", headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) }));
		const text = await response.text();
		const data =
			text.startsWith("event:") || text.startsWith("data:")
				? text
						.split("\n")
						.find((line) => line.startsWith("data:"))
						?.slice(5)
						.trim()
				: text;
		return { status: response.status, body: data ? JSON.parse(data) : null, secretFree: !privateValues.some((value) => text.includes(value)) && !/"(?:secret|access_token|refresh_token|authorization|cookie|rewardId)"\s*:/i.test(text) };
	};
	try {
		const discovery = await request("tools/list");
		const outcomes = [];
		const calls: [string, Record<string, unknown>][] = [
			["list_creators", {}],
			["get_capabilities", { creatorId: "fixture-creator" }],
			["list_overlays", { creatorId: "fixture-creator" }],
			["get_overlay", { creatorId: "fixture-creator", overlayId }],
			["create_overlay", { creatorId: "fixture-creator", retryKey: "catalogue-overlay", name: "Created catalogue overlay" }],
			["update_overlay_settings", { creatorId: "fixture-creator", overlayId, expectedRevision: 1, patch: { name: "Updated catalogue overlay" } }],
			["list_playlists", { creatorId: "fixture-creator" }],
			["get_playlist", { creatorId: "fixture-creator", playlistId }],
			["create_playlist", { creatorId: "fixture-creator", retryKey: "catalogue-playlist", name: "Created catalogue playlist" }],
			["add_playlist_items", { creatorId: "fixture-creator", playlistId, expectedRevision: 1, clipIds: ["NewCatalogueClip"] }],
			["remove_playlist_items", { creatorId: "fixture-creator", playlistId, expectedRevision: 2, itemIds: ["ExistingCatalogueClip"] }],
			["reorder_playlist_items", { creatorId: "fixture-creator", playlistId, expectedRevision: 3, itemIds: ["NewCatalogueClip"] }],
			["update_playlist", { creatorId: "fixture-creator", playlistId, expectedRevision: 4, name: "Updated catalogue playlist" }],
			["delete_overlay", { creatorId: "fixture-creator", overlayId, expectedRevision: 2 }],
			["delete_playlist", { creatorId: "fixture-creator", playlistId, expectedRevision: 5 }],
		];
		for (const [name, args] of calls) {
			const result = await request("tools/call", { name, arguments: args });
			outcomes.push({ name, status: result.status, success: !!result.body?.result?.structuredContent && !result.body.result.isError && !result.body.result.structuredContent.error, secretFree: result.secretFree });
		}
		const excluded = [];
		for (const name of ["rotate_overlay_secret", "get_runner_credentials", "create_api_token", "configure_twitch_reward"]) {
			const result = await request("tools/call", { name, arguments: { creatorId: "fixture-creator" } });
			excluded.push({ name, denied: result.body?.error?.code === -32602, secretFree: result.secretFree });
		}
		return { discovery: { status: discovery.status, names: discovery.body?.result?.tools?.map((tool: any) => tool.name), annotations: discovery.body?.result?.tools?.map((tool: any) => ({ name: tool.name, title: tool.title, annotations: tool.annotations })), secretFree: discovery.secretFree }, outcomes, excluded, providerCalls };
	} finally {
		globalThis.fetch = originalFetch;
	}
}
