import { randomUUID } from "node:crypto";
import type { createMcpPostgresFixture } from "./postgres";
import { revokeMcpConnection, listMcpConnections } from "@/server/mcp/connections";
type Fixture = Awaited<ReturnType<typeof createMcpPostgresFixture>>;
export async function runRevocationCatalogue(input: { fixture: Fixture; auth: any; origin: string; headers: Headers; token: string; claims: Record<string, any> }) {
	const { fixture, auth, origin } = input;
	const grantId = input.claims.clipify_grant_id;
	const route = await import("@/app/mcp/route");
	const originalFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== origin) throw new Error("Unexpected revocation fixture external I/O");
		return auth.handler(request);
	}) as typeof fetch;
	const read = async () => {
		const response = await route.POST(new Request(origin + "/mcp", { method: "POST", headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_creators", arguments: {} } }) }));
		await response.text();
		return response.status;
	};
	const state = async () => (await fixture.pool.query("SELECT active,revoked_at IS NOT NULL AS revoked FROM mcp_connection_grants WHERE id=$1", [grantId])).rows[0];
	const revoke = (headers = input.headers, id = grantId) => revokeMcpConnection({ auth, origin, headers, grantId: id, client: fixture.db });
	try {
		const denied = [];
		for (const name of ["missing-origin", "foreign-origin", "missing-cookie", "invalid-id", "unknown-id"]) {
			const headers = new Headers(input.headers);
			if (name === "missing-origin") headers.delete("Origin");
			if (name === "foreign-origin") headers.set("Origin", "https://foreign.example.invalid");
			if (name === "missing-cookie") headers.delete("Cookie");
			const response = await revoke(headers, name === "invalid-id" ? "invalid" : name === "unknown-id" ? randomUUID() : grantId);
			denied.push({ name, status: response.status, state: await state() });
		}
		const foreignId = randomUUID();
		await fixture.pool.query("INSERT INTO auth.\"user\"(id,name,email,email_verified,created_at,updated_at) VALUES('foreign-actor','Foreign','foreign@example.invalid',true,now(),now())");
		await fixture.pool.query("INSERT INTO mcp_connection_grants(id,auth_user_id,client_id,resource,issuer,scopes,active,expires_at) VALUES($1,'foreign-actor',$2,$3,$4,ARRAY['creator:read'],true,now()+interval '1 day')", [foreignId, input.claims.azp ?? input.claims.client_id, origin + "/mcp", origin + "/api/auth"]);
		const foreignResponse = await revoke(input.headers, foreignId);
		const foreignState = (await fixture.pool.query("SELECT active,revoked_at IS NOT NULL AS revoked FROM mcp_connection_grants WHERE id=$1", [foreignId])).rows[0];
		await fixture.pool.query("CREATE FUNCTION reject_grant_revoke() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled revoke failure'; END $$; CREATE TRIGGER reject_grant_revoke BEFORE UPDATE ON mcp_connection_grants FOR EACH ROW EXECUTE FUNCTION reject_grant_revoke()");
		const failed = await revoke();
		const failedState = await state();
		const failedRead = await read();
		await fixture.pool.query("DROP TRIGGER reject_grant_revoke ON mcp_connection_grants");
		const blocker = await fixture.pool.connect();
		let pending: Promise<Response> | undefined;
		let blocked = false;
		let pendingState;
		try {
			await blocker.query("BEGIN");
			await blocker.query("SELECT id FROM mcp_connection_grants WHERE id=$1 FOR UPDATE", [grantId]);
			pending = revoke();
			const deadline = performance.now() + 5000;
			while (performance.now() < deadline) {
				const wait = await fixture.pool.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%mcp_connection_grants%' AND pid<>pg_backend_pid()");
				if (wait.rows[0].count > 0) {
					blocked = true;
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
			pendingState = await state();
			await fixture.pool.query("CREATE FUNCTION reject_provider_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled provider cleanup failure'; END $$; CREATE TRIGGER reject_provider_cleanup BEFORE DELETE ON auth.oauth_refresh_token FOR EACH ROW EXECUTE FUNCTION reject_provider_cleanup()");
		} finally {
			await blocker.query("ROLLBACK");
			blocker.release();
		}
		const cleanup = await pending!;
		const cleanupBody = await cleanup.json();
		const afterCleanupFailure = await state();
		const revokedRead = await read();
		const remainingRefresh = (await fixture.pool.query("SELECT count(*)::int AS count FROM auth.oauth_refresh_token WHERE reference_id=$1", [grantId])).rows[0].count;
		await fixture.pool.query("DROP TRIGGER reject_provider_cleanup ON auth.oauth_refresh_token");
		const retried = await revoke();
		const retryBody = await retried.json();
		const retryRead = await read();
		const remainingAfterRetry = (await fixture.pool.query("SELECT count(*)::int AS count FROM auth.oauth_refresh_token WHERE reference_id=$1", [grantId])).rows[0].count;
		const listed = await listMcpConnections({ auth, headers: input.headers, client: fixture.db });
		return {
			denied,
			foreign: { status: foreignResponse.status, state: foreignState },
			failure: { status: failed.status, state: failedState, read: failedRead },
			blocked,
			pendingState,
			cleanup: { status: cleanup.status, body: cleanupBody, state: afterCleanupFailure, read: revokedRead, remainingRefresh },
			retry: { status: retried.status, body: retryBody, read: retryRead, remainingRefresh: remainingAfterRetry },
			listed: listed.map((row) => ({ active: row.active, revoked: row.revokedAt !== null })),
		};
	} finally {
		globalThis.fetch = originalFetch;
	}
}
