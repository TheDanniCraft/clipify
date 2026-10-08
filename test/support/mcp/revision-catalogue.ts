import { randomUUID } from "node:crypto";
import type { createMcpPostgresFixture } from "./postgres";

export async function runRevisionCatalogue(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; auth: any; origin: string; token: string; cookie: string }) {
	const { fixture, auth, origin } = input;
	const overlayId = randomUUID(),
		playlistId = randomUUID();
	await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
	await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','private-revision-overlay-secret','Initial','active','Featured');", [overlayId]);
	await fixture.pool.query("INSERT INTO playlists(id,owner_id,name) VALUES($1,'fixture-creator','Initial')", [playlistId]);
	await fixture.pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) VALUES($1,'ClipA',0,$2),($1,'ClipB',1,$3)", [playlistId, JSON.stringify({ id: "ClipA", title: "A", duration: 10 }), JSON.stringify({ id: "ClipB", title: "B", duration: 10 })]);
	const route = await import("@/app/mcp/route");
	const { saveBrowserOverlay } = await import("@/server/resources/browser-overlays");
	const { saveBrowserPlaylist, reorderBrowserPlaylist } = await import("@/server/resources/browser-playlists");
	const headers = new Headers({ Cookie: input.cookie, Origin: origin });
	const originalFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== origin) throw new Error("REVISION_CATALOGUE_EXTERNAL_IO_FORBIDDEN");
		return auth.handler(request);
	}) as typeof fetch;
	let sequence = 0;
	const reset = async () => {
		await fixture.pool.query("UPDATE overlays SET name='Initial',configuration_revision=1 WHERE id=$1", [overlayId]);
		await fixture.pool.query("UPDATE playlists SET name='Initial',configuration_revision=1 WHERE id=$1", [playlistId]);
		await fixture.pool.query("UPDATE playlist_clips SET position=position+10 WHERE playlist_id=$1", [playlistId]);
		await fixture.pool.query("UPDATE playlist_clips SET position=CASE clip_id WHEN 'ClipA' THEN 0 ELSE 1 END WHERE playlist_id=$1", [playlistId]);
	};
	const state = async () => {
		const overlay = (await fixture.pool.query("SELECT name,configuration_revision FROM overlays WHERE id=$1", [overlayId])).rows[0];
		const playlist = (await fixture.pool.query("SELECT name,configuration_revision FROM playlists WHERE id=$1", [playlistId])).rows[0];
		const items = (await fixture.pool.query("SELECT clip_id,position FROM playlist_clips WHERE playlist_id=$1 ORDER BY position", [playlistId])).rows;
		const counts = (await fixture.pool.query("SELECT (SELECT count(*) FROM audit_events WHERE outcome='success')::int AS audits,(SELECT count(*) FROM mcp_mutation_retries)::int AS retries,(SELECT count(*) FROM overlay_effect_jobs)::int AS effects")).rows[0];
		return { overlay, playlist, items, counts };
	};
	const call = async (resource: string, writer: string, revision: any, value: string) => {
		if (writer === "browser") {
			const result = resource === "overlay" ? await saveBrowserOverlay(overlayId, { name: value }, revision, headers) : resource === "playlist" ? await saveBrowserPlaylist(playlistId, { name: value }, revision, headers) : await reorderBrowserPlaylist(playlistId, value === "First" ? ["ClipB", "ClipA"] : ["ClipA", "ClipB"], revision, headers);
			return { success: !!result, error: result ? null : "BROWSER_REJECTED" };
		}
		const name = resource === "overlay" ? "update_overlay_settings" : resource === "playlist" ? "update_playlist" : "reorder_playlist_items";
		const args = resource === "overlay" ? { creatorId: "fixture-creator", overlayId, expectedRevision: revision, patch: { name: value } } : resource === "playlist" ? { creatorId: "fixture-creator", playlistId, expectedRevision: revision, name: value } : { creatorId: "fixture-creator", playlistId, expectedRevision: revision, itemIds: value === "First" ? ["ClipB", "ClipA"] : ["ClipA", "ClipB"] };
		const response = await route.POST(new Request(origin + "/mcp", { method: "POST", headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++sequence, method: "tools/call", params: { name, arguments: args } }) }));
		const wire = await response.text();
		const text =
			wire.startsWith("event:") || wire.startsWith("data:")
				? wire
						.split("\n")
						.find((line) => line.startsWith("data:"))
						?.slice(5)
						.trim()
				: wire;
		const result = text ? JSON.parse(text)?.result : undefined;
		return { success: response.ok && !!result && !result.isError, error: result?.structuredContent?.error?.code ?? null };
	};
	try {
		const transitions = [],
			races = [],
			rollbacks = [],
			invalid = [];
		for (const resource of ["overlay", "playlist", "playlist items"]) {
			for (const first of ["browser", "MCP"])
				for (const second of ["browser", "MCP"]) {
					await reset();
					const committed = await call(resource, first, 1, "First");
					const beforeStale = await state();
					const rejected = await call(resource, second, 1, "Second");
					const afterStale = await state();
					const fresh = await call(resource, second, 2, "Second");
					transitions.push({ resource, first, second, committed, rejected, fresh, beforeStale, afterStale, afterFresh: await state() });
				}
			await reset();
			const responses = await Promise.all([call(resource, "MCP", 1, "First"), call(resource, "MCP", 1, "Second")]);
			races.push({ resource, responses, state: await state() });
			for (const writer of ["browser", "MCP"]) {
				await reset();
				await fixture.pool.query("CREATE FUNCTION reject_revision_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled revision audit failure'; END $$; CREATE TRIGGER reject_revision_audit BEFORE INSERT ON audit_events FOR EACH ROW WHEN (NEW.outcome='success') EXECUTE FUNCTION reject_revision_audit()");
				const before = await state();
				let result;
				try {
					result = await call(resource, writer, 1, "First");
				} catch {
					result = { success: false, error: "BROWSER_REJECTED" };
				}
				rollbacks.push({ resource, writer, result, unchanged: JSON.stringify(await state()) === JSON.stringify(before) });
				await fixture.pool.query("DROP TRIGGER reject_revision_audit ON audit_events; DROP FUNCTION reject_revision_audit()");
				for (const revision of [undefined, "1"]) {
					const before = await state();
					const result = await call(resource, writer, revision, "First");
					invalid.push({ resource, writer, mode: revision === undefined ? "missing" : "malformed", result, unchanged: JSON.stringify(await state()) === JSON.stringify(before) });
				}
			}
		}
		return { transitions, races, rollbacks, invalid };
	} finally {
		globalThis.fetch = originalFetch;
	}
}
