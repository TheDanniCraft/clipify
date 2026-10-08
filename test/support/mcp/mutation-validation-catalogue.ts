import type { createMcpPostgresFixture } from "./postgres";

export const mutationValidationTools = ["create_overlay", "update_overlay_settings", "delete_overlay", "create_playlist", "update_playlist", "delete_playlist", "add_playlist_items", "remove_playlist_items", "reorder_playlist_items"] as const;
export const mutationValidationClasses = ["unknown-field", "invalid-identifier", "wrong-type", "out-of-range"] as const;

export async function runMutationValidationCatalogue(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; auth: any; origin: string; token: string }) {
	const { fixture, origin, auth } = input;
	const overlayId = "79e6c5a3-5368-4813-9780-49d22d99175f";
	const playlistId = "a1dca8b8-089a-47ce-b649-1c32bb3842c1";
	await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
	await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','private-validation-overlay-secret','Validation overlay','active','Featured')", [overlayId]);
	await fixture.pool.query("INSERT INTO playlists(id,owner_id,name) VALUES($1,'fixture-creator','Validation playlist')", [playlistId]);
	await fixture.pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) VALUES($1,'ValidationClip',0,$2)", [playlistId, JSON.stringify({ id: "ValidationClip", title: "Validation clip", duration: 10 })]);
	const snapshot = async () => {
		const result = await fixture.pool.query("SELECT jsonb_build_object('overlays',(SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) FROM overlays o),'playlists',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM playlists p),'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.playlist_id,i.clip_id) FROM playlist_clips i),'retries',(SELECT count(*) FROM mcp_mutation_retries),'effects',(SELECT count(*) FROM overlay_effect_jobs)) AS state");
		return JSON.stringify(result.rows[0].state);
	};
	const baseline = await snapshot();
	const route = await import("@/app/mcp/route");
	const originalFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== origin) throw new Error("VALIDATION_CATALOGUE_EXTERNAL_IO_FORBIDDEN");
		return auth.handler(request);
	}) as typeof fetch;
	let id = 0;
	const call = async (name: string, args: Record<string, unknown>) => {
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
		return { status: response.status, body: data ? JSON.parse(data) : null };
	};
	try {
		const control = await call("get_overlay", { creatorId: "fixture-creator", overlayId });
		const outcomes = [];
		for (const name of mutationValidationTools) {
			function buildValidMutationArguments() {
				const base: Record<string, unknown> = { creatorId: "fixture-creator" };
				if (name.startsWith("create_")) Object.assign(base, { retryKey: "validation-key", name: "Valid name" });
				else Object.assign(base, { expectedRevision: 1, ...(name.includes("overlay") ? { overlayId } : { playlistId }) });
				if (name === "update_overlay_settings") base.patch = { name: "Valid edited name" };
				if (name === "update_playlist") base.name = "Valid edited name";
				if (name === "add_playlist_items") base.clipIds = ["NewValidClip"];
				if (["remove_playlist_items", "reorder_playlist_items"].includes(name)) base.itemIds = ["ValidationClip"];
				return { base };
			}
			const { base } = buildValidMutationArguments();
			for (const boundary of mutationValidationClasses) {
				function buildInvalidMutationArguments() {
					const args = structuredClone(base);
					if (boundary === "unknown-field") args.unapprovedSetting = true;
					if (boundary === "invalid-identifier") args.creatorId = "invalid creator!";
					if (boundary === "wrong-type") args.creatorId = 42;
					if (boundary === "out-of-range") {
						if (name.startsWith("create_")) args.retryKey = "x".repeat(129);
						else args.expectedRevision = 0;
					}
					return { args };
				}
				const { args } = buildInvalidMutationArguments();
				const result = await call(name, args);
				outcomes.push({ name, boundary, status: result.status, code: result.body?.result?.structuredContent?.error?.code, isError: result.body?.result?.isError, unchanged: (await snapshot()) === baseline });
			}
		}
		const itemOutcomes = [];
		for (const [name, boundary, itemIds] of [
			["remove_playlist_items", "unknown-item", ["MissingClip"]],
			["remove_playlist_items", "mixed-known-unknown", ["ValidationClip", "MissingClip"]],
			["remove_playlist_items", "duplicate-item", ["ValidationClip", "ValidationClip"]],
			["reorder_playlist_items", "missing-item", []],
			["reorder_playlist_items", "extra-item", ["ValidationClip", "MissingClip"]],
			["reorder_playlist_items", "replaced-item", ["MissingClip"]],
			["reorder_playlist_items", "duplicate-item", ["ValidationClip", "ValidationClip"]],
		] as const) {
			const result = await call(name, { creatorId: "fixture-creator", playlistId, expectedRevision: 1, itemIds });
			itemOutcomes.push({ name, boundary, status: result.status, code: result.body?.result?.structuredContent?.error?.code, isError: result.body?.result?.isError, unchanged: (await snapshot()) === baseline });
		}
		return { control: { status: control.status, name: control.body?.result?.structuredContent?.overlay?.name }, outcomes, itemOutcomes };
	} finally {
		globalThis.fetch = originalFetch;
	}
}
