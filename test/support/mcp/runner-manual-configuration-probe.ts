import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import { usersTable, runnersTable } from "@/db/schema";
import { runRunnerFreeProProbe } from "./runner-free-pro-probe";

function manualScenario(variant: string) {
	const invalidFallback = variant === "manual_fallback_scheduled_invalid";
	const proScheduled = ["manual_pro_clip_scheduled", "manual_existing_scheduled_fallback"].includes(variant);
	const scheduled = variant === "manual_scheduled_denied" || invalidFallback || proScheduled;
	const mode = variant === "manual_invalid_behavior" ? "invalid-mode" : scheduled && !invalidFallback ? "24/7" : "failsafe";
	return { invalidFallback, proScheduled, scheduled, mode };
}

async function observeBusinessDenial(input: Parameters<typeof runRunnerFreeProProbe>[0], runnerId: string, overlayId: string, mode: string) {
	let businessDenialReturned: boolean | undefined;
	let businessDenialThrownCode: string | null = null;
	if (input.variant === "manual_scheduled_denied") {
		const { configureStreamSession } = await import("@/server/resources/runners");
		try {
			const denial = await configureStreamSession({ kind: "session", authUserId: input.actorId, sessionId: "fixture-controlled-session", authenticatedAt: new Date(), organizationId: "creator-org" }, { creatorId: "fixture-creator", runnerId, overlayId, mode, controlMode: "scheduled", destination: "twitch", resolution: "720p", fps: 30, retryKey: "manual-direct-scheduling-denial" }, input.fixture.db);
			businessDenialReturned = (denial.error as { code?: string } | undefined)?.code === "FEATURE_RESTRICTED";
		} catch (error) {
			businessDenialReturned = false;
			businessDenialThrownCode = error instanceof Error ? error.message : "UNKNOWN";
		}
	}
	return { businessDenialReturned, businessDenialThrownCode };
}

function manualConfigurationPayload(mcp: { id?: unknown; configurationRevision?: unknown } | undefined, runnerId: string, overlayId: string, mode: string, scheduled: boolean, key: string) {
	return { id: typeof mcp?.id === "string" ? mcp.id : undefined, expectedRevision: typeof mcp?.configurationRevision === "number" ? mcp.configurationRevision : undefined, ownerId: "fixture-creator", runnerId, overlayId, mode: mode as import("@/app/lib/types").StreamMode, controlMode: scheduled ? ("scheduled" as const) : ("manual" as const), streamKey: key, rtmpUrl: "rtmp://live.twitch.tv/app", resolution: "720p", fps: 30 };
}

export async function runRunnerManualConfigurationProbe(input: Parameters<typeof runRunnerFreeProProbe>[0]) {
	const previousFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== input.origin) throw new Error("RUNNER_FIXTURE_EXTERNAL_IO_FORBIDDEN");
		return input.auth.handler(request);
	}) as typeof fetch;
	try {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
		if (input.variant.startsWith("manual_ingest_")) return await runManualIngestProbe(input);
		if (input.variant.startsWith("manual_commit_")) return await runManualCommitProbe(input);
		const runnerId = randomUUID(),
			overlayId = randomUUID(),
			key = "private-manual-fallback-key";
		const { invalidFallback, proScheduled, scheduled, mode } = manualScenario(input.variant);
		await input.fixture.pool.query("UPDATE users SET plan=$1 WHERE id='fixture-creator'", [invalidFallback || proScheduled ? "pro" : "free"]);
		await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at,protocol_version,capabilities) VALUES($1,'fixture-creator','Manual fixture',$2,'online',now(),2,$3::jsonb)", [runnerId, randomUUID(), JSON.stringify(["admissions", "drain", "runner_presentation", "free_lease"])]);
		await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','manual-source-secret','Manual source','active','Featured')", [overlayId]);
		const { call } = await runRunnerFreeProProbe(input);
		const { businessDenialReturned, businessDenialThrownCode } = await observeBusinessDenial(input, runnerId, overlayId, mode);
		const capability = await call("get_capabilities", {});
		const configured = await call("configure_stream_session", { runnerId, overlayId, mode, controlMode: scheduled ? "scheduled" : "manual", destination: "twitch", resolution: "720p", fps: 30, retryKey: "manual-fallback-configuration" });
		const mcp = configured.result?.structuredContent;
		const { auth } = await import("@/auth/config");
		const context = await auth.$context;
		const session = await context.internalAdapter.createSession(input.actorId, false, { activeOrganizationId: "creator-org" }, true);
		if (!session || typeof context.secret !== "string") throw new Error("RUNNER_FIXTURE_SESSION_UNAVAILABLE");
		const signed = session.token + "." + createHmac("sha256", context.secret).update(session.token).digest("base64");
		const headers = new Headers({ cookie: context.authCookies.sessionToken.name + "=" + encodeURIComponent(signed) });
		const storage = new AsyncLocalStorage<{ headers: Headers }>();
		Reflect.set(globalThis, Symbol.for("next-ws.request-store"), storage);
		const { workAsyncStorage } = createRequire(import.meta.url)("next/dist/server/app-render/work-async-storage.external.js");
		const { upsertStreamSession } = await import("@/app/actions/runner");
		const payload = manualConfigurationPayload(mcp, runnerId, overlayId, mode, scheduled, key);
		const browser = await workAsyncStorage.run({ route: "/dashboard/runners/[id]", isStaticGeneration: false, incrementalCache: {}, pendingRevalidatedTags: [] }, () => storage.run({ headers }, () => upsertStreamSession(payload)));
		let existingEdit: { mcpCode: unknown; browser: Awaited<ReturnType<typeof upsertStreamSession>> } | undefined;
		if (input.variant === "manual_existing_scheduled_fallback") {
			const denied = await call("configure_stream_session", { sessionId: mcp.id, expectedRevision: 2, runnerId, overlayId, mode: "failsafe", destination: "twitch", resolution: "720p", fps: 30 });
			const rejectedBrowser = await workAsyncStorage.run({ route: "/dashboard/runners/[id]", isStaticGeneration: false, incrementalCache: {}, pendingRevalidatedTags: [] }, () => storage.run({ headers }, () => upsertStreamSession({ id: mcp.id, expectedRevision: 2, ownerId: "fixture-creator", runnerId, overlayId, mode: "failsafe" as import("@/app/lib/types").StreamMode, streamKey: key, rtmpUrl: "rtmp://live.twitch.tv/app" })));
			existingEdit = { mcpCode: denied.result?.structuredContent?.error?.code, browser: rejectedBrowser };
		}
		async function observeManualConfiguration() {
			const rows = (await input.fixture.pool.query('SELECT mode,desired_state AS "desiredState",actual_state AS "actualState",configuration_revision AS "configurationRevision",to_jsonb(s)->>\'control_mode\' AS "controlMode",encrypted_stream_key AS "protectedKey" FROM stream_sessions s WHERE owner_id=\'fixture-creator\' AND runner_id=$1', [runnerId])).rows;
			const [creator] = await input.fixture.db.select().from(usersTable).where(eq(usersTable.id, "fixture-creator")).limit(1);
			const benefits = await (await import("@/app/lib/entitlements")).resolveUserEntitlements(creator, input.fixture.db);
			const policy = (await import("@/server/runner/capabilities")).deriveRunnerCapabilities(benefits);
			const protectedKey = rows[0]?.protectedKey;
			const { decryptString } = await import("@/app/lib/encryption");
			return {
				existingEdit,
				businessDenialReturned,
				businessDenialThrownCode,
				capabilityAllowed: capability.result?.structuredContent?.operations?.configure_stream_session?.allowed === true,
				ownerFree: !benefits.proAccess && !benefits.runnerAccess,
				browserAuthenticated: browser.error !== "Unauthorized",
				mcpAccepted: typeof mcp?.id === "string",
				mcpError: mcp?.error?.code ?? null,
				browser,
				configuration: rows[0] ? { ...rows[0], protectedKey: undefined } : null,
				sessions: rows.length,
				credentialEncrypted: Boolean(protectedKey && protectedKey !== key && decryptString(protectedKey) === key),
				schedulingAvailable: policy.scheduling,
				safe: !JSON.stringify([configured, browser]).includes(key),
			};
		}
		return await observeManualConfiguration();
	} finally {
		globalThis.fetch = previousFetch;
	}
}

async function runManualIngestProbe(input: Parameters<typeof runRunnerFreeProProbe>[0]) {
	const runners = [randomUUID(), randomUUID()];
	const sessions = [randomUUID(), randomUUID()];
	const overlay = randomUUID();
	const different = input.variant === "manual_ingest_different";
	const clip = input.variant === "manual_ingest_clip";
	await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
	for (const runner of runners) await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at,protocol_version,capabilities) VALUES($1,'fixture-creator','Ingest fixture',$2,'online',now(),2,$3::jsonb)", [runner, randomUUID(), JSON.stringify(["admissions", "drain", "runner_presentation", "free_lease"])]);
	await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','ingest-source-secret','Ingest source','active','Featured')", [overlay]);
	for (const [i, session] of sessions.entries()) await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,rtmp_url) VALUES($1,'fixture-creator',$2,$3,$4,'rtmp://127.0.0.1:19350/live')", [session, different ? runners[i] : runners[0], overlay, (i === 1 && clip) || (i === 0 && input.variant === "manual_ingest_after_clip") ? "24/7" : "failsafe"]);
	const { call } = await runRunnerFreeProProbe(input);
	const start = async (index: number) => {
		const response = await call("control_stream_session", { sessionId: sessions[index], expectedRevision: 1, state: "running" });
		return response.result?.structuredContent ?? { transportError: response.error };
	};
	let results;
	if (input.variant === "manual_ingest_race") results = await Promise.all([start(0), start(1)]);
	else {
		const first = await start(0);
		if (input.variant === "manual_ingest_edited") await input.fixture.pool.query("UPDATE stream_sessions SET mode='24/7' WHERE id=$1", [sessions[0]]);
		if (input.variant === "manual_ingest_draining") await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='draining' WHERE session_id=$1", [sessions[0]]);
		results = [first, await start(1)];
	}
	const rejected = (await input.fixture.pool.query("SELECT desired_state,actual_state,configuration_revision FROM stream_sessions WHERE id=$1", [sessions[1]])).rows[0];
	const occupied = Number((await input.fixture.pool.query("SELECT count(*) FROM runner_broadcast_admissions WHERE state NOT IN ('stopped','failed_before_output')")).rows[0].count);
	const successfulStarts = Number((await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE action='sensitive-integration:mcp.control_stream_session' AND outcome='success'")).rows[0].count);
	let resumedAfterClosure;
	if (input.variant === "manual_ingest_draining") {
		await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='stopped',stopped_at=now(),terminal_reason='all_outputs_closed' WHERE session_id=$1", [sessions[0]]);
		await input.fixture.pool.query("UPDATE stream_sessions SET desired_state='stopped',actual_state='stopped' WHERE id=$1", [sessions[0]]);
		resumedAfterClosure = (await start(1))?.accepted === true;
	}
	return { transportErrors: results.flatMap((row) => (row?.transportError ? [row.transportError] : [])), accepted: results.filter((row) => row?.accepted === true).length, codes: results.flatMap((row) => (row?.error?.code ? [row.error.code] : [])), rejected, occupied, successfulStarts, resumedAfterClosure };
}

async function runManualCommitProbe(input: Parameters<typeof runRunnerFreeProProbe>[0]) {
	const runnerId = randomUUID();
	await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,'fixture-creator','Before transaction',$2)", [runnerId, randomUUID()]);
	const rollback = input.variant === "manual_commit_rollback";
	let transactionCommitted = false;
	let rejected = false;
	const sideEffects: boolean[] = [];
	const { workflowOperation, workflowRetry } = await import("@/server/resources/workflow");
	const principal = { kind: "session" as const, authUserId: input.actorId, sessionId: "fixture-controlled-session", authenticatedAt: new Date(), organizationId: "creator-org" };
	const client = {
		transaction: async (callback: Parameters<typeof input.fixture.db.transaction>[0]) => {
			const result = await input.fixture.db.transaction(callback);
			transactionCommitted = true;
			return result;
		},
	} as typeof input.fixture.db;
	try {
		await workflowOperation(
			principal,
			"update_runner",
			{ creatorId: "fixture-creator", runnerId, expectedRevision: 1, name: "After transaction" },
			async (_, context) => {
				await workflowRetry(context, "create_runner", {}, async () => {
					await context.tx.update(runnersTable).set({ name: "After transaction" }).where(eq(runnersTable.id, runnerId));
					return { id: runnerId };
				});
				context.afterCommit(() => {
					sideEffects.push(transactionCommitted);
				});
				if (rollback) throw new Error("FIXTURE_EXPECTED_ROLLBACK");
				return { id: runnerId };
			},
			client,
		);
	} catch (error) {
		if (!rollback || !(error instanceof Error) || error.message !== "FIXTURE_EXPECTED_ROLLBACK") throw error;
		rejected = true;
	}
	const name = (await input.fixture.pool.query("SELECT name FROM runners WHERE id=$1", [runnerId])).rows[0].name;
	const audits = Number((await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE action='workflow.update_runner' AND outcome='success'")).rows[0].count);
	const retries = Number((await input.fixture.pool.query("SELECT count(*) FROM mcp_mutation_retries")).rows[0].count);
	return { transactionCommitted, rejected, sideEffects, name, audits, retries };
}
