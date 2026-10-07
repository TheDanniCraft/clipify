import { randomUUID } from "node:crypto";
import type { createMcpPostgresFixture } from "./postgres";

/** Controlled approved target population; provider consent itself has separate native evidence. */
export async function runPaginationCatalogue(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; auth: any; origin: string; token: string; actorId: string; grantId: string }) {
	const { fixture, auth, origin } = input;
	await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
	for (let index = 0; index < 99; index++) {
		const suffix = String(index).padStart(3, "0"),
			creatorId = `page-${suffix}`,
			org = `page-org-${suffix}`;
		await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES($1,$2,$1,now())", [org, `Creator ${suffix}`]);
		await fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES($1,$2,$1,'','user','pro')", [creatorId, `${creatorId}@example.invalid`]);
		await fixture.pool.query("INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES($1,$2,'active')", [creatorId, org]);
		await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,$2,$3,'owner',now())", [randomUUID(), org, input.actorId]);
		await fixture.pool.query("INSERT INTO mcp_grant_creators(grant_id,creator_id) VALUES($1,$2)", [input.grantId, creatorId]);
	}
	const overlayIds = [],
		playlistIds = [];
	for (let index = 0; index < 101; index++) {
		const overlayId = randomUUID(),
			playlistId = randomUUID();
		overlayIds.push(overlayId);
		playlistIds.push(playlistId);
		await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','private-page-overlay-secret','Overlay','active','Featured')", [overlayId]);
		await fixture.pool.query("INSERT INTO playlists(id,owner_id,name) VALUES($1,'fixture-creator','Playlist')", [playlistId]);
	}
	const route = await import("@/app/mcp/route");
	const originalFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== origin) throw new Error("PAGINATION_CATALOGUE_EXTERNAL_IO_FORBIDDEN");
		return auth.handler(request);
	}) as typeof fetch;
	let sequence = 0;
	const call = async (name: string, args: Record<string, unknown>) => {
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
		const result = text ? JSON.parse(text)?.result?.structuredContent : null;
		return { status: response.status, result, safe: !wire.includes(input.token) && !wire.includes("private-page-overlay-secret") && !/"(?:secret|access_token|refresh_token|ownerId)"\s*:/.test(wire) };
	};
	try {
		const { encodePageCursor } = await import("@/server/mcp/pagination");
		const grant = (await fixture.pool.query("SELECT generation FROM mcp_connection_grants WHERE id=$1", [input.grantId])).rows[0];
		const outcomes = [],
			invalid = [],
			boundaries = [];
		const cursors = new Map<string, string>();
		for (const name of ["list_creators", "list_overlays", "list_playlists"]) {
			const base = name === "list_creators" ? {} : { creatorId: "fixture-creator" };
			const expected = name === "list_creators" ? ["fixture-creator", ...Array.from({ length: 99 }, (_, index) => `page-${String(index).padStart(3, "0")}`)].sort() : [...(name === "list_overlays" ? overlayIds : playlistIds)].sort();
			const pages = [];
			let cursor: string | undefined;
			do {
				const response = await call(name, { ...base, ...(cursor ? { cursor } : {}) });
				if (!response.result?.items) throw new Error("Pagination catalogue lost valid page");
				pages.push({ ids: response.result.items.map((item: any) => item.id), cursor: response.result.nextCursor, safe: response.safe });
				cursor = response.result.nextCursor ?? undefined;
				if (cursor && !cursors.has(name)) cursors.set(name, cursor);
			} while (cursor && pages.length < 10);
			outcomes.push({ name, expected, pages });
			for (const limit of [1, 100]) {
				const first = await call(name, { ...base, limit });
				const second = first.result?.nextCursor ? await call(name, { ...base, limit, cursor: first.result.nextCursor }) : null;
				boundaries.push({ name, limit, first, second });
			}
			const context = name === "list_creators" ? `${input.grantId}:${grant.generation}:list_creators` : `${input.grantId}:${grant.generation}:${input.actorId}:${name}:fixture-creator`;
			for (const [mode, cursor] of [
				["expired", encodePageCursor(expected[0], context, { now: new Date(Date.now() - 1800000) })],
				["other-grant", encodePageCursor(expected[0], context.replace(input.grantId, randomUUID()))],
			] as const) {
				const response = await call(name, { ...base, cursor });
				invalid.push({ name, mode, error: response.result?.error?.code, safe: response.safe });
			}
			for (const [mode, patch] of [
				["zero", { limit: 0 }],
				["oversized", { limit: 101 }],
				["fractional", { limit: 1.5 }],
				["typed-limit", { limit: "25" }],
				["malformed", { cursor: "invalid" }],
				["tampered", { cursor: cursors.get(name)!.slice(0, -5) + "XXXXX" }],
				["unknown", { privateAuthority: "never disclose" }],
			] as const) {
				const response = await call(name, { ...base, ...patch });
				invalid.push({ name, mode, error: response.result?.error?.code, safe: response.safe });
			}
		}
		for (const name of ["list_overlays", "list_playlists"]) {
			const other = name === "list_overlays" ? "list_playlists" : "list_overlays";
			const response = await call(name, { creatorId: "fixture-creator", cursor: cursors.get(other) });
			invalid.push({ name, mode: "other-tool", error: response.result?.error?.code, safe: response.safe });
			const changedCreator = await call(name, { creatorId: "page-000", cursor: cursors.get(name) });
			invalid.push({ name, mode: "other-creator", error: changedCreator.result?.error?.code, safe: changedCreator.safe });
			const empty = await call(name, { creatorId: "page-000" });
			boundaries.push({ name, limit: 0, first: empty, second: null });
		}
		await fixture.pool.query("DELETE FROM auth.member WHERE organization_id='page-org-000'");
		const current = await call("list_creators", { limit: 100 });
		return { outcomes, invalid, boundaries, removedCreatorAbsent: !current.result?.items?.some((item: any) => item.id === "page-000"), currentCount: current.result?.items?.length };
	} finally {
		globalThis.fetch = originalFetch;
	}
}
