import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { usersTable } from "@/db/schema";
import { runRunnerFreeProProbe } from "./runner-free-pro-probe";
import { ephemeralRunnerKeys } from "../runner/fixtures";
import { hashExecutionTargets, verifyExecutionBundle } from "../../../packages/runner/src/protocol";

type Input = Parameters<typeof runRunnerFreeProProbe>[0];

/** Real MCP/device protocol journey. Physical encoder output has its native runtime owner. */
export async function runRunnerFreeBoundaryProbe(input: Input) {
	const previousFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== input.origin) throw new Error("RUNNER_FIXTURE_EXTERNAL_IO_FORBIDDEN");
		return input.auth.handler(request);
	}) as typeof fetch;
	try {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
		if (input.variant === "free_admission_extended") return await runExtendedAdmissionContract(input);
		await input.fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
		const owner = await input.fixture.db.query.usersTable.findFirst({ where: eq(usersTable.id, "fixture-creator") });
		if (!owner) throw new Error("RUNNER_FIXTURE_OWNER_MISSING");
		const benefits = await (await import("@/app/lib/entitlements")).resolveUserEntitlements(owner, input.fixture.db);
		const policy = (await import("@/server/runner/capabilities")).deriveRunnerCapabilities(benefits);
		const { call } = await runRunnerFreeProProbe(input);
		const registrations = await Promise.all([0, 1].map((index) => call("create_runner", { name: `Acceptance device ${index + 1}`, retryKey: `free-acceptance-device-${index}` })));
		const responses = [...registrations];
		const runners = registrations.map((row) => row.result?.structuredContent?.id).filter((id): id is string => typeof id === "string");
		const summary: Record<string, unknown> = { ownerFree: !benefits.proAccess && !benefits.runnerAccess, registered: runners.length, monthlyUsageLimit: policy.monthlyUsageLimit };
		if (runners.length !== 2) return summary;
		const overlayId = randomUUID();
		await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','private-free-acceptance-overlay','Acceptance source','active','Featured')", [overlayId]);
		const configured = await Promise.all(runners.map((runnerId, index) => call("configure_stream_session", { runnerId, overlayId, mode: "24/7", controlMode: "manual", destination: "twitch", resolution: "720p", fps: 30, retryKey: `free-acceptance-session-${index}` })));
		responses.push(...configured);
		const sessions = configured.map((row) => row.result?.structuredContent?.id).filter((id): id is string => typeof id === "string");
		summary.configured = sessions.length;
		if (sessions.length !== 2) return summary;
		// Valid private credentials are fixture input; the actual credential-saving browser boundary is owned by A6.
		const streamKey = "private-free-acceptance-stream-key";
		const { encryptString } = await import("@/app/lib/encryption");
		for (const session of sessions) {
			const encrypted = encryptString(streamKey);
			await input.fixture.pool.query("UPDATE stream_sessions SET encrypted_stream_key=$1 WHERE id=$2 AND owner_id='fixture-creator'", [encrypted, session]);
			await input.fixture.pool.query("UPDATE runner_destinations d SET encrypted_stream_key=$1,credential_revision=credential_revision+1,configuration_revision=configuration_revision+1 WHERE d.owner_id='fixture-creator' AND EXISTS(SELECT 1 FROM stream_session_destinations s WHERE s.session_id=$2 AND s.owner_id=d.owner_id AND s.destination_id=d.id)", [encrypted, session]);
		}
		const tokens = await Promise.all(runners.map(async (id) => (await input.fixture.pool.query("SELECT token FROM runners WHERE id=$1 AND owner_id='fixture-creator'", [id])).rows[0].token as string));
		const { privateKey, publicKey } = ephemeralRunnerKeys();
		process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
		const { POST } = await import("@/app/api/runner/heartbeat/route");
		const heartbeat = async (index: number, executions: unknown[] = []) => {
			const requestId = randomUUID();
			const response = await POST(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: `Bearer ${tokens[index]}`, "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation", "free_lease"], requestId, executions }) }));
			return { status: response.status, body: await response.json(), requestId };
		};
		const advertised = await Promise.all([heartbeat(0), heartbeat(1)]);
		summary.advertised = advertised.every((result) => result.status === 200);
		const starts = await Promise.all(sessions.map((sessionId) => call("control_stream_session", { sessionId, expectedRevision: 1, state: "running" })));
		responses.push(...starts);
		const winnerIndex = starts.findIndex((row) => row.result?.structuredContent?.accepted === true);
		summary.admitted = starts.filter((row) => row.result?.structuredContent?.accepted === true).length;
		summary.denied = starts.flatMap((row) => (row.result?.structuredContent?.error?.code ? [row.result.structuredContent.error.code] : []));
		summary.occupiedAfterStart = Number((await input.fixture.pool.query("SELECT count(*) FROM runner_broadcast_admissions WHERE state NOT IN ('stopped','failed_before_output')")).rows[0].count);
		if (summary.admitted !== 1) return summary;
		const started = starts[winnerIndex].result.structuredContent;
		const dispatched = await heartbeat(winnerIndex);
		const job = dispatched.body.jobs?.find((row: { id: string }) => row.id === sessions[winnerIndex]);
		const admission = (await input.fixture.pool.query("SELECT lease_id,configuration_revision FROM runner_broadcast_admissions WHERE id=$1", [started.admissionId])).rows[0];
		const targetId = configured[winnerIndex].result?.structuredContent?.destinationIds?.[0];
		summary.leaseVerified =
			typeof targetId === "string" &&
			!!job?.lease &&
			verifyExecutionBundle(
				job.lease,
				{ [job.lease.keyId]: publicKey.export({ type: "spki", format: "pem" }).toString() },
				{ ownerId: "fixture-creator", runnerId: runners[winnerIndex], sessionId: sessions[winnerIndex], generation: started.executionGeneration, admissionId: started.admissionId, leaseId: admission.lease_id, configurationRevision: admission.configuration_revision, sourceId: overlayId, sourceRevision: 1, targetHash: hashExecutionTargets([{ id: targetId, rtmpUrl: "rtmp://live.twitch.tv/app", streamKey }]), requestId: dispatched.requestId },
			) !== null;
		if (!summary.leaseVerified) return summary;
		const identity = { admissionId: started.admissionId, sessionId: sessions[winnerIndex], executionGeneration: started.executionGeneration, leaseId: admission.lease_id, configurationRevision: admission.configuration_revision };
		const active = await heartbeat(winnerIndex, [{ ...identity, state: "active" }]);
		summary.activeConfirmed = active.status === 200 && (await input.fixture.pool.query("SELECT actual_state FROM stream_sessions WHERE id=$1", [sessions[winnerIndex]])).rows[0].actual_state === "running";

		if (input.variant === "free_acceptance_extended") {
			// A valid long-running generation retains its fresh lease; history is controlled fixture input.
			const historyDays = 45;
			const historicalStart = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000);
			await input.fixture.pool.query("UPDATE runner_broadcast_admissions SET dispatched_at=$1,started_at=$1 WHERE id=$2", [historicalStart, started.admissionId]);
			await input.fixture.pool.query("UPDATE runners SET created_at=$1 WHERE id=ANY($2::uuid[]) AND owner_id='fixture-creator'", [historicalStart, runners]);
			const renewed = await heartbeat(winnerIndex);
			const renewedJob = renewed.body.jobs?.find((row: { id: string }) => row.id === sessions[winnerIndex]);
			summary.continuedSignedLease =
				!!renewedJob?.lease &&
				verifyExecutionBundle(
					renewedJob.lease,
					{ [renewedJob.lease.keyId]: publicKey.export({ type: "spki", format: "pem" }).toString() },
					{ ownerId: "fixture-creator", runnerId: runners[winnerIndex], sessionId: sessions[winnerIndex], generation: started.executionGeneration, admissionId: started.admissionId, leaseId: admission.lease_id, configurationRevision: admission.configuration_revision, sourceId: overlayId, sourceRevision: 1, targetHash: hashExecutionTargets([{ id: targetId, rtmpUrl: "rtmp://live.twitch.tv/app", streamKey }]), requestId: renewed.requestId },
				) !== null;
			const storedStart = (await input.fixture.pool.query("SELECT started_at FROM runner_broadcast_admissions WHERE id=$1", [started.admissionId])).rows[0].started_at as Date;
			summary.extendedHours = (Date.now() - storedStart.getTime()) / (60 * 60 * 1000);
			summary.crossedMonth = storedStart.getUTCFullYear() !== new Date().getUTCFullYear() || storedStart.getUTCMonth() !== new Date().getUTCMonth();
			const attempted = await call("control_stream_session", { sessionId: sessions[1 - winnerIndex], expectedRevision: 1, state: "running" });
			responses.push(attempted);
			summary.secondAttemptError = attempted.result?.structuredContent?.error?.code ?? null;
		}
		const stopped = await call("control_stream_session", { sessionId: sessions[winnerIndex], expectedRevision: started.configurationRevision, state: "stopped", stopMode: "graceful" });
		responses.push(stopped);
		summary.stopAccepted = stopped.result?.structuredContent?.accepted === true;
		summary.stopAppliedInitially = stopped.result?.structuredContent?.applied;
		const draining = await heartbeat(winnerIndex);
		const drain = draining.body.jobs?.find((row: { id: string }) => row.id === sessions[winnerIndex]);
		summary.drainDelivered = drain?.command === "drain" && drain?.stopMode === "graceful" && drain?.executionGeneration === started.executionGeneration;
		const closed = await heartbeat(winnerIndex, [{ ...identity, state: "stopped", allOutputsClosed: true }]);
		const terminal = (await input.fixture.pool.query("SELECT state,stopped_at FROM runner_broadcast_admissions WHERE id=$1", [started.admissionId])).rows[0];
		summary.stoppedConfirmed = closed.status === 200 && terminal.state === "stopped" && terminal.stopped_at !== null;
		summary.occupiedAfterStop = Number((await input.fixture.pool.query("SELECT count(*) FROM runner_broadcast_admissions WHERE state NOT IN ('stopped','failed_before_output')")).rows[0].count);
		summary.sessionsStopped = (await input.fixture.pool.query("SELECT desired_state,actual_state FROM stream_sessions")).rows.every((row) => row.desired_state === "stopped" && row.actual_state === "stopped");
		summary.protocolErrors = responses.flatMap((row) => (row.error ? [row.error.code] : []));
		summary.safe = !JSON.stringify(responses).includes(streamKey) && tokens.every((token) => !JSON.stringify(responses).includes(token));
		return summary;
	} finally {
		globalThis.fetch = previousFetch;
	}
}

async function runExtendedAdmissionContract(input: Input) {
	await input.fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
	const runners = [randomUUID(), randomUUID()],
		sessions = [randomUUID(), randomUUID()];
	const overlayId = randomUUID(),
		admissionId = randomUUID();
	const historicalStart = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
	const { deriveRunnerCapabilities } = await import("@/server/runner/capabilities");
	const benefits = { proAccess: false, runnerAccess: false };
	const policy = deriveRunnerCapabilities(benefits);
	await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','private-long-history-source','Long history','active','Featured')", [overlayId]);
	for (const [index, id] of runners.entries()) {
		await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at,protocol_version,capabilities) VALUES($1,'fixture-creator','Long history device',$2,'online',now(),2,$3::jsonb)", [id, randomUUID(), JSON.stringify(["admissions", "drain", "runner_presentation", "free_lease"])]);
		await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,rtmp_url,desired_state,actual_state,configuration_revision) VALUES($1,'fixture-creator',$2,$3,'24/7','rtmp://127.0.0.1:19350/live',$4,$4,$5)", [sessions[index], id, overlayId, index === 0 ? "running" : "stopped", index === 0 ? 2 : 1]);
	}
	await input.fixture.pool.query("INSERT INTO runner_broadcast_admissions(id,owner_id,runner_id,session_id,execution_generation,state,configuration_revision,benefits_at_start,protocol_supports_lease,lease_id,lease_expires_at,dispatched_at,started_at) VALUES($1,'fixture-creator',$2,$3,$4,'active',2,$5::jsonb,true,$6,$7,$8,$8)", [
		admissionId,
		runners[0],
		sessions[0],
		randomUUID(),
		JSON.stringify({ ...policy, ingestModeAtStart: "24/7" }),
		randomUUID(),
		new Date(Date.now() + 300000),
		historicalStart,
	]);
	const snapshot = async () => (await input.fixture.pool.query("SELECT to_jsonb(a) AS record FROM runner_broadcast_admissions a WHERE id=$1", [admissionId])).rows[0].record;
	const before = await snapshot();
	const { reserveBroadcastAdmission } = await import("@/server/runner/admission");
	const { isResourceFailure, toPublicResourceError } = await import("@/server/resources/errors");
	const { streamSessionsTable } = await import("@/db/schema");
	const session = await input.fixture.db.query.streamSessionsTable.findFirst({ where: eq(streamSessionsTable.id, sessions[1]) });
	if (!session) throw new Error("RUNNER_FIXTURE_SESSION_MISSING");
	let accepted = false,
		errorCode: string | null = null;
	try {
		const result = await input.fixture.db.transaction((tx) => reserveBroadcastAdmission(tx, session, benefits, 2));
		if (isResourceFailure(result)) errorCode = result.error.code;
		else accepted = true;
	} catch (error) {
		errorCode = toPublicResourceError(error).code;
	}
	return {
		accepted,
		errorCode,
		monthlyUsageLimit: policy.monthlyUsageLimit,
		extendedHours: (Date.now() - new Date(before.started_at).getTime()) / (60 * 60 * 1000),
		holderUnchanged: JSON.stringify(before) === JSON.stringify(await snapshot()),
		occupied: Number((await input.fixture.pool.query("SELECT count(*) FROM runner_broadcast_admissions WHERE state NOT IN ('stopped','failed_before_output')")).rows[0].count),
		second: (await input.fixture.pool.query("SELECT desired_state,actual_state,configuration_revision FROM stream_sessions WHERE id=$1", [sessions[1]])).rows[0],
	};
}
