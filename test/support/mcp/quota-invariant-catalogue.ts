import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import type { createMcpPostgresFixture } from "./postgres";

export async function runQuotaInvariantCatalogue(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; auth: { handler: (request: Request) => Promise<Response> }; origin: string; token: string; cookie: string; actorId: string; mode: string }) {
	const { fixture, origin } = input;
	const { RequestCookies } = createRequire(process.cwd() + "/package.json")("next/dist/compiled/@edge-runtime/cookies");
	const storage = new AsyncLocalStorage<{ headers: Headers; cookies: unknown }>();
	Reflect.set(globalThis, Symbol.for("next-ws.request-store"), storage);
	const headers = new Headers({ Cookie: input.cookie, Origin: origin });
	const actions = await import("@/app/actions/database");
	const route = await import("@/app/mcp/route");
	const browserCreate = (creatorId = "fixture-creator") => storage.run({ headers, cookies: new RequestCookies(headers) }, () => actions.createOverlayWithFeedback(creatorId));
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (async (value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== origin) throw new Error("QUOTA_INVARIANT_EXTERNAL_IO_FORBIDDEN");
		return input.auth.handler(request);
	}) as typeof fetch;
	const counts = async () => (await fixture.pool.query("SELECT (SELECT count(*) FROM overlays WHERE owner_id='fixture-creator')::int AS resources,(SELECT count(*) FROM mcp_mutation_retries)::int AS retries,(SELECT count(*) FROM audit_events WHERE outcome='success')::int AS successful_audits")).rows[0];
	const mcpCreate = async (retryKey: string) => {
		const response = await route.POST(new Request(origin + "/mcp", { method: "POST", headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_overlay", arguments: { creatorId: "fixture-creator", retryKey, name: "Invariant overlay" } } }) }));
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
		return { status: response.status, success: response.ok && Boolean(result) && !result.isError, code: result?.structuredContent?.error?.code ?? null };
	};
	try {
		if (input.mode === "rollback") {
			await fixture.pool.query("CREATE FUNCTION reject_quota_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private quota insert failure'; END $$; CREATE TRIGGER reject_quota_insert BEFORE INSERT ON overlays FOR EACH ROW EXECUTE FUNCTION reject_quota_insert()");
			const first = await mcpCreate("retry-after-failed-insert");
			const rolledBack = await counts();
			await fixture.pool.query("DROP TRIGGER reject_quota_insert ON overlays; DROP FUNCTION reject_quota_insert()");
			const retry = await mcpCreate("retry-after-failed-insert");
			return { first, rolledBack, retry, final: await counts() };
		}
		if (input.mode === "delete-create") {
			const first = await browserCreate();
			if (!first.overlay) throw new Error("Quota deletion fixture creation failed");
			const [deleted, created] = await Promise.all([storage.run({ headers, cookies: new RequestCookies(headers) }, () => actions.deleteOverlay(first.overlay!.id, 1)), mcpCreate("concurrent-delete-create")]);
			return { deleted, created, final: await counts(), originalPresent: Boolean((await fixture.pool.query("SELECT id FROM overlays WHERE id=$1", [first.overlay.id])).rowCount) };
		}
		if (input.mode !== "isolation") throw new Error("Invalid quota invariant mode");
		await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('independent-org','Independent creator','independent-org',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('independent-creator','independent@example.invalid','Independent','','user','free'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('independent-creator','independent-org','active')");
		await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'independent-org',$2,'owner',now())", [randomUUID(), input.actorId]);
		const blocker = await fixture.pool.connect();
		let pending: ReturnType<typeof browserCreate> | undefined;
		try {
			await blocker.query("BEGIN");
			await blocker.query("SELECT creator_id FROM creator_accounts WHERE creator_id='fixture-creator' FOR UPDATE");
			pending = browserCreate();
			let completed = false;
			pending.then(() => {
				completed = true;
			});
			const deadline = Date.now() + 3000;
			let reached = false;
			while (Date.now() < deadline) {
				const waiting = await fixture.pool.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%creator_accounts%') AS reached");
				if (waiting.rows[0].reached) {
					reached = true;
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 20));
			}
			if (!reached) throw new Error("Creator lock fixture did not reach its lock wait");
			const independent = await browserCreate("independent-creator");
			const blockedStillPending = !completed;
			await blocker.query("ROLLBACK");
			const released = await pending;
			return { reached, blockedStillPending, independentCreated: Boolean(independent.overlay), releasedCreated: Boolean(released.overlay), firstCreatorCount: (await counts()).resources, independentCount: Number((await fixture.pool.query("SELECT count(*) FROM overlays WHERE owner_id='independent-creator'")).rows[0].count) };
		} finally {
			await blocker.query("ROLLBACK");
			if (pending) await pending;
			blocker.release();
		}
	} finally {
		globalThis.fetch = originalFetch;
	}
}
