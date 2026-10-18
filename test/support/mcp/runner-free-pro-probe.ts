import { randomUUID, createHmac } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import type { createMcpPostgresFixture } from "./postgres";

export async function runRunnerFreeProProbe(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; origin: string; token: string; variant: string; actorId: string; auth: { handler: (request: Request) => Promise<Response> } }) {
	const { fixture, origin, token } = input;
	const route = await import("@/app/mcp/route");
	let sequence = 0;
	const call = async (name: string, args: Record<string, unknown>) => {
		const response = await route.POST(new Request(`${origin}/mcp`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++sequence, method: "tools/call", params: { name, arguments: { creatorId: "fixture-creator", ...args } } }) }));
		const text = await response.text();
		const line = text.split("\n").find((value) => value.startsWith("data: "));
		return JSON.parse(line ? line.slice(6) : text);
	};
	return { fixture, call };
}

export async function runRunnerRegistrationProbe(input: Parameters<typeof runRunnerFreeProProbe>[0]) {
	const previousFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== input.origin) throw new Error("RUNNER_FIXTURE_EXTERNAL_IO_FORBIDDEN");
		return input.auth.handler(request);
	}) as typeof fetch;
	try {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
		await input.fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
		const access = input.variant.replace("register_", "");
		if (access === "pro") await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
		if (access === "legacy" || access === "trial") await input.fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at,ends_at) VALUES('fixture-creator',$1,$2,now()-interval '1 hour',now()+interval '1 day')", [access === "legacy" ? "runner_access" : "pro_access", access === "legacy" ? "partner" : "reverse_trial"]);
		if (access === "agency") {
			await (await import("./seed-pro-allocation")).seedCreatorProAllocation(input.fixture.pool, "fixture-creator", "creator-org", input.actorId);
			await input.fixture.pool.query("UPDATE agency_license_allocations SET product='runner' WHERE creator_id='fixture-creator'");
		}

		const { call } = await runRunnerFreeProProbe(input);
		const first = await call("create_runner", { name: "First Free device", retryKey: "runner-free-first" });
		const second = await call("create_runner", { name: "Second Free device", retryKey: "runner-free-second" });
		if (first.error || second.error) throw new Error(`RUNNER_FIXTURE_MCP_PROTOCOL_ERROR: ${first.error?.message ?? second.error?.message}`);
		const setup = await call("get_runner_setup", { platform: "linux" });
		if (setup.error) throw new Error(`RUNNER_FIXTURE_MCP_SETUP_PROTOCOL_ERROR: ${setup.error.message}`);
		const count = Number((await input.fixture.pool.query("SELECT count(*) FROM runners WHERE owner_id='fixture-creator'")).rows[0].count);
		return { first, second, setup, count, safe: !JSON.stringify([first, second]).includes("cl_run_") };
	} finally {
		globalThis.fetch = previousFetch;
	}
}

export async function runRunnerDeniedOperationsProbe(input: Parameters<typeof runRunnerFreeProProbe>[0]) {
	const previousFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== input.origin) throw new Error("RUNNER_FIXTURE_EXTERNAL_IO_FORBIDDEN");
		return input.auth.handler(request);
	}) as typeof fetch;
	try {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
		const overlayId = randomUUID(),
			runnerId = randomUUID(),
			sessionId = randomUUID();
		await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
		await input.fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at) VALUES('fixture-creator','runner_access','partner',now()-interval '1 hour')");
		await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','private-denial-overlay','Protected source','active','Featured')", [overlayId]);
		await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,'fixture-creator','Protected Runner','private-denial-runner')", [runnerId]);
		await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,desired_state,actual_state) VALUES($1,'fixture-creator',$2,$3,'24/7','running','running')", [sessionId, runnerId, overlayId]);
		const snapshot = async () => (await input.fixture.pool.query("SELECT desired_state,actual_state,configuration_revision,resolution,fps,mode FROM stream_sessions WHERE id=$1", [sessionId])).rows[0];
		const before = await snapshot();
		const { call } = await runRunnerFreeProProbe(input);
		const outcomes = [await call("control_stream_session", { sessionId, expectedRevision: 1, state: "running" }), await call("configure_stream_session", { sessionId, expectedRevision: 1, runnerId, overlayId, mode: "24/7", resolution: "720p", fps: 30 }), await call("control_stream_session", { sessionId, expectedRevision: 1, state: "stopped" })];
		const operationIndex: Record<string, number> = { denied_start: 0, denied_destination: 1, denied_stop: 2 };
		const selectedIndex = operationIndex[input.variant];
		const selected = selectedIndex === undefined ? null : outcomes[selectedIndex];
		const after = await snapshot();
		const writes = Number((await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE actor_user_id=$1 AND action LIKE 'sensitive-integration:mcp.%' AND outcome='success'", [input.actorId])).rows[0].count);
		return { outcomes, selected, unchanged: JSON.stringify(before) === JSON.stringify(after), writes, safe: !JSON.stringify(outcomes).includes("private-denial-") };
	} finally {
		globalThis.fetch = previousFetch;
	}
}

export async function runRunnerHeartbeatIsolationProbe(input: Parameters<typeof runRunnerFreeProProbe>[0]) {
	process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
	const ownRunner = randomUUID(),
		foreignRunner = randomUUID(),
		ownOverlay = randomUUID(),
		foreignOverlay = randomUUID(),
		ownSession = randomUUID(),
		foreignSession = randomUUID();
	await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
	await input.fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at) VALUES('fixture-creator','runner_access','partner',now()-interval '1 hour')");
	for (const [id, secret] of [
		[ownOverlay, "own-private-overlay"],
		[foreignOverlay, "foreign-private-overlay"],
	])
		await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator',$2,'Isolated source','active','Featured')", [id, secret]);
	for (const [id, token] of [
		[ownRunner, "own-device-token"],
		[foreignRunner, "foreign-device-token"],
	])
		await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,'fixture-creator','Isolation device',$2)", [id, token]);
	const { encryptString } = await import("@/app/lib/encryption");
	for (const [id, runner, overlay] of [
		[ownSession, ownRunner, ownOverlay],
		[foreignSession, foreignRunner, foreignOverlay],
	])
		await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,desired_state,actual_state,encrypted_stream_key) VALUES($1,'fixture-creator',$2,$3,'24/7','running','stopped',$4)", [id, runner, overlay, encryptString(id === ownSession ? "own-stream-key" : "foreign-stream-key")]);
	const { POST } = await import("@/app/api/runner/heartbeat/route");
	const response = await POST(new Request(`${input.origin}/api/runner/heartbeat`, { method: "POST", headers: { Authorization: "Bearer own-device-token", "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation"], lastAcknowledgedConfigRevision: 7, actualStates: { [foreignSession]: "running" } }) }));
	const body = await response.json();
	const telemetry = (await input.fixture.pool.query("SELECT to_jsonb(r)->'protocol_version' AS protocol, to_jsonb(r)->'capabilities' AS capabilities, to_jsonb(r)->'last_acknowledged_config_revision' AS ack FROM runners r WHERE id=$1", [ownRunner])).rows[0];
	const foreignState = (await input.fixture.pool.query("SELECT actual_state FROM stream_sessions WHERE id=$1", [foreignSession])).rows[0].actual_state;
	return { telemetry, status: response.status, noStore: response.headers.get("Cache-Control") === "no-store", onlyAssigned: Array.isArray(body.jobs) && body.jobs.length === 1 && body.jobs[0].id === ownSession, foreignDataExposed: JSON.stringify(body).includes("foreign-private-overlay") || JSON.stringify(body).includes("foreign-stream-key") || JSON.stringify(body).includes(foreignSession), ownCredentials: body.jobs?.[0]?.streamKey === "own-stream-key", foreignState };
}

export async function runRunnerAdmissionProbe(input: Parameters<typeof runRunnerFreeProProbe>[0]) {
	const previousFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== input.origin) throw new Error("RUNNER_FIXTURE_EXTERNAL_IO_FORBIDDEN");
		return input.auth.handler(request);
	}) as typeof fetch;
	try {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
		await input.fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
		const overlayId = randomUUID(),
			runnerIds = [randomUUID(), randomUUID()],
			sessionIds = [randomUUID(), randomUUID()];
		await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','private-admission-overlay','Shared Free source','active','Featured')", [overlayId]);
		for (let index = 0; index < 2; index++) {
			await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at,protocol_version,capabilities) VALUES($1,'fixture-creator','Supported device',$2,'online',now(),2,$3)", [runnerIds[index], `private-admission-device-${index}`, JSON.stringify(["admissions", "drain", "runner_presentation"])]);
			await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,rtmp_url) VALUES($1,'fixture-creator',$2,$3,'24/7','rtmp://127.0.0.1:19350/live')", [sessionIds[index], runnerIds[index], overlayId]);
		}
		const inspect = async () => {
			const tableExists = (await input.fixture.pool.query("SELECT to_regclass('public.runner_broadcast_admissions') IS NOT NULL AS present")).rows[0].present;
			const occupied = tableExists ? Number((await input.fixture.pool.query("SELECT count(*) FROM runner_broadcast_admissions WHERE owner_id='fixture-creator' AND state NOT IN ('stopped','failed_before_output')")).rows[0].count) : 0;
			const desiredRunning = Number((await input.fixture.pool.query("SELECT count(*) FROM stream_sessions WHERE owner_id='fixture-creator' AND desired_state='running'")).rows[0].count);
			return { occupied, desiredRunning };
		};

		if (["admission_emergency_stop", "admission_emergency_snapshot_race"].includes(input.variant)) {
			const { call } = await runRunnerFreeProProbe(input);
			await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 1, state: "running" });
			const initial = (await input.fixture.pool.query("SELECT * FROM runner_broadcast_admissions WHERE session_id=$1", [sessionIds[0]])).rows[0];
			await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='active',dispatched_at=now(),started_at=now() WHERE id=$1", [initial.id]);
			await input.fixture.pool.query("UPDATE stream_sessions SET actual_state='running' WHERE id=$1", [sessionIds[0]]);
			const stopped = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 2, executionGeneration: initial.execution_generation, state: "stopped", stopMode: "immediate" });
			const admission = (await input.fixture.pool.query("SELECT * FROM runner_broadcast_admissions WHERE id=$1", [initial.id])).rows[0];
			const session = (await input.fixture.pool.query("SELECT desired_state,actual_state,configuration_revision FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0];

			let replacementGeneration: string | undefined;
			if (input.variant === "admission_emergency_snapshot_race") {
				const { db } = await import("@/db/client");
				const builder = db.query.runnerBroadcastAdmissionsTable;
				const original = builder.findMany;
				Object.assign(builder, {
					findMany: async (...args: unknown[]) => {
						Object.assign(builder, { findMany: original });
						replacementGeneration = randomUUID();
						await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='stopped',stopped_at=now() WHERE id=$1", [initial.id]);
						await input.fixture.pool.query("INSERT INTO runner_broadcast_admissions(owner_id,runner_id,session_id,execution_generation,state,dispatched_at,started_at,configuration_revision,benefits_at_start) VALUES('fixture-creator',$1,$2,$3,'active',now(),now(),4,$4)", [runnerIds[0], sessionIds[0], replacementGeneration, JSON.stringify({ runnerPro: false })]);
						await input.fixture.pool.query("UPDATE stream_sessions SET desired_state='running',actual_state='running',configuration_revision=4 WHERE id=$1", [sessionIds[0]]);
						return await Reflect.apply(original, builder, args);
					},
				});
			}
			const { POST } = await import("@/app/api/runner/heartbeat/route");
			const heartbeat = await POST(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer private-admission-device-0", "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation", "free_lease"], requestId: randomUUID() }) }));
			const job = (await heartbeat.json()).jobs?.find((candidate: { id: string }) => candidate.id === sessionIds[0]);

			if (replacementGeneration) {
				const current = (await input.fixture.pool.query("SELECT desired_state,actual_state,configuration_revision FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0];
				return { heartbeatStatus: heartbeat.status, misdirectedStop: job?.executionGeneration === replacementGeneration && ["drain", "stop_now"].includes(job?.command), current, ...(await inspect()) };
			}
			const delivered = { status: heartbeat.status, stopMode: job?.stopMode, command: job?.command, matchingAdmission: job?.admissionId === initial.id, matchingGeneration: job?.executionGeneration === initial.execution_generation, commandIdPresent: typeof job?.commandId === "string" && /^[0-9a-f-]{36}$/i.test(job.commandId), noOutputCredentials: job?.overlaySecret === "" && job?.streamKey === null };
			return { accepted: stopped.result?.structuredContent?.accepted === true, applied: stopped.result?.structuredContent?.applied, admissionState: admission.state, stopMode: admission.stop_mode, generationRetained: admission.execution_generation === initial.execution_generation, closed: admission.stopped_at !== null, session, delivered, ...(await inspect()) };
		}
		if (input.variant.startsWith("admission_lease_")) {
			const credentialBound = input.variant === "admission_lease_key_binding";
			const fixtureStreamKey = "private-canonical-target-fixture";
			if (credentialBound) {
				const { encryptString } = await import("@/app/lib/encryption");
				await input.fixture.pool.query("UPDATE stream_sessions SET rtmp_url=$1,encrypted_stream_key=$2 WHERE id=$3", ["rtmp://live.twitch.tv/app", encryptString(fixtureStreamKey), sessionIds[0]]);
			}
			const { call } = await runRunnerFreeProProbe(input);
			const started = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 1, state: "running" });
			const before = (await input.fixture.pool.query("SELECT id,execution_generation,state FROM runner_broadcast_admissions WHERE session_id=$1", [sessionIds[0]])).rows[0];
			const { generateKeyPairSync } = await import("node:crypto");
			const { privateKey, publicKey } = generateKeyPairSync("ed25519");
			process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
			const requestId = randomUUID();
			const { POST } = await import("@/app/api/runner/heartbeat/route");
			const response = await POST(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer private-admission-device-0", "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation", "free_lease"], requestId }) }));
			const body = await response.json(),
				job = body.jobs?.find((job: { id: string }) => job.id === sessionIds[0]);
			const stored = (await input.fixture.pool.query("SELECT to_jsonb(a) AS record FROM runner_broadcast_admissions a WHERE id=$1", [before.id])).rows[0].record;
			let verified = false,
				claims: Record<string, unknown> | undefined;
			if (job?.lease) {
				const { verifyExecutionBundle } = await import("@/server/runner/capabilities");
				const expected = { ownerId: "fixture-creator", runnerId: runnerIds[0], sessionId: sessionIds[0], generation: before.execution_generation, targetHash: job.targetHash, configurationRevision: 2, sourceRevision: 1, sourceId: overlayId, admissionId: before.id, leaseId: stored.lease_id, requestId };
				const decoded = JSON.parse(Buffer.from(job.lease.payload, "base64url").toString("utf8"));
				claims = verifyExecutionBundle(job.lease, { [job.lease.keyId]: publicKey.export({ type: "spki", format: "pem" }).toString() }, expected, decoded.issuedAt) ?? undefined;
				verified = claims !== undefined;
			}
			if (credentialBound) {
				const { createHash } = await import("node:crypto");
				const decoded = job.lease ? JSON.parse(Buffer.from(job.lease.payload, "base64url").toString("utf8")) : {};
				const expectedHash = createHash("sha256")
					.update(JSON.stringify([{ id: sessionIds[0], rtmpUrl: "rtmp://live.twitch.tv/app", credential: createHash("sha256").update(fixtureStreamKey).digest("hex") }]))
					.digest("hex");
				return { status: response.status, verified, actualTargetBound: decoded.targetHash === expectedHash, sourceBound: decoded.sourceId === overlayId, secretExcluded: !JSON.stringify(decoded).includes(fixtureStreamKey), ...(await inspect()) };
			}
			if (input.variant === "admission_lease_normal_replay" && claims) {
				const heartbeat = async (executions: unknown[] = []) => POST(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer private-admission-device-0", "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation", "free_lease"], requestId: randomUUID(), executions }) }));
				const oldReceipt = { admissionId: before.id, sessionId: sessionIds[0], executionGeneration: before.execution_generation, leaseId: stored.lease_id, configurationRevision: 2, state: "stopped", allOutputsClosed: true };
				const closed = await heartbeat([oldReceipt]);
				const startedAgain = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 3, state: "running" });
				const nextAttempt = (await input.fixture.pool.query("SELECT to_jsonb(a) AS record FROM runner_broadcast_admissions a WHERE session_id=$1 AND state='reserved'", [sessionIds[0]])).rows[0]?.record;
				if (!nextAttempt) return { closedStatus: closed.status, startedAgain: startedAgain.result?.structuredContent?.accepted === true, nextAttemptPresent: false };
				const dispatched = await heartbeat();
				const newLease = (await input.fixture.pool.query("SELECT lease_id FROM runner_broadcast_admissions WHERE id=$1", [nextAttempt.id])).rows[0].lease_id;
				const active = await heartbeat([{ admissionId: nextAttempt.id, sessionId: sessionIds[0], executionGeneration: nextAttempt.execution_generation, leaseId: newLease, configurationRevision: 4, state: "active" }]);
				const snapshot = async () => ({
					session: (await input.fixture.pool.query("SELECT desired_state,actual_state,configuration_revision FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0],
					admission: (await input.fixture.pool.query("SELECT state,execution_generation,configuration_revision,started_at,stopped_at FROM runner_broadcast_admissions WHERE id=$1", [nextAttempt.id])).rows[0],
					old: (await input.fixture.pool.query("SELECT state,stopped_at,terminal_reason FROM runner_broadcast_admissions WHERE id=$1", [before.id])).rows[0],
				});
				const prior = await snapshot(),
					replayed = await heartbeat([oldReceipt]),
					after = await snapshot();
				return { closedStatus: closed.status, startedAgain: startedAgain.result?.structuredContent?.accepted === true, nextAttemptPresent: true, differentGeneration: nextAttempt.execution_generation !== before.execution_generation, dispatchedStatus: dispatched.status, activeStatus: active.status, replayStatus: replayed.status, unchanged: JSON.stringify(prior) === JSON.stringify(after), after, ...(await inspect()) };
			}
			if (input.variant.startsWith("admission_lease_boundary_") && claims) {
				const boundary = input.variant.replace("admission_lease_boundary_", ""),
					offset = boundary === "before" ? -1 : boundary === "at" ? 0 : 1;
				const at = Number(claims.expiresAt) + offset,
					nextRequest = randomUUID(),
					originalNow = Date.now;
				Date.now = () => at;
				let renewed: Response;
				try {
					renewed = await POST(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer private-admission-device-0", "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation", "free_lease"], requestId: nextRequest }) }));
				} finally {
					Date.now = originalNow;
				}
				const renewedBody = await renewed.json(),
					nextJob = renewedBody.jobs?.find((job: { id: string }) => job.id === sessionIds[0]),
					current = (await input.fixture.pool.query("SELECT to_jsonb(a) AS record FROM runner_broadcast_admissions a WHERE id=$1", [before.id])).rows[0].record;
				let validNext = false;
				if (nextJob?.lease) {
					const { verifyExecutionBundle } = await import("@/server/runner/capabilities");
					validNext = verifyExecutionBundle(nextJob.lease, { [nextJob.lease.keyId]: publicKey.export({ type: "spki", format: "pem" }).toString() }, { ownerId: "fixture-creator", runnerId: runnerIds[0], sessionId: sessionIds[0], generation: before.execution_generation, targetHash: job.targetHash, configurationRevision: 2, sourceRevision: 1, sourceId: overlayId, admissionId: before.id, leaseId: stored.lease_id, requestId: nextRequest }, at) !== null;
				}
				return { status: renewed.status, validNext, state: current.state, deadlineDelta: new Date(current.lease_expires_at).getTime() - new Date(stored.lease_expires_at).getTime(), sameGeneration: current.execution_generation === stored.execution_generation, sameLease: current.lease_id === stored.lease_id, closed: current.stopped_at != null, hasOutputCredentials: !!nextJob?.overlaySecret || !!nextJob?.streamKey, ...(await inspect()) };
			}
			if (input.variant.startsWith("admission_lease_bad_ack_") && claims) {
				const field = input.variant.replace("admission_lease_bad_ack_", "");
				const acknowledgment: Record<string, unknown> = { admissionId: before.id, sessionId: sessionIds[0], executionGeneration: before.execution_generation, leaseId: stored.lease_id, configurationRevision: 2, state: "stopped", allOutputsClosed: true };
				let bearer = "private-admission-device-0";
				if (["admissionId", "sessionId", "executionGeneration", "leaseId"].includes(field)) acknowledgment[field] = randomUUID();
				if (field === "configurationRevision") acknowledgment[field] = 99;
				if (field === "allOutputsClosed") acknowledgment[field] = false;
				if (field === "other_device") bearer = "private-admission-device-1";
				if (field === "foreign_owner") {
					const foreignOwner = "foreign-ack-" + randomUUID(),
						foreignOverlay = randomUUID(),
						foreignDevice = randomUUID();
					await input.fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES($1,$2,'Foreign ACK','','user','free')", [foreignOwner, foreignOwner + "@example.invalid"]);
					await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,$2,'foreign-private-ack-overlay','Foreign ACK','active','Featured')", [foreignOverlay, foreignOwner]);
					await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token,status) VALUES($1,$2,'Foreign device','foreign-ack-device-token','online')", [foreignDevice, foreignOwner]);
					await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,rtmp_url) VALUES($1,$2,$3,$4,'24/7','rtmp://127.0.0.1:19350/foreign')", [randomUUID(), foreignOwner, foreignDevice, foreignOverlay]);
					bearer = "foreign-ack-device-token";
				}
				const snapshot = async () => ({ session: (await input.fixture.pool.query("SELECT actual_state,desired_state,configuration_revision FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0], admission: (await input.fixture.pool.query("SELECT state,execution_generation,configuration_revision,started_at,stopped_at FROM runner_broadcast_admissions WHERE id=$1", [before.id])).rows[0] });
				const original = await snapshot();
				const ack = await POST(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer " + bearer, "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation", "free_lease"], requestId: randomUUID(), actualStates: { [sessionIds[0]]: "stopped" }, executions: [acknowledgment] }) }));
				const after = await snapshot();
				return { status: ack.status, unchanged: JSON.stringify(original) === JSON.stringify(after), original, after, ...(await inspect()) };
			}
			if (["admission_lease_stop_ack", "admission_lease_receipt_confirmation"].includes(input.variant) && claims) {
				const ack = await POST(
					new Request(input.origin + "/api/runner/heartbeat", {
						method: "POST",
						headers: { Authorization: "Bearer private-admission-device-0", "Content-Type": "application/json" },
						body: JSON.stringify({ protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation", "free_lease"], requestId: randomUUID(), executions: [{ admissionId: before.id, sessionId: sessionIds[0], executionGeneration: before.execution_generation, leaseId: stored.lease_id, configurationRevision: 2, state: "stopped", allOutputsClosed: true }] }),
					}),
				);
				const ackBody = await ack.json(),
					terminal = (await input.fixture.pool.query("SELECT to_jsonb(a) AS record FROM runner_broadcast_admissions a WHERE id=$1", [before.id])).rows[0].record;

				const actual = (await input.fixture.pool.query("SELECT actual_state,desired_state,configuration_revision FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0];
				if (input.variant === "admission_lease_receipt_confirmation") {
					const report = { admissionId: before.id, sessionId: sessionIds[0], executionGeneration: before.execution_generation, leaseId: stored.lease_id, configurationRevision: 2, state: "stopped", allOutputsClosed: true };
					const send = async (generation: string) => {
						const response = await POST(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer private-admission-device-0", "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation", "free_lease"], requestId: randomUUID(), executions: [{ ...report, executionGeneration: generation }] }) }));
						return { status: response.status, body: await response.json() };
					};
					const replay = await send(before.execution_generation),
						wrong = await send(randomUUID());
					const after = (await input.fixture.pool.query("SELECT actual_state,desired_state,configuration_revision FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0];
					return { status: ack.status, accepted: ackBody.acceptedExecutions, replayed: replay.body.acceptedExecutions, replayStatus: replay.status, wrong: wrong.body.acceptedExecutions, wrongStatus: wrong.status, expected: [{ admissionId: before.id, executionGeneration: before.execution_generation, state: "stopped" }], unchanged: JSON.stringify(actual) === JSON.stringify(after), ...(await inspect()) };
				}
				return { status: ack.status, state: terminal.state, closed: terminal.stopped_at != null, reason: terminal.terminal_reason, generationRetained: terminal.execution_generation === stored.execution_generation, deadlineRetained: terminal.lease_expires_at === stored.lease_expires_at, noOutputCredentials: Array.isArray(ackBody.jobs) && ackBody.jobs.every((job: { streamKey?: string | null; overlaySecret?: string }) => job.streamKey == null && !job.overlaySecret), actual, ...(await inspect()) };
			}
			if (input.variant === "admission_lease_active_ack" && claims) {
				const ack = await POST(
					new Request(input.origin + "/api/runner/heartbeat", {
						method: "POST",
						headers: { Authorization: "Bearer private-admission-device-0", "Content-Type": "application/json" },
						body: JSON.stringify({ protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation", "free_lease"], requestId: randomUUID(), executions: [{ admissionId: before.id, sessionId: sessionIds[0], executionGeneration: before.execution_generation, leaseId: stored.lease_id, configurationRevision: 2, state: "active" }] }),
					}),
				);
				const acknowledged = (await input.fixture.pool.query("SELECT to_jsonb(a) AS record FROM runner_broadcast_admissions a WHERE id=$1", [before.id])).rows[0].record;
				const actual = (await input.fixture.pool.query("SELECT actual_state,desired_state,configuration_revision FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0];
				return { status: ack.status, state: acknowledged.state, started: acknowledged.started_at != null, observed: acknowledged.last_observed_at != null, dispatchRetained: acknowledged.dispatched_at === stored.dispatched_at, generationRetained: acknowledged.execution_generation === stored.execution_generation, actual, ...(await inspect()) };
			}
			if (input.variant === "admission_lease_renew" && claims) {
				const renewedRequestId = randomUUID(),
					renewAt = Number(claims.issuedAt) + 100000;
				const originalNow = Date.now;
				Date.now = () => renewAt;
				let renewal: Response;
				try {
					renewal = await POST(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer private-admission-device-0", "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation", "free_lease"], requestId: renewedRequestId }) }));
				} finally {
					Date.now = originalNow;
				}
				const nextBody = await renewal.json(),
					nextJob = nextBody.jobs?.find((job: { id: string }) => job.id === sessionIds[0]);
				const renewed = (await input.fixture.pool.query("SELECT to_jsonb(a) AS record FROM runner_broadcast_admissions a WHERE id=$1", [before.id])).rows[0].record;
				let nextClaims: Record<string, unknown> | null = null;
				if (nextJob?.lease) {
					const { verifyExecutionBundle } = await import("@/server/runner/capabilities");
					nextClaims = verifyExecutionBundle(nextJob.lease, { [nextJob.lease.keyId]: publicKey.export({ type: "spki", format: "pem" }).toString() }, { ownerId: "fixture-creator", runnerId: runnerIds[0], sessionId: sessionIds[0], generation: before.execution_generation, targetHash: job.targetHash, configurationRevision: 2, sourceRevision: 1, sourceId: overlayId, admissionId: before.id, leaseId: stored.lease_id, requestId: renewedRequestId }, renewAt);
				}
				return {
					status: renewal.status,
					verified: nextClaims !== null,
					sameLease: renewed.lease_id === stored.lease_id,
					sameGeneration: renewed.execution_generation === stored.execution_generation,
					sameDispatch: renewed.dispatched_at === stored.dispatched_at,
					extension: new Date(renewed.lease_expires_at).getTime() - new Date(stored.lease_expires_at).getTime(),
					deadlineMatches: nextClaims ? new Date(renewed.lease_expires_at).getTime() === nextClaims.expiresAt : false,
					freshNonce: nextClaims?.requestId === renewedRequestId && renewedRequestId !== requestId,
					...(await inspect()),
				};
			}
			return {
				started: started.result?.structuredContent?.accepted === true,
				status: response.status,
				noStore: response.headers.get("Cache-Control") === "no-store",
				verified,
				beforeState: before.state,
				storedState: stored.state,
				dispatched: stored.dispatched_at != null,
				leaseStored: typeof stored.lease_id === "string" && stored.protocol_supports_lease === true,
				deadlineMatches: claims ? new Date(stored.lease_expires_at).getTime() === claims.expiresAt : false,
				ttl: claims ? Number(claims.expiresAt) - Number(claims.issuedAt) : null,
				generationRetained: stored.execution_generation === before.execution_generation,
				jobIdentity: job?.admissionId === before.id && job?.executionGeneration === before.execution_generation,
				...(await inspect()),
			};
		}

		if (input.variant === "admission_service_retry") {
			const { reserveBroadcastAdmission } = await import("@/server/runner/admission");
			const session = (await input.fixture.db.query.streamSessionsTable.findMany()).find((row) => row.id === sessionIds[0])!;
			const first = await input.fixture.db.transaction((tx) => reserveBroadcastAdmission(tx, session, { proAccess: false, runnerAccess: false }, 2));
			const second = await input.fixture.db.transaction((tx) => reserveBroadcastAdmission(tx, session, { proAccess: false, runnerAccess: false }, 3));
			const { isResourceFailure } = await import("@/server/resources/errors");
			if (isResourceFailure(first) || isResourceFailure(second)) throw new Error("FIXTURE_ADMISSION_UNEXPECTED_DENIAL");
			return { sameId: first.id === second.id, sameGeneration: first.executionGeneration === second.executionGeneration, revision: second.configurationRevision, state: second.state, dispatched: second.dispatchedAt, ...(await inspect()) };
		}

		if (["admission_terminal_ack", "admission_terminal_wrong_generation", "admission_terminal_replay"].includes(input.variant)) {
			const { call } = await runRunnerFreeProProbe(input);
			const start = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 1, state: "running" });
			const admissionId = start.result?.structuredContent?.admissionId,
				generation = start.result?.structuredContent?.executionGeneration;
			await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='active',dispatched_at=now(),started_at=now() WHERE id=$1", [admissionId]);
			await input.fixture.pool.query("UPDATE stream_sessions SET actual_state='running' WHERE id=$1", [sessionIds[0]]);
			await input.fixture.pool.query("UPDATE runners SET status='offline',last_heartbeat_at=now()-interval '2 minutes' WHERE id=$1", [runnerIds[0]]);
			await call("delete_runner", { runnerId: runnerIds[0], expectedRevision: 1 });
			const { POST } = await import("@/app/api/runner/heartbeat/route");
			const beforeHeartbeat = JSON.stringify((await input.fixture.pool.query("SELECT to_jsonb(a) AS record FROM runner_broadcast_admissions a WHERE id=$1", [admissionId])).rows[0].record);
			const heartbeat = await POST(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer private-admission-device-0", "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation"], renewLease: { admissionId, generation } }) }));
			const heartbeatBody = await heartbeat.json();
			const afterHeartbeat = JSON.stringify((await input.fixture.pool.query("SELECT to_jsonb(a) AS record FROM runner_broadcast_admissions a WHERE id=$1", [admissionId])).rows[0].record);
			const endpointAvailable = (await import("node:fs")).existsSync("src/app/api/runner/terminal/route.ts");
			if (!endpointAvailable) return { endpointAvailable, heartbeatStatus: heartbeat.status, ...(await inspect()) };
			const { execFileSync } = await import("node:child_process"),
				{ join } = await import("node:path");
			const directory = process.env.MCP_COVERAGE_PROBE_DIRECTORY;
			const args = directory ? ["--conditions=react-server", join(directory, "runner-terminal-probe.mjs")] : ["--conditions=react-server", "--import=tsx", "test/support/mcp/runner-terminal-probe.ts"];
			// The enclosing native producer already owns the raw coverage folder; preserve it.
			const callReceipt = (executionGeneration: string) => {
				const output = execFileSync(process.execPath, [...args, JSON.stringify({ token: "private-admission-device-0", body: { admissionId, executionGeneration, allOutputsClosed: true } })], { encoding: "utf8", timeout: 15000, env: process.env });
				return JSON.parse(output.trim().split("\n").at(-1)!);
			};
			const wrongReceipt = input.variant === "admission_terminal_wrong_generation" ? callReceipt(randomUUID()) : undefined;
			const afterWrong = await inspect();
			const ack = callReceipt(generation);
			const afterAck = await inspect();
			const terminal = (await input.fixture.pool.query("SELECT state,stopped_at,execution_generation FROM runner_broadcast_admissions WHERE id=$1", [admissionId])).rows[0];
			const oldSession = (await input.fixture.pool.query("SELECT desired_state,actual_state FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0];
			let second: any, replayed: any, replayPreservedNewAttempt: boolean | undefined, afterReplay: any;
			if (input.variant === "admission_terminal_replay") {
				await input.fixture.pool.query("UPDATE stream_sessions SET runner_id=$2,configuration_revision=4 WHERE id=$1", [sessionIds[0], runnerIds[1]]);
				second = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 4, state: "running" });
				await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='active',dispatched_at=now(),started_at=now() WHERE session_id=$1 AND state='reserved'", [sessionIds[0]]);
				await input.fixture.pool.query("UPDATE stream_sessions SET actual_state='running' WHERE id=$1", [sessionIds[0]]);
				const snapshot = async () => JSON.stringify({ session: (await input.fixture.pool.query("SELECT configuration_revision,desired_state,actual_state FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0], current: (await input.fixture.pool.query("SELECT id,execution_generation,state,configuration_revision FROM runner_broadcast_admissions WHERE session_id=$1 AND state='active'", [sessionIds[0]])).rows[0] });
				const before = await snapshot();
				replayed = callReceipt(generation);
				replayPreservedNewAttempt = before === (await snapshot());
				afterReplay = await inspect();
			} else second = await call("control_stream_session", { sessionId: sessionIds[1], expectedRevision: 1, state: "running" });
			return {
				replayed,
				replayPreservedNewAttempt,
				afterReplay,
				deniedHeartbeatUnchanged: beforeHeartbeat === afterHeartbeat,
				heartbeatNoStore: heartbeat.headers.get("Cache-Control") === "no-store",
				wrongReceipt,
				afterWrong,
				endpointAvailable,
				heartbeatStatus: heartbeat.status,
				heartbeatExposesJobs: JSON.stringify(heartbeatBody).includes("private-admission-") || (Array.isArray(heartbeatBody.jobs) && heartbeatBody.jobs.length > 0),
				ack,
				afterAck,
				terminalState: terminal.state,
				stoppedAtRecorded: terminal.stopped_at !== null,
				generationRetained: terminal.execution_generation === generation,
				oldSession,
				secondAccepted: second.result?.structuredContent?.accepted === true,
				safe: !JSON.stringify(ack).includes("private-admission-device-0"),
			};
		}
		if (["admission_revoke_unlink", "admission_revoke_delete", "admission_revoke_twice", "admission_revoke_reserved"].includes(input.variant)) {
			const { call } = await runRunnerFreeProProbe(input);
			const started = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 1, state: "running" });
			const generation = started.result?.structuredContent?.executionGeneration;
			if (input.variant !== "admission_revoke_reserved") {
				await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='active',dispatched_at=now(),started_at=now() WHERE session_id=$1", [sessionIds[0]]);
				await input.fixture.pool.query("UPDATE stream_sessions SET actual_state='running' WHERE id=$1", [sessionIds[0]]);
			}
			const deleting = input.variant === "admission_revoke_delete";
			const revoked = await call(deleting ? "delete_runner" : "unlink_runner", { runnerId: runnerIds[0], expectedRevision: 1 });
			const firstTombstone = (await input.fixture.pool.query("SELECT to_jsonb(a) AS record FROM runner_broadcast_admissions a WHERE session_id=$1", [sessionIds[0]])).rows[0].record;
			if (input.variant === "admission_revoke_twice") await call("unlink_runner", { runnerId: runnerIds[0], expectedRevision: 2 });
			const admission = (await input.fixture.pool.query("SELECT to_jsonb(a) AS record FROM runner_broadcast_admissions a WHERE session_id=$1", [sessionIds[0]])).rows[0].record;
			const runner = (await input.fixture.pool.query("SELECT token,status FROM runners WHERE id=$1", [runnerIds[0]])).rows[0];
			const { createHash } = await import("node:crypto");
			const oldToken = "private-admission-device-0";
			return {
				terminalReason: admission.terminal_reason,
				revocationTimePreserved: admission.revoked_at === firstTombstone.revoked_at,
				deleted: revoked.result?.structuredContent?.deleted === true,
				deviceReferenceCleared: admission.runner_id === null,
				sessionReferenceRetained: admission.session_id === sessionIds[0],
				revoked: revoked.result?.structuredContent?.credentialRevoked === true,
				credentialRotated: deleting ? runner === undefined : runner.token !== oldToken,
				terminalHashMatches: admission.terminal_credential_hash === createHash("sha256").update(oldToken).digest("hex"),
				plaintextStored: JSON.stringify(admission).includes(oldToken),
				revokedAtRecorded: typeof admission.revoked_at === "string",
				admissionState: admission.state,
				identityPreserved: admission.execution_generation === generation,
				stoppedAt: admission.stopped_at,
				safe: !JSON.stringify(revoked).includes(oldToken),
				...(await inspect()),
			};
		}
		if (input.variant === "admission_public_retry") {
			const { call } = await runRunnerFreeProProbe(input);
			const args = { sessionId: sessionIds[0], expectedRevision: 1, state: "running" };
			const first = await call("control_stream_session", args);
			const retry = await call("control_stream_session", args);
			const afterRetry = (await input.fixture.pool.query("SELECT configuration_revision,desired_state,actual_state FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0];
			const admissions = (await input.fixture.pool.query("SELECT execution_generation,configuration_revision FROM runner_broadcast_admissions WHERE session_id=$1", [sessionIds[0]])).rows;
			await input.fixture.pool.query("UPDATE stream_sessions SET configuration_revision=3 WHERE id=$1", [sessionIds[0]]);
			const staleAfterEdit = await call("control_stream_session", args);
			const afterEdit = (await input.fixture.pool.query("SELECT configuration_revision FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0];
			return { first: first.result?.structuredContent, retry: retry.result?.structuredContent, afterRetry, admissions, staleAfterEditCode: staleAfterEdit.result?.structuredContent?.error?.code, afterEdit, ...(await inspect()) };
		}
		if (input.variant === "admission_stale_generation") {
			const { call } = await runRunnerFreeProProbe(input);
			const first = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 1, state: "running" });
			const oldGeneration = first.result?.structuredContent?.executionGeneration;
			await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='stopped',stopped_at=now() WHERE session_id=$1", [sessionIds[0]]);
			await input.fixture.pool.query("UPDATE stream_sessions SET desired_state='stopped',actual_state='stopped',configuration_revision=3 WHERE id=$1", [sessionIds[0]]);
			const current = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 3, state: "running" });
			const generation = current.result?.structuredContent?.executionGeneration;
			const snapshot = async () => ({
				session: (await input.fixture.pool.query("SELECT configuration_revision,desired_state,actual_state FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0],
				admission: (await input.fixture.pool.query("SELECT execution_generation,state,configuration_revision FROM runner_broadcast_admissions WHERE session_id=$1 AND state NOT IN ('stopped','failed_before_output')", [sessionIds[0]])).rows[0],
				writes: Number((await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE action='sensitive-integration:mcp.control_stream_session' AND outcome='success'")).rows[0].count),
			});
			const before = await snapshot();
			const stale = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 4, executionGeneration: oldGeneration, state: "stopped" });
			const after = await snapshot();
			const matching = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 4, executionGeneration: generation, state: "stopped" });
			return { differentGenerations: oldGeneration !== generation, staleCode: stale.result?.structuredContent?.error?.code, unchanged: JSON.stringify(before) === JSON.stringify(after), currentGenerationRetained: after.admission?.execution_generation === generation, matchingAccepted: matching.result?.structuredContent?.accepted === true, ...(await inspect()) };
		}
		if (["admission_cancel_reserved", "admission_stop_dispatched", "admission_restart_draining"].includes(input.variant)) {
			const { call } = await runRunnerFreeProProbe(input);
			const started = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 1, state: "running" });
			const initial = (await input.fixture.pool.query("SELECT id,execution_generation,state,dispatched_at FROM runner_broadcast_admissions WHERE session_id=$1", [sessionIds[0]])).rows[0];
			if (["admission_stop_dispatched", "admission_restart_draining"].includes(input.variant)) await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='starting',dispatched_at=now() WHERE id=$1", [initial.id]);
			const beforeStop = (await input.fixture.pool.query("SELECT dispatched_at FROM runner_broadcast_admissions WHERE id=$1", [initial.id])).rows[0];
			const stopped = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 2, state: "stopped" });
			const afterCancel = await inspect();
			const cancelled = (await input.fixture.pool.query("SELECT id,execution_generation,state,dispatched_at,stopped_at,terminal_reason FROM runner_broadcast_admissions WHERE session_id=$1", [sessionIds[0]])).rows[0];
			if (input.variant === "admission_restart_draining") {
				const snapshot = async () => ({
					session: (await input.fixture.pool.query("SELECT desired_state,actual_state,configuration_revision FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0],
					admission: (await input.fixture.pool.query("SELECT execution_generation,state,configuration_revision FROM runner_broadcast_admissions WHERE id=$1", [initial.id])).rows[0],
					writes: Number((await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE action='sensitive-integration:mcp.control_stream_session' AND outcome='success'")).rows[0].count),
				});
				const before = await snapshot();
				const retry = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 3, state: "running" });
				const after = await snapshot();
				return { stopApplied: stopped.result?.structuredContent?.applied, restartCode: retry.result?.structuredContent?.error?.code, unchanged: JSON.stringify(before) === JSON.stringify(after), before, after, ...(await inspect()) };
			}
			const second = await call("control_stream_session", { sessionId: sessionIds[1], expectedRevision: 1, state: "running" });
			const replacement = (await input.fixture.pool.query("SELECT execution_generation FROM runner_broadcast_admissions WHERE session_id=$1 AND state='reserved'", [sessionIds[1]])).rows[0];
			return {
				dispatchedBeforeStop: beforeStop.dispatched_at !== null,
				secondCode: second.result?.structuredContent?.error?.code,
				startedAccepted: started.result?.structuredContent?.accepted === true,
				initialUndispatched: initial.state === "reserved" && initial.dispatched_at === null,
				afterCancel,
				cancelledState: cancelled.state,
				cancelledReason: cancelled.terminal_reason,
				closedAtRecorded: cancelled.stopped_at !== null,
				cancelledIdentityPreserved: cancelled.id === initial.id && cancelled.execution_generation === initial.execution_generation,
				stopApplied: stopped.result?.structuredContent?.applied,
				secondAccepted: second.result?.structuredContent?.accepted === true,
				newGeneration: replacement ? replacement.execution_generation !== initial.execution_generation : false,
				...(await inspect()),
			};
		}
		if (input.variant === "failed_before_output") {
			await input.fixture.pool.query("UPDATE stream_sessions SET rtmp_url='rtmp://live.twitch.tv/app',encrypted_stream_key=NULL WHERE id=$1", [sessionIds[0]]);
			const { call } = await runRunnerFreeProProbe(input);
			const failed = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 1, state: "running" });
			const afterFailure = await inspect();
			const failedSession = (await input.fixture.pool.query("SELECT desired_state,actual_state,configuration_revision FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0];
			const retry = await call("control_stream_session", { sessionId: sessionIds[1], expectedRevision: 1, state: "running" });
			const admissions = (await input.fixture.pool.query("SELECT session_id,state,dispatched_at FROM runner_broadcast_admissions")).rows;
			const writes = Number((await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE action='sensitive-integration:mcp.control_stream_session' AND outcome='success'")).rows[0].count);
			return { failureCode: failed.result?.structuredContent?.error?.code, afterFailure, failedSession, retryAccepted: retry.result?.structuredContent?.accepted === true, retryApplied: retry.result?.structuredContent?.applied, onlyRetryReserved: admissions.length === 1 && admissions[0].session_id === sessionIds[1] && admissions[0].state === "reserved" && admissions[0].dispatched_at === null, writes, ...(await inspect()), safe: !JSON.stringify([failed, retry]).includes("private-admission-") };
		}
		if (input.variant.startsWith("occupied_")) {
			const proOperator = input.variant === "occupied_policy-agency-pro-operator";
			if (proOperator) {
				await input.fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('actor-personal-org','Personal Pro','actor-personal-pro',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('actor-personal','personal@example.invalid','Personal Pro','','user','pro'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('actor-personal','actor-personal-org','active')");
				await input.fixture.pool.query("INSERT INTO creator_identity_links(creator_id,auth_user_id,source) VALUES('actor-personal',$1,'twitch_onboarding')", [input.actorId]);
			}

			const admissionId = randomUUID();
			const { deriveRunnerCapabilities } = await import("@/server/runner/capabilities");
			await input.fixture.pool.query("UPDATE stream_sessions SET desired_state='running',actual_state='running' WHERE id=$1", [sessionIds[0]]);
			await input.fixture.pool.query("UPDATE stream_sessions SET mode=$2 WHERE id=$1", [sessionIds[0], input.variant.startsWith("occupied_fallback_") ? "failsafe" : "24/7"]);
			await input.fixture.pool.query("UPDATE stream_sessions SET mode=$2 WHERE id=$1", [sessionIds[1], input.variant === "occupied_clip_fallback" ? "failsafe" : "24/7"]);
			await input.fixture.pool.query("INSERT INTO runner_broadcast_admissions(id,owner_id,runner_id,session_id,execution_generation,state,configuration_revision,benefits_at_start,dispatched_at,started_at) VALUES($1,'fixture-creator',$2,$3,$4,'active',1,$5,now(),now())", [admissionId, runnerIds[0], sessionIds[0], randomUUID(), JSON.stringify(deriveRunnerCapabilities({ proAccess: false, runnerAccess: false }))]);
			const holder = async () => (await input.fixture.pool.query("SELECT a.state,a.execution_generation,a.configuration_revision,s.desired_state,s.actual_state FROM runner_broadcast_admissions a JOIN stream_sessions s ON s.id=a.session_id WHERE a.id=$1", [admissionId])).rows[0];

			if (input.variant.startsWith("occupied_lease_")) {
				const clock = Date.now();
				const record = (await input.fixture.pool.query("SELECT to_jsonb(a) AS record FROM runner_broadcast_admissions a WHERE id=$1", [admissionId])).rows[0].record;
				const leaseStorageAvailable = Object.hasOwn(record, "lease_expires_at") && Object.hasOwn(record, "protocol_supports_lease");
				if (leaseStorageAvailable) await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET protocol_supports_lease=true,lease_id=$2,lease_expires_at=$3,state='uncertain' WHERE id=$1", [admissionId, randomUUID(), new Date(clock - 305000 + (input.variant === "occupied_lease_early" ? 1 : 0))]);
				if (leaseStorageAvailable && input.variant.startsWith("occupied_lease_ineligible_")) {
					const kind = input.variant.replace("occupied_lease_ineligible_", "");
					if (kind === "unsupported") await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET protocol_supports_lease=false WHERE id=$1", [admissionId]);
					if (kind === "missing_id") await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET lease_id=null WHERE id=$1", [admissionId]);
					if (kind === "missing_expiry") await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET lease_expires_at=null WHERE id=$1", [admissionId]);
					if (kind === "undispatched") await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET dispatched_at=null WHERE id=$1", [admissionId]);
					if (kind === "paid") await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET benefits_at_start=jsonb_set(benefits_at_start,'{runnerPro}','true') WHERE id=$1", [admissionId]);
				}
				const { call } = await runRunnerFreeProProbe(input);
				const originalNow = Date.now;
				Date.now = () => clock;
				let result;
				try {
					result = await call("control_stream_session", { sessionId: sessionIds[1], expectedRevision: 1, state: "running" });
				} finally {
					Date.now = originalNow;
				}
				const terminal = (await input.fixture.pool.query("SELECT to_jsonb(a) AS record FROM runner_broadcast_admissions a WHERE id=$1", [admissionId])).rows[0].record;
				return { leaseStorageAvailable, accepted: result.result?.structuredContent?.accepted === true, code: result.result?.structuredContent?.error?.code, terminal, ...(await inspect()) };
			}
			let nonLeasedLegacy: boolean | undefined;
			if (input.variant === "occupied_legacy_no_lease") {
				await input.fixture.pool.query("UPDATE runners SET status='offline',last_heartbeat_at=now()-interval '2 hours',protocol_version=1,capabilities='[]' WHERE id=$1", [runnerIds[0]]);
				await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET state='uncertain',dispatched_at=now()-interval '2 hours',started_at=now()-interval '2 hours',last_observed_at=now()-interval '2 hours' WHERE id=$1", [admissionId]);
				const record = (await input.fixture.pool.query("SELECT to_jsonb(a) AS record FROM runner_broadcast_admissions a WHERE id=$1", [admissionId])).rows[0].record;
				nonLeasedLegacy = record.protocol_supports_lease !== true && record.lease_expires_at == null;
			}
			if (["occupied_legacy_untracked", "occupied_legacy_stop", "occupied_legacy_unlink", "occupied_legacy_delete"].includes(input.variant)) {
				await input.fixture.pool.query("DELETE FROM runner_broadcast_admissions WHERE id=$1", [admissionId]);
				await input.fixture.pool.query("UPDATE runners SET status='offline',last_heartbeat_at=now()-interval '2 minutes',protocol_version=1,capabilities='[]' WHERE id=$1", [runnerIds[0]]);
			}
			if (input.variant === "occupied_offline") await input.fixture.pool.query("UPDATE runners SET status='offline',last_heartbeat_at=now()-interval '2 minutes' WHERE id=$1", [runnerIds[0]]);
			if (input.variant === "occupied_legacy_stop") await input.fixture.pool.query("UPDATE stream_sessions SET actual_state='stopped' WHERE id=$1", [sessionIds[0]]);
			const before = await holder();
			const { call } = await runRunnerFreeProProbe(input);
			let legacyStopApplied: boolean | undefined;
			if (input.variant === "occupied_legacy_stop") {
				const stopped = await call("control_stream_session", { sessionId: sessionIds[0], expectedRevision: 1, state: "stopped" });
				legacyStopApplied = stopped.result?.structuredContent?.applied;
			}
			let legacyCredentialRevoked: boolean | undefined, legacyHashMatches: boolean | undefined;
			if (["occupied_legacy_unlink", "occupied_legacy_delete"].includes(input.variant)) {
				const deleting = input.variant === "occupied_legacy_delete";
				const revoked = await call(deleting ? "delete_runner" : "unlink_runner", { runnerId: runnerIds[0], expectedRevision: 1 });
				legacyCredentialRevoked = deleting ? revoked.result?.structuredContent?.deleted : revoked.result?.structuredContent?.credentialRevoked;
			}
			const result = await call("control_stream_session", { sessionId: sessionIds[1], expectedRevision: 1, state: "running" });
			if (["occupied_legacy_unlink", "occupied_legacy_delete"].includes(input.variant)) {
				const record = (await input.fixture.pool.query("SELECT terminal_credential_hash FROM runner_broadcast_admissions WHERE session_id=$1", [sessionIds[0]])).rows[0];
				const { createHash } = await import("node:crypto");
				legacyHashMatches = record?.terminal_credential_hash === createHash("sha256").update("private-admission-device-0").digest("hex");
			}

			const after = await holder();
			const rejected = (await input.fixture.pool.query("SELECT desired_state,actual_state,configuration_revision FROM stream_sessions WHERE id=$1", [sessionIds[1]])).rows[0];
			const writes = Number((await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE actor_user_id=$1 AND action='sensitive-integration:mcp.control_stream_session' AND outcome='success'", [input.actorId])).rows[0].count);
			return {
				legacyDeleted: input.variant === "occupied_legacy_delete" ? (await input.fixture.pool.query("SELECT id FROM runners WHERE id=$1", [runnerIds[0]])).rows.length === 0 : undefined,
				legacyDeviceReferenceCleared: input.variant === "occupied_legacy_delete" ? (await input.fixture.pool.query("SELECT runner_id IS NULL AS cleared FROM runner_broadcast_admissions WHERE session_id=$1", [sessionIds[0]])).rows[0]?.cleared : undefined,
				legacyCredentialRevoked,
				legacyHashMatches,
				legacyStopApplied,
				legacyClaim: ["occupied_legacy_untracked", "occupied_legacy_stop", "occupied_legacy_unlink", "occupied_legacy_delete"].includes(input.variant) ? (await input.fixture.pool.query("SELECT state,protocol_supports_lease,lease_id,lease_expires_at FROM runner_broadcast_admissions WHERE session_id=$1", [sessionIds[0]])).rows[0] : undefined,
				nonLeasedLegacy,
				offlineHealth: input.variant === "occupied_offline" ? (await input.fixture.pool.query("SELECT status='offline' AND last_heartbeat_at < now()-interval '30 seconds' AS offline FROM runners WHERE id=$1", [runnerIds[0]])).rows[0].offline : undefined,
				ownerPlan: (await input.fixture.pool.query("SELECT plan FROM users WHERE id='fixture-creator'")).rows[0].plan,
				operatorPlan: proOperator ? (await input.fixture.pool.query("SELECT plan FROM users WHERE id='actor-personal'")).rows[0].plan : null,
				code: result.result?.structuredContent?.error?.code,
				message: result.result?.structuredContent?.error?.message,
				holderUnchanged: JSON.stringify(before) === JSON.stringify(after),
				rejected,
				writes,
				...(await inspect()),
				safe: !JSON.stringify(result).includes("private-admission-"),
			};
		}
		if (["admission_lock", "admission_service_lock", "admission_service_pro"].includes(input.variant)) {
			const { controlStreamSession } = await import("@/server/resources/runners");
			const principal = { kind: "session" as const, authUserId: input.actorId, sessionId: "fixture-controlled-session", authenticatedAt: new Date(), organizationId: "creator-org" };
			const blocker = await input.fixture.pool.connect();
			let settled = 0;
			let observedLocks = 0;
			let pending: Array<Promise<{ accepted: boolean; code?: string }>> = [];
			try {
				await blocker.query("BEGIN");
				await blocker.query("SELECT id FROM users WHERE id='fixture-creator' FOR UPDATE");
				const serviceSessions = await input.fixture.db.query.streamSessionsTable.findMany();
				pending = input.variant.startsWith("admission_service_")
					? sessionIds.map((sessionId) =>
							input.fixture.db
								.transaction(async (tx) => {
									const { reserveBroadcastAdmission } = await import("@/server/runner/admission");
									const session = serviceSessions.find((value) => value.id === sessionId)!;
									await reserveBroadcastAdmission(tx, session, { proAccess: input.variant === "admission_service_pro", runnerAccess: false }, 2);
									return { accepted: true };
								})
								.catch((error) => ({ accepted: false, code: error.message }))
								.finally(() => {
									settled++;
								}),
						)
					: sessionIds.map((sessionId) =>
							controlStreamSession(principal, { creatorId: "fixture-creator", sessionId, expectedRevision: 1, state: "running" }, input.fixture.db)
								.then(
									(value) => ({ accepted: value.accepted === true }),
									(error) => ({ accepted: false, code: error.message }),
								)
								.finally(() => {
									settled++;
								}),
						);
				const deadline = Date.now() + 3000;
				while (Date.now() < deadline) {
					observedLocks = Number((await input.fixture.pool.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")).rows[0].count);
					if (observedLocks >= 2) break;
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
				const beforeRelease = settled;
				await blocker.query("ROLLBACK");
				const outcomes = await Promise.all(pending);
				return {
					observedLocks,
					beforeRelease,
					accepted: outcomes.filter((value) => value.accepted).length,
					loserCodes: outcomes.filter((value) => !value.accepted).map((value) => value.code),
					sessions: (await input.fixture.pool.query("SELECT desired_state,actual_state,configuration_revision FROM stream_sessions ORDER BY desired_state")).rows,
					successfulWrites: Number((await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE action='workflow.control_stream_session' AND outcome='success'")).rows[0].count),
					...(await inspect()),
				};
			} finally {
				await blocker.query("ROLLBACK");
				blocker.release();
				await Promise.allSettled(pending);
			}
		}
		const { auth: appAuth } = await import("@/auth/config");
		const context = await appAuth.$context;
		const session = await context.internalAdapter.createSession(input.actorId, false, { activeOrganizationId: "creator-org" }, true);
		if (!session || typeof context.secret !== "string") throw new Error("RUNNER_FIXTURE_SESSION_UNAVAILABLE");
		const signed = session.token + "." + createHmac("sha256", context.secret).update(session.token).digest("base64");
		const headers = new Headers({ cookie: context.authCookies.sessionToken.name + "=" + encodeURIComponent(signed) });
		const storage = new AsyncLocalStorage<{ headers: Headers }>();
		Reflect.set(globalThis, Symbol.for("next-ws.request-store"), storage);
		const { workAsyncStorage } = createRequire(import.meta.url)("next/dist/server/app-render/work-async-storage.external.js");
		const { setStreamDesiredState } = await import("@/app/actions/runner");
		const { call } = await runRunnerFreeProProbe(input);
		const [dashboard, mcp] = await Promise.all([workAsyncStorage.run({ route: "/dashboard/runners/[id]", isStaticGeneration: false, incrementalCache: {}, pendingRevalidatedTags: [] }, () => storage.run({ headers }, () => setStreamDesiredState(sessionIds[0], "running" as import("@/app/lib/types").StreamState, 1))), call("control_stream_session", { sessionId: sessionIds[1], expectedRevision: 1, state: "running" })]);
		const dashboardResult = dashboard as { success: boolean; accepted?: boolean; code?: string };
		const outcomes = [
			{ accepted: dashboardResult.success === true && dashboardResult.accepted === true, code: dashboardResult.code },
			{ accepted: mcp.result?.structuredContent?.accepted === true, code: mcp.result?.structuredContent?.error?.code },
		];
		return { accepted: outcomes.filter((value) => value.accepted).length, loserCodes: outcomes.filter((value) => !value.accepted).map((value) => value.code), ...(await inspect()), safe: !JSON.stringify([dashboard, mcp]).includes("private-admission-") };
	} finally {
		globalThis.fetch = previousFetch;
	}
}

export async function runRunnerHealthProbe(input: Parameters<typeof runRunnerFreeProProbe>[0]) {
	const now = Date.UTC(2026, 9, 15, 12),
		ids = [randomUUID(), randomUUID(), randomUUID()];
	for (const [index, age] of [30000, 30001, 35000].entries()) await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at) VALUES($1,'fixture-creator','Health baseline',$2,'online',$3)", [ids[index], randomUUID(), new Date(now - age)]);
	const originalNow = Date.now,
		originalEnvironment = process.env.NODE_ENV,
		originalInterval = globalThis.setInterval,
		originalStarted = globalThis.__runnerSchedulerStarted;
	try {
		Date.now = () => now;
		Reflect.set(process.env, "NODE_ENV", "development");
		globalThis.__runnerSchedulerStarted = undefined;
		globalThis.setInterval = (() => ({ unref() {} })) as unknown as typeof setInterval;
		const { startRunnerScheduler } = await import("@/app/lib/runnerScheduler");
		startRunnerScheduler();
		const deadline = originalNow() + 3000;
		let completed = false;
		while (originalNow() < deadline) {
			const witness = (await input.fixture.pool.query("SELECT status FROM runners WHERE id=$1", [ids[2]])).rows[0];
			if (witness.status === "offline") {
				completed = true;
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
		if (!completed) throw Error("HEALTH_CHARACTERIZATION_SWEEP_NOT_OBSERVED");
		const states = [];
		for (const id of ids) states.push((await input.fixture.pool.query("SELECT status FROM runners WHERE id=$1", [id])).rows[0].status);
		return { atCutoff: states[0], afterCutoff: states[1], completionWitness: states[2] };
	} finally {
		Date.now = originalNow;
		if (originalEnvironment === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
		else Reflect.set(process.env, "NODE_ENV", originalEnvironment);
		globalThis.setInterval = originalInterval;
		globalThis.__runnerSchedulerStarted = originalStarted;
	}
}
