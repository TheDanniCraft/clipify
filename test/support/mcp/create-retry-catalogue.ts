import type { createMcpPostgresFixture } from "./postgres";

export async function runCreateRetryCatalogue(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; auth: any; origin: string; token: string; actorId: string; grantId: string }) {
	const { fixture, auth, origin } = input;
	await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
	const route = await import("@/app/mcp/route");
	const originalFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== origin) throw new Error("RETRY_CATALOGUE_EXTERNAL_IO_FORBIDDEN");
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
		const body = text ? JSON.parse(text) : null;
		return { status: response.status, result: body?.result?.structuredContent, error: body?.result?.structuredContent?.error?.code, safe: !wire.includes(input.token) && !/"(?:secret|access_token|refresh_token|ownerId)"\s*:/.test(wire) };
	};
	const snapshot = async () => (await fixture.pool.query("SELECT (SELECT count(*) FROM overlays)::int AS overlays,(SELECT count(*) FROM playlists)::int AS playlists,(SELECT count(*) FROM mcp_mutation_retries)::int AS retries,(SELECT count(*) FROM audit_events WHERE outcome='success')::int AS audits")).rows[0];
	const outcomes: Record<string, unknown>[] = [];
	try {
		for (const kind of ["overlay", "playlist"] as const) {
			const table = kind === "overlay" ? "overlays" : "playlists";
			for (const mode of ["lost-response", "concurrent", "conflict", "expired", "rollback", "deleted", "removed-member", "before-expiry", "expiry-boundary", "role-change", "plan-change", "suspended", "revoked-grant", "expired-grant"] as const) {
				const args = { creatorId: "fixture-creator", retryKey: `${kind}-${mode}`, name: "Retained safe result" };
				const before = await snapshot();
				if (mode === "rollback") await fixture.pool.query("CREATE FUNCTION reject_retry_catalogue_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled retry audit failure'; END $$; CREATE TRIGGER reject_retry_catalogue_audit BEFORE INSERT ON audit_events FOR EACH ROW WHEN (NEW.outcome='success') EXECUTE FUNCTION reject_retry_catalogue_audit()");
				const first = mode === "concurrent" ? await Promise.all([call(`create_${kind}`, args), call(`create_${kind}`, args)]) : [await call(`create_${kind}`, args)];
				const firstState = await snapshot();
				if (mode === "rollback") await fixture.pool.query("DROP TRIGGER reject_retry_catalogue_audit ON audit_events; DROP FUNCTION reject_retry_catalogue_audit()");
				const initialId = first[0].result?.[kind]?.id ?? first[0].result?.id;
				async function mutateRetryAuthority() {
					if (mode === "before-expiry") await fixture.pool.query("UPDATE mcp_mutation_retries SET created_at=now()-interval '24 hours'+interval '1 minute',expires_at=now()+interval '1 minute' WHERE retry_key=$1", [args.retryKey]);
					if (mode === "expiry-boundary") await fixture.pool.query("UPDATE mcp_mutation_retries SET created_at=now()-interval '24 hours',expires_at=now() WHERE retry_key=$1", [args.retryKey]);
					if (mode === "role-change") await fixture.pool.query("UPDATE auth.member SET role='analyst' WHERE user_id=$1", [input.actorId]);
					if (mode === "plan-change") {
						await fixture.pool.query("UPDATE auth.member SET role='operations' WHERE user_id=$1", [input.actorId]);
						await fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
					}
					if (mode === "suspended") await fixture.pool.query("UPDATE creator_accounts SET status='suspended' WHERE creator_id='fixture-creator'");
					if (mode === "revoked-grant") await fixture.pool.query("UPDATE mcp_connection_grants SET active=false,revoked_at=now() WHERE id=$1", [input.grantId]);
					if (mode === "expired-grant") await fixture.pool.query("UPDATE mcp_connection_grants SET expires_at=now()-interval '1 second' WHERE id=$1", [input.grantId]);
					if (mode === "expired") await fixture.pool.query("UPDATE mcp_mutation_retries SET created_at=now()-interval '25 hours',expires_at=now()-interval '1 hour' WHERE retry_key=$1", [args.retryKey]);
					if (mode === "deleted") await fixture.pool.query(`DELETE FROM ${table} WHERE id=$1`, [initialId]);
				}
				await mutateRetryAuthority();
				const members = mode === "removed-member" ? (await fixture.pool.query("DELETE FROM auth.member WHERE user_id=$1 RETURNING *", [input.actorId])).rows : [];
				const second = mode === "concurrent" ? first[1] : await call(`create_${kind}`, mode === "conflict" ? { ...args, name: "Different intent" } : args);
				const after = await snapshot();
				async function collectRetryOutcome() {
					if (["revoked-grant", "expired-grant"].includes(mode)) await fixture.pool.query("UPDATE mcp_connection_grants SET active=true,revoked_at=null,expires_at=now()+interval '30 days' WHERE id=$1", [input.grantId]);
					if (["role-change", "plan-change"].includes(mode)) {
						await fixture.pool.query("UPDATE auth.member SET role='owner' WHERE user_id=$1", [input.actorId]);
						await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
					}
					if (mode === "suspended") await fixture.pool.query("UPDATE creator_accounts SET status='active' WHERE creator_id='fixture-creator'");
					for (const member of members) await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,$2,$3,$4,$5)", [member.id, member.organization_id, member.user_id, member.role, member.created_at]);
					const secondId = second.result?.[kind]?.id ?? second.result?.id;
					const retained = (await fixture.pool.query("SELECT safe_response,expires_at-created_at>=interval '24 hours' AS retained FROM mcp_mutation_retries WHERE retry_key=$1", [args.retryKey])).rows[0];
					outcomes.push({ kind, mode, before, firstState, after, firstStatus: first[0].status, secondStatus: second.status, firstError: first[0].error ?? null, secondError: second.error ?? null, initialId: initialId ?? null, secondId: secondId ?? null, safe: [...first, second].every((value) => value.safe) && !/"(?:secret|access_token|refresh_token|ownerId)"\s*:/.test(JSON.stringify(retained?.safe_response)), retained: retained?.retained ?? null });
				}
				await collectRetryOutcome();
			}
		}
		const invalidKeys = [];
		for (const kind of ["overlay", "playlist"]) {
			for (const key of [undefined, "", "x".repeat(129)]) {
				const before = await snapshot();
				const result = await call(`create_${kind}`, { creatorId: "fixture-creator", name: "Invalid retry", ...(key !== undefined ? { retryKey: key } : {}) });
				invalidKeys.push({ kind, mode: key === undefined ? "missing" : key === "" ? "empty" : "oversized", error: result.error, safe: result.safe, unchanged: JSON.stringify(await snapshot()) === JSON.stringify(before) });
			}
		}
		return { outcomes, invalidKeys };
	} finally {
		globalThis.fetch = originalFetch;
	}
}
