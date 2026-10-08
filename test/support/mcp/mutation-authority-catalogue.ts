import { randomUUID } from "node:crypto";
import { symmetricEncrypt } from "better-auth/crypto";
import { MCP_SCOPES } from "@/auth/mcp-options";
import type { createMcpPostgresFixture } from "./postgres";

export async function runMutationAuthorityCatalogue(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; auth: any; origin: string; token: string; actorId: string; grantId: string }) {
	const { fixture, auth, origin, actorId } = input;
	const overlayId = "79e6c5a3-5368-4813-9780-49d22d99175f",
		playlistId = "a1dca8b8-089a-47ce-b649-1c32bb3842c1";
	const foreignOverlayId = "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6",
		foreignPlaylistId = "7ee96cd3-184d-4d18-8689-b1e545f7498b";
	const member = (await fixture.pool.query("SELECT id FROM auth.member WHERE organization_id='creator-org' AND user_id=$1", [actorId])).rows[0];
	await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('authority-other','Other creator','authority-other',now()),('authority-agency','Agency','authority-agency',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('other-creator','other-authority@example.invalid','Other creator','','user','pro'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('other-creator','authority-other','active')");
	await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'authority-other',$2,'owner',now()),($3,'authority-agency',$2,'operations',now())", [randomUUID(), actorId, randomUUID()]);
	await fixture.pool.query("INSERT INTO agency_creator_links(agency_organization_id,creator_organization_id,status,permission_ceiling,accepted_by,accepted_at) VALUES('authority-agency','creator-org','accepted',$1,$2,now())", [JSON.stringify(MCP_SCOPES), actorId]);
	await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'other-creator','private-foreign-authority-secret','Other overlay','active','Featured')", [foreignOverlayId]);
	await fixture.pool.query("INSERT INTO playlists(id,owner_id,name) VALUES($1,'other-creator','Other playlist')", [foreignPlaylistId]);
	const providerToken = "private-authority-provider-token";
	process.env.TWITCH_CLIENT_ID = "isolated-authority-client";
	process.env.TWITCH_CLIENT_SECRET = "isolated-authority-client-secret";
	await fixture.pool.query("INSERT INTO creator_identity_links(creator_id,auth_user_id,source) VALUES('fixture-creator',$1,'twitch_onboarding')", [actorId]);
	const encrypted = await symmetricEncrypt({ key: process.env.BETTER_AUTH_SECRET!, data: providerToken });
	await fixture.pool.query("INSERT INTO auth.account(id,account_id,provider_id,user_id,access_token,access_token_expires_at,scope,created_at,updated_at) VALUES($1,'fixture-twitch-identity','twitch',$2,$3,now()+interval '1 hour','user:read:email',now(),now())", [randomUUID(), actorId, encrypted]);
	const reset = async () => {
		await fixture.pool.query("DELETE FROM overlays WHERE owner_id='fixture-creator'; DELETE FROM playlists WHERE owner_id='fixture-creator'");
		await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','private-authority-overlay-secret','Authority overlay','active','Featured')", [overlayId]);
		await fixture.pool.query("INSERT INTO playlists(id,owner_id,name) VALUES($1,'fixture-creator','Authority playlist')", [playlistId]);
		await fixture.pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) VALUES($1,'FirstAuthorityClip',0,$2),($1,'SecondAuthorityClip',1,$3)", [playlistId, JSON.stringify({ id: "FirstAuthorityClip", title: "First", duration: 10 }), JSON.stringify({ id: "SecondAuthorityClip", title: "Second", duration: 12 })]);
	};
	const snapshot = async () => JSON.stringify((await fixture.pool.query("SELECT jsonb_build_object('overlays',(SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) FROM overlays o),'playlists',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM playlists p),'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.playlist_id,i.clip_id) FROM playlist_clips i),'retries',(SELECT count(*) FROM mcp_mutation_retries),'effects',(SELECT count(*) FROM overlay_effect_jobs)) AS state")).rows[0].state);
	const names = ["create_overlay", "update_overlay_settings", "delete_overlay", "create_playlist", "update_playlist", "delete_playlist", "add_playlist_items", "remove_playlist_items", "reorder_playlist_items"];
	const argsFor = (name: string, phase: string): Record<string, unknown> => {
		const args: Record<string, unknown> = { creatorId: "fixture-creator" };
		if (name.startsWith("create_")) Object.assign(args, { retryKey: `${phase}:${name}`, name: "Created authority resource" });
		else Object.assign(args, { expectedRevision: 1, ...(name.includes("overlay") ? { overlayId } : { playlistId }) });
		if (name === "update_overlay_settings") args.patch = { name: "Updated authority overlay" };
		if (name === "update_playlist") args.name = "Updated authority playlist";
		if (name === "add_playlist_items") args.clipIds = ["NewAuthorityClip"];
		if (name === "remove_playlist_items") args.itemIds = ["FirstAuthorityClip"];
		if (name === "reorder_playlist_items") args.itemIds = ["SecondAuthorityClip", "FirstAuthorityClip"];
		return args;
	};
	const route = await import("@/app/mcp/route");
	const originalFetch = globalThis.fetch;
	let providerCalls = 0;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		const url = new URL(request.url);
		if (url.origin === origin) return auth.handler(request);
		if (url.origin !== "https://api.twitch.tv" || url.pathname !== "/helix/clips" || request.headers.get("Authorization") !== `Bearer ${providerToken}`) throw new Error("AUTHORITY_EXTERNAL_IO_FORBIDDEN");
		providerCalls++;
		return Promise.resolve(Response.json({ data: url.searchParams.getAll("id").map((id) => ({ id, title: "Authority provider clip", duration: 12, broadcaster_id: "fixture-creator", created_at: "2026-10-04T00:00:00Z" })) }));
	}) as typeof fetch;
	let id = 0;
	const call = async (name: string, phase: string, args: Record<string, unknown>) => {
		const before = await snapshot();
		const response = await route.POST(new Request(origin + "/mcp", { method: "POST", headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }) }));
		const text = await response.text();
		const data =
			text.startsWith("event:") || text.startsWith("data:")
				? text
						.split("\n")
						.find((line) => line.startsWith("data:"))
						?.slice(5)
						.trim()
				: text;
		const body = data ? JSON.parse(data) : null;
		return { name, phase, status: response.status, code: body?.result?.structuredContent?.error?.code ?? null, success: !!body?.result?.structuredContent && !body.result.isError, changed: before !== (await snapshot()), leakedData: /private-authority-provider-token|private-authority-overlay-secret|private-foreign-authority-secret/.test(text) };
	};
	try {
		const outcomes = [];
		for (const phase of ["unapproved-creator", "denied-role", "foreign-resource", "failed-audit", "direct-pro", "direct-free", "owner-free", "agency-pro", "agency-free"]) {
			const agency = phase.startsWith("agency-");
			await fixture.pool.query("UPDATE users SET plan=$1 WHERE id='fixture-creator'", [phase.endsWith("free") ? "free" : "pro"]);
			await fixture.pool.query("DELETE FROM auth.member WHERE id=$1", [member.id]);
			if (!agency) await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'creator-org',$2,$3,now())", [member.id, actorId, phase === "denied-role" ? "analyst" : phase === "owner-free" ? "owner" : "operations"]);
			await fixture.pool.query("UPDATE mcp_grant_creators SET agency_organization_id=$1 WHERE grant_id=$2 AND creator_id='fixture-creator'", [agency ? "authority-agency" : null, input.grantId]);
			if (phase === "failed-audit") await fixture.pool.query("CREATE FUNCTION reject_authority_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled authority audit failure'; END $$; CREATE TRIGGER reject_authority_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_authority_audit()");
			for (const name of names) {
				if (phase === "foreign-resource" && name.startsWith("create_")) continue;
				await reset();
				const args = argsFor(name, phase);
				if (phase === "unapproved-creator") args.creatorId = "other-creator";
				if (phase === "foreign-resource") {
					if (name.includes("overlay")) args.overlayId = foreignOverlayId;
					else args.playlistId = foreignPlaylistId;
				}
				if (phase.endsWith("free") && name.startsWith("create_")) await fixture.pool.query(name.includes("overlay") ? "DELETE FROM overlays WHERE owner_id='fixture-creator'" : "DELETE FROM playlists WHERE owner_id='fixture-creator'");
				outcomes.push(await call(name, phase, args));
			}
			if (phase === "failed-audit") await fixture.pool.query("DROP TRIGGER reject_authority_audit ON audit_events");
		}
		await fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
		for (const name of ["create_overlay", "create_playlist", "update_overlay_settings", "add_playlist_items"]) {
			await reset();
			const args = argsFor(name, "paid-boundary");
			if (name === "update_overlay_settings") args.patch = { playerVolume: 70 };
			if (name === "add_playlist_items") args.clipIds = Array.from({ length: 49 }, (_, index) => `OverLimitClip${index}`);
			outcomes.push(await call(name === "update_overlay_settings" ? "update_overlay_playback" : name, "paid-boundary", args));
		}
		return { outcomes, providerCalls };
	} finally {
		globalThis.fetch = originalFetch;
	}
}
