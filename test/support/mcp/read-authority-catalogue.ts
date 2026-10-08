import { randomUUID } from "node:crypto";
import { MCP_SCOPES } from "@/auth/mcp-options";
import type { createMcpPostgresFixture } from "./postgres";
export const readAuthorityTools = ["list_creators", "get_capabilities", "list_overlays", "get_overlay", "list_playlists", "get_playlist"];
export const readAuthorityPhases = ["owner-pro", "owner-free", "direct-pro", "direct-free", "denied-role", "custom-direct", "agency-pro", "agency-free", "agency-ceiling", "agency-inactive", "agency-custom-role", "creator-suspended", "creator-disabled"];
export async function runReadAuthorityCatalogue(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; auth: any; origin: string; token: string; actorId: string; grantId: string }) {
	const { fixture, actorId, origin, auth } = input;
	const overlayId = "79e6c5a3-5368-4813-9780-49d22d99175f",
		playlistId = "a1dca8b8-089a-47ce-b649-1c32bb3842c1";
	const foreignOverlayId = "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6",
		foreignPlaylistId = "7ee96cd3-184d-4d18-8689-b1e545f7498b";
	const member = (await fixture.pool.query("SELECT id FROM auth.member WHERE organization_id='creator-org' AND user_id=$1", [actorId])).rows[0];
	await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('read-agency','Read agency','read-agency',now()),('read-other','Other creator','read-other',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('read-other-creator','read-other@example.invalid','Other private creator','','user','pro'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('read-other-creator','read-other','active')");
	await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'read-agency',$2,'operations',now()),($3,'read-other',$2,'owner',now())", [randomUUID(), actorId, randomUUID()]);
	await fixture.pool.query("INSERT INTO agency_creator_links(agency_organization_id,creator_organization_id,status,permission_ceiling,accepted_by,accepted_at) VALUES('read-agency','creator-org','accepted',$1,$2,now())", [JSON.stringify(MCP_SCOPES), actorId]);
	await fixture.pool.query("INSERT INTO auth.organization_role(id,organization_id,role,permission) VALUES('read-direct-custom','creator-org','read-custom',$1),('read-agency-custom','read-agency','read-custom',$2)", [JSON.stringify({ creator: ["read"], overlay: ["read"] }), JSON.stringify({ creator: ["read"], playlist: ["read"] })]);
	await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','private-read-authority-secret','Read authority overlay','active','Featured'),($2,'read-other-creator','private-foreign-read-secret','Foreign private overlay','active','Featured')", [overlayId, foreignOverlayId]);
	await fixture.pool.query("INSERT INTO playlists(id,owner_id,name) VALUES($1,'fixture-creator','Read authority playlist'),($2,'read-other-creator','Foreign private playlist')", [playlistId, foreignPlaylistId]);
	await fixture.pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) VALUES($1,'ReadAuthorityClip',0,$2)", [playlistId, JSON.stringify({ id: "ReadAuthorityClip", title: "Authority clip", privateProviderToken: "private-read-provider-token", rawPayload: "private-read-payload", url: "https://example.invalid/private-read-url" })]);
	const snapshot = async () => JSON.stringify((await fixture.pool.query("SELECT jsonb_build_object('overlays',(SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) FROM overlays o),'playlists',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM playlists p),'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.playlist_id,i.clip_id) FROM playlist_clips i),'retries',(SELECT count(*) FROM mcp_mutation_retries),'effects',(SELECT count(*) FROM overlay_effect_jobs)) AS state")).rows[0].state);
	const route = await import("@/app/mcp/route");
	const originalFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== origin) throw new Error("READ_AUTHORITY_EXTERNAL_IO_FORBIDDEN");
		return auth.handler(request);
	}) as typeof fetch;
	let sequence = 0;
	const outcomes: any[] = [];
	const argsFor = (name: string): Record<string, unknown> => (name === "list_creators" ? {} : { creatorId: "fixture-creator", ...(name === "get_overlay" ? { overlayId } : {}), ...(name === "get_playlist" ? { playlistId } : {}) });
	const call = async (name: string, phase: string, args = argsFor(name)) => {
		const before = await snapshot();
		const response = await route.POST(new Request(`${origin}/mcp`, { method: "POST", headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++sequence, method: "tools/call", params: { name, arguments: args } }) }));
		const text = await response.text();
		const data =
			text.startsWith("event:") || text.startsWith("data:")
				? text
						.split("\n")
						.find((line) => line.startsWith("data:"))
						?.slice(5)
						.trim()
				: text;
		const result = data ? JSON.parse(data)?.result?.structuredContent : null;
		outcomes.push({ name, phase, status: response.status, code: result?.error?.code ?? null, filtered: name === "list_creators" && result?.items?.length === 0, changed: before !== (await snapshot()), leakedData: /private-read-authority-secret|private-foreign-read-secret|private-read-provider-token|private-read-payload|private-read-url|Foreign private|Other private creator/.test(text) });
	};
	try {
		for (const phase of readAuthorityPhases) {
			const agency = phase.startsWith("agency-");
			await fixture.pool.query("UPDATE users SET plan=$1,disabled=$2 WHERE id='fixture-creator';", [phase.endsWith("free") ? "free" : "pro", phase === "creator-disabled"]);
			await fixture.pool.query("UPDATE creator_accounts SET status=$1 WHERE creator_id='fixture-creator'", [phase === "creator-suspended" ? "suspended" : "active"]);
			await fixture.pool.query("DELETE FROM auth.member WHERE id=$1", [member.id]);
			if (!agency) await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'creator-org',$2,$3,now())", [member.id, actorId, phase === "denied-role" ? "analyst" : phase === "custom-direct" ? "read-custom" : phase.startsWith("direct-") ? "operations" : "owner"]);
			await fixture.pool.query("UPDATE auth.member SET role=$1 WHERE organization_id='read-agency' AND user_id=$2", [phase === "agency-custom-role" ? "read-custom" : "operations", actorId]);
			await fixture.pool.query("UPDATE agency_creator_links SET status=$1::text::agency_creator_link_status,permission_ceiling=$2,revoked_at=CASE WHEN $1::text='revoked' THEN now() ELSE NULL END,revoked_by=CASE WHEN $1::text='revoked' THEN $3::text ELSE NULL END WHERE agency_organization_id='read-agency'", [phase === "agency-inactive" ? "revoked" : "accepted", JSON.stringify(phase === "agency-ceiling" ? ["creator:read", "overlay:read"] : MCP_SCOPES), actorId]);
			// Controlled fixture selection represents an already-approved access path;
			// actual agency consent is exercised separately by its native/browser catalogue.
			await fixture.pool.query("UPDATE mcp_grant_creators SET agency_organization_id=$1 WHERE grant_id=$2 AND creator_id='fixture-creator'", [agency ? "read-agency" : null, input.grantId]);
			for (const name of readAuthorityTools) await call(name, phase);
			async function exerciseAgencyWriteCeiling() {
				if (phase === "agency-ceiling") {
					for (const name of ["create_overlay", "update_overlay_settings", "delete_overlay", "create_playlist", "update_playlist", "delete_playlist", "add_playlist_items", "remove_playlist_items", "reorder_playlist_items"]) {
						const args: Record<string, unknown> = { creatorId: "fixture-creator" };
						if (name.startsWith("create_")) Object.assign(args, { retryKey: `read-ceiling:${name}`, name: "Forbidden creation" });
						else Object.assign(args, { expectedRevision: 1, ...(name.includes("overlay") ? { overlayId } : { playlistId }) });
						if (name === "update_overlay_settings") args.patch = { name: "Forbidden overlay edit" };
						if (name === "update_playlist") args.name = "Forbidden playlist edit";
						if (name === "add_playlist_items") args.clipIds = ["NeverFetchedClip"];
						if (["remove_playlist_items", "reorder_playlist_items"].includes(name)) args.itemIds = ["ReadAuthorityClip"];
						await call(name, "agency-ceiling-write", args);
					}
				}
			}
			await exerciseAgencyWriteCeiling();
		}
		await fixture.pool.query("UPDATE users SET plan='pro',disabled=false WHERE id='fixture-creator'; UPDATE creator_accounts SET status='active' WHERE creator_id='fixture-creator'");
		await fixture.pool.query("UPDATE auth.member SET role='owner' WHERE id=$1", [member.id]);
		await fixture.pool.query("UPDATE mcp_grant_creators SET agency_organization_id=null WHERE grant_id=$1", [input.grantId]);
		for (const name of readAuthorityTools.filter((tool) => tool !== "list_creators")) {
			await call(name, "unapproved-creator", { ...argsFor(name), creatorId: "read-other-creator", ...(name === "get_overlay" ? { overlayId: foreignOverlayId } : {}), ...(name === "get_playlist" ? { playlistId: foreignPlaylistId } : {}) });
			const missing = argsFor(name);
			delete missing.creatorId;
			await call(name, "missing-context", missing);
			await call(name, "malformed-context", { ...argsFor(name), creatorId: "../read-other-creator" });
		}
		await call("get_overlay", "foreign-resource", { creatorId: "fixture-creator", overlayId: foreignOverlayId });
		await call("get_playlist", "foreign-resource", { creatorId: "fixture-creator", playlistId: foreignPlaylistId });
		await fixture.pool.query("DELETE FROM mcp_grant_creators WHERE grant_id=$1", [input.grantId]);
		for (const name of readAuthorityTools) await call(name, "empty-selection");
		return { outcomes };
	} finally {
		globalThis.fetch = originalFetch;
	}
}
