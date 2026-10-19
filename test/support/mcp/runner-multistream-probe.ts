import { randomUUID } from "node:crypto";
import type { runRunnerFreeProProbe } from "./runner-free-pro-probe";
import type * as RunnerActions from "@/app/actions/runner";
import { ephemeralRunnerKeys } from "../runner/fixtures";
import { hashExecutionTargets, verifyExecutionBundle } from "../../../packages/runner/src/protocol";

type Input = Parameters<typeof runRunnerFreeProProbe>[0] & { authenticated: boolean; runnerId: string; deviceToken: string; actions: typeof RunnerActions };

function expectedTargetsForVariant(variant: string) {
	const allTargets = [
		{ name: "YouTube destination", provider: "youtube" as const, rtmpUrl: "rtmp://127.0.0.1:19440/youtube", streamKey: "private-multistream-youtube-key" },
		{ name: "Twitch destination", provider: "twitch" as const, rtmpUrl: "rtmp://127.0.0.1:19441/twitch", streamKey: "private-multistream-twitch-key" },
	];
	const provider = variant.replace("multistream_provider_", "");
	const expected = variant === "multistream_active_reassignment_legacy" ? allTargets.slice(0, 1) : variant.startsWith("multistream_provider_") ? (provider === "custom" ? [{ name: "Custom destination", provider: "custom" as const, rtmpUrl: "rtmp://127.0.0.1:19443/custom", streamKey: "private-multistream-custom-key" }] : allTargets.filter((target) => target.provider === provider)) : allTargets;
	return expected;
}

function multistreamMediaScenario(variant: string) {
	if (variant === "multistream_independent_delivery") return "independent";
	if (variant.startsWith("multistream_media_") || variant === "multistream_fixture_control" || variant === "multistream_delivery") return "media";
	return null;
}
function acceptedConfiguration(value: { id?: unknown; error?: unknown } | undefined) {
	return typeof value?.id === "string" && !value.error;
}
function hasAcceptedOutputReport(response: { status: number; body: { acceptedExecutions?: { admissionId: string }[] } }, admissionId: string) {
	return response.status === 200 && response.body.acceptedExecutions?.some((ack) => ack.admissionId === admissionId);
}

/** Native/API state observer; media delivery has the distinct outer workflow observer. */
export async function runRunnerMultistreamProbe(input: Input) {
	const mediaScenario = multistreamMediaScenario(input.variant);
	if (mediaScenario === "independent") return runIndependentMedia(input);
	if (mediaScenario === "media") return runMediaProbe(input);
	const ownerId = "fixture-creator";
	const free = input.variant === "multistream_free";
	await input.fixture.pool.query("UPDATE users SET plan=$1 WHERE id=$2", [free ? "free" : "pro", ownerId]);
	const overlayId = randomUUID();
	await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,$2,'private-multistream-source','Multistream source','active','Featured')", [overlayId, ownerId]);
	const expected = expectedTargetsForVariant(input.variant);
	const saved = [];
	for (const target of expected) saved.push(await input.actions.saveRunnerDestination({ ownerId, runnerId: input.runnerId, ...target, credentialAction: "replace" }));
	const ids = saved.flatMap((result) => (result.success ? [result.destination.id] : []));
	async function prepareSelectionFixture() {
		let requestedIds = ids;
		const invalidSelection = input.variant.replace("multistream_selection_", "");
		if (invalidSelection === "duplicate") requestedIds = [ids[0], ids[0]];
		if (invalidSelection === "missing") requestedIds = [randomUUID()];
		if (invalidSelection === "foreign") {
			await input.fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) SELECT 'foreign-target-owner','foreign@example.invalid','foreign','',role,'free' FROM users WHERE id=$1", [ownerId]);
			await input.fixture.pool.query("UPDATE runner_destinations SET owner_id='foreign-target-owner' WHERE id=$1", [ids[0]]);
		}
		if (invalidSelection === "rollback") {
			await input.fixture.pool.query("CREATE FUNCTION multistream_join_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled selection persistence failure'; END $$");
			await input.fixture.pool.query("CREATE TRIGGER multistream_join_failure AFTER INSERT ON stream_session_destinations FOR EACH ROW EXECUTE FUNCTION multistream_join_failure()");
		}
		return { requestedIds, invalidSelection };
	}
	const { requestedIds, invalidSelection } = await prepareSelectionFixture();
	async function observeInternalSelection() {
		const { db } = await import("@/db/client");
		const { resolveRunnerDestinationSelection } = await import("@/server/runner/destinations");
		const result = await db.transaction((tx) => resolveRunnerDestinationSelection(tx, ownerId, invalidSelection === "empty_internal" ? [] : ["invalid"], true));
		return { authenticated: input.authenticated, configurationAccepted: false, configurationError: "error" in result ? result.error.code : undefined, sessions: 0 };
	}
	if (["empty_internal", "malformed_internal"].includes(invalidSelection)) return await observeInternalSelection();
	const { call } = await (await import("./runner-free-pro-probe")).runRunnerFreeProProbe(input);
	const { privateKey, publicKey } = ephemeralRunnerKeys();
	process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
	const { POST } = await import("@/app/api/runner/heartbeat/route");
	const heartbeat = async (executions?: unknown[]) => {
		const requestId = randomUUID();
		const response = await POST(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: `Bearer ${input.deviceToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, requestId, executions, capabilities: ["admissions", "destinations", "drain", "runner_presentation", "free_lease"] }) }));
		return { status: response.status, body: await response.json(), requestId };
	};
	await heartbeat();
	async function configureFixtureSession() {
		let configured;
		if (input.variant === "multistream_dashboard") {
			const saved = await input.actions.upsertStreamSession({ ownerId, runnerId: input.runnerId, overlayId, mode: "24/7", rtmpUrl: expected[0].rtmpUrl, streamKey: "", destinationIds: ids } as Parameters<typeof input.actions.upsertStreamSession>[0]);
			const session = (await input.fixture.pool.query("SELECT id,configuration_revision FROM stream_sessions WHERE owner_id=$1", [ownerId])).rows[0];
			configured = saved.success && session ? { id: session.id, configurationRevision: session.configuration_revision } : { error: { code: "code" in saved ? saved.code : "FAILED" } };
		} else configured = (await call("configure_stream_session", { runnerId: input.runnerId, overlayId, mode: "24/7", controlMode: "manual", destinationIds: requestedIds, retryKey: "multistream-configuration" })).result?.structuredContent;
		return configured;
	}
	const configured = await configureFixtureSession();
	const configurationAccepted = acceptedConfiguration(configured);
	const base = { authenticated: input.authenticated, destinationsSaved: ids.length, configurationAccepted, configurationError: configured?.error?.code, sessions: Number((await input.fixture.pool.query("SELECT count(*) FROM stream_sessions WHERE owner_id=$1", [ownerId])).rows[0].count) };
	if (!configurationAccepted) return base;
	const selected = (await input.fixture.pool.query("SELECT destination_id FROM stream_session_destinations WHERE owner_id=$1 AND session_id=$2 ORDER BY position", [ownerId, configured.id])).rows;
	const started = (await call("control_stream_session", { sessionId: configured.id, expectedRevision: configured.configurationRevision, state: "running" })).result?.structuredContent;
	const admission = (await input.fixture.pool.query("SELECT to_jsonb(a) AS captured FROM runner_broadcast_admissions a WHERE owner_id=$1 AND session_id=$2", [ownerId, configured.id])).rows[0]?.captured;
	async function observeInactiveReassignment() {
		const stop = (await call("control_stream_session", { sessionId: configured.id, expectedRevision: started.configurationRevision, state: "stopped" })).result?.structuredContent;
		const peerRunner = randomUUID();
		await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,$2,'Inactive reassignment device',$3)", [peerRunner, ownerId, randomUUID()]);
		const moved = (await call("configure_stream_session", { sessionId: configured.id, expectedRevision: stop.configurationRevision, runnerId: peerRunner, overlayId, mode: "24/7", destinationIds: ids })).result?.structuredContent;
		return { ...base, inactiveReassignmentAllowed: moved?.id === configured.id && !moved.error, movedRunner: moved?.runnerId === peerRunner };
	}
	if (input.variant === "multistream_inactive_reassignment") return await observeInactiveReassignment();
	async function observeActiveReassignment() {
		await heartbeat();
		const peerRunner = randomUUID();
		await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,$2,'Reassignment device',$3)", [peerRunner, ownerId, randomUUID()]);
		const attempted = input.variant.endsWith("_legacy")
			? await input.actions.upsertStreamSession({ id: configured.id, expectedRevision: started.configurationRevision, ownerId, runnerId: peerRunner, overlayId, mode: "24/7" as Parameters<typeof input.actions.upsertStreamSession>[0]["mode"], rtmpUrl: expected[0].rtmpUrl, streamKey: "" })
			: (await call("configure_stream_session", { sessionId: configured.id, expectedRevision: started.configurationRevision, runnerId: peerRunner, overlayId, mode: "24/7", destinationIds: ids })).result?.structuredContent;
		const session = (await input.fixture.pool.query("SELECT runner_id,configuration_revision FROM stream_sessions WHERE id=$1", [configured.id])).rows[0];
		return { ...base, reassignmentError: attempted?.error?.code ?? attempted?.code, originalDevicePreserved: session.runner_id === input.runnerId, revisionPreserved: session.configuration_revision === started.configurationRevision };
	}
	if (input.variant.startsWith("multistream_active_reassignment")) return await observeActiveReassignment();
	async function observeIndependentState() {
		const peerRunner = randomUUID(),
			peerToken = randomUUID();
		await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,$2,'Independent state device',$3)", [peerRunner, ownerId, peerToken]);
		const target = await input.actions.saveRunnerDestination({ ownerId, runnerId: peerRunner, name: "Independent target", provider: "custom", rtmpUrl: "rtmp://127.0.0.1:19444/live", credentialAction: "clear" });
		if (!target.success) return { ...base, peerSaved: false };
		const peer = (await call("configure_stream_session", { runnerId: peerRunner, overlayId, mode: "24/7", destinationIds: [target.destination.id], retryKey: "independent-state" })).result?.structuredContent;
		const peerStart = (await call("control_stream_session", { sessionId: peer?.id, expectedRevision: peer?.configurationRevision, state: "running" })).result?.structuredContent;
		const firstJobs = await heartbeat();
		const peerResponse = await POST(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: `Bearer ${peerToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, requestId: randomUUID(), capabilities: ["admissions", "destinations", "drain", "runner_presentation", "free_lease"] }) }));
		const peerJobs = await peerResponse.json();
		const stopped = (await call("control_stream_session", { sessionId: configured.id, expectedRevision: started.configurationRevision, state: "stopped" })).result?.structuredContent;
		const rows = (await input.fixture.pool.query("SELECT session_id,state,execution_generation,benefits_at_start FROM runner_broadcast_admissions WHERE owner_id=$1 ORDER BY session_id", [ownerId])).rows;
		async function observeIndependentStateResult() {
			return {
				...base,
				bothAdmitted: started?.accepted === true && peerStart?.accepted === true,
				distinctGenerations: new Set(rows.map((row) => row.execution_generation)).size === 2,
				allCapturedPro: rows.length === 2 && rows.every((row) => row.benefits_at_start.runnerPro === true),
				assignedOnly: JSON.stringify(firstJobs.body.jobs?.map((job: { id: string }) => job.id)) === JSON.stringify([configured.id]) && JSON.stringify(peerJobs.jobs?.map((job: { id: string }) => job.id)) === JSON.stringify([peer.id]),
				stopIndependent: stopped?.accepted === true && rows.find((row) => row.session_id === configured.id)?.state === "draining" && rows.find((row) => row.session_id === peer.id)?.state === "starting",
			};
		}
		return await observeIndependentStateResult();
	}
	if (input.variant === "multistream_independent_state") return await observeIndependentState();
	async function observeCapturedDelivery() {
		const ciphertext = admission?.encrypted_targets_snapshot;
		const { decryptString } = await import("@/app/lib/encryption");
		const decoded = typeof ciphertext === "string" ? decryptString(ciphertext) : null;
		const snapshot = decoded ? JSON.parse(decoded) : null;
		// Editing a saved record after admission must affect future starts, not this broadcast.
		await input.actions.saveRunnerDestination({ ownerId, runnerId: input.runnerId, id: ids[0], expectedRevision: 1, name: expected[0].name, provider: expected[0].provider, rtmpUrl: "rtmp://127.0.0.1:19442/changed", credentialAction: "replace", streamKey: "private-new-target-key" });
		const response = await heartbeat();
		const job = response.body.jobs?.find((row: { id: string }) => row.id === configured.id);
		let telemetryAccepted: boolean | undefined;
		const expectedOutputs = ids.map((id, index) => ({ id, state: index === 0 ? "retrying" : "streaming" }));
		if (input.variant === "multistream_output_status") {
			const lease = (await input.fixture.pool.query("SELECT lease_id FROM runner_broadcast_admissions WHERE id=$1", [started.admissionId])).rows[0];
			const observed = await heartbeat([{ admissionId: started.admissionId, sessionId: configured.id, executionGeneration: started.executionGeneration, leaseId: lease.lease_id, configurationRevision: started.configurationRevision, state: "active", outputs: expectedOutputs }]);
			telemetryAccepted = hasAcceptedOutputReport(observed, started.admissionId);
		}
		const publicMcpSession = (await call("get_stream_session", { sessionId: configured.id })).result?.structuredContent;
		const allPublicSessions = await input.actions.getAllStreamSessions(ownerId);
		const publicSessions = await input.actions.getStreamSessionsForRunner(input.runnerId, ownerId);
		const publicSession = publicSessions.find((session) => session.id === configured.id);
		const original = expected.map((target, index) => ({ ...target, id: ids[index] }));
		const targetHash = hashExecutionTargets(original);
		const dispatchedAdmission = (await input.fixture.pool.query("SELECT lease_id FROM runner_broadcast_admissions WHERE id=$1", [admission?.id])).rows[0];
		const signatureVerified = !!job?.lease && verifyExecutionBundle(job.lease, { [job.lease.keyId]: publicKey.export({ type: "spki", format: "pem" }).toString() }, { ownerId, runnerId: input.runnerId, sessionId: configured.id, admissionId: started?.admissionId, leaseId: dispatchedAdmission?.lease_id, requestId: response.requestId, generation: started?.executionGeneration, configurationRevision: started?.configurationRevision, sourceId: overlayId, sourceRevision: 1, targetHash }) !== null;
		async function observeCapturedDeliveryResult() {
			return {
				...base,
				telemetryAccepted,
				expectedOutputs,
				publicOutputs: (publicSession as { outputs?: unknown[] } | undefined)?.outputs,
				mcpOutputs: publicMcpSession?.outputs,
				selectedIds: selected.map((row) => row.destination_id),
				expectedIds: ids,
				expectedSnapshotIds: ids.slice().sort(),
				admitted: started?.accepted === true,
				snapshotIds: admission?.target_ids_snapshot?.slice().sort(),
				snapshotEncrypted: typeof ciphertext === "string" && !expected.some((target) => ciphertext.includes(target.streamKey)),
				snapshotPreserved: JSON.stringify(snapshot?.destinations?.map((target: { id: string; rtmpUrl: string; streamKey: string }) => ({ id: target.id, rtmpUrl: target.rtmpUrl, streamKey: target.streamKey }))) === JSON.stringify(original.map(({ id, rtmpUrl, streamKey }) => ({ id, rtmpUrl, streamKey }))),
				dispatchedOriginal: original.every((target) => job?.destinations?.some((assigned: { id: string; rtmpUrl: string; streamKey: string }) => assigned.id === target.id && assigned.rtmpUrl === target.rtmpUrl && assigned.streamKey === target.streamKey)),
				signatureVerified,
				publicMcpSelection: publicMcpSession?.destinationIds,
				allPublicReadSafe: !JSON.stringify(allPublicSessions).includes("encryptedStreamKey") && !JSON.stringify(allPublicSessions).includes("rtmp://"),
				publicSelection: (publicSession as { destinationIds?: string[] } | undefined)?.destinationIds,
				publicReadSafe: !JSON.stringify(publicSessions).includes("encryptedStreamKey") && !JSON.stringify(publicSessions).includes("rtmp://"),
				publicSafe: ![...expected.map((target) => target.streamKey), "private-new-target-key", input.deviceToken].some((secret) => JSON.stringify({ configured, started }).includes(secret)),
			};
		}
		return await observeCapturedDeliveryResult();
	}
	return await observeCapturedDelivery();
}

async function runMediaProbe(input: Input, keys = ephemeralRunnerKeys(), onStarted?: () => Promise<void>) {
	const ownerId = "fixture-creator";
	const control = input.variant === "multistream_fixture_control";
	await input.fixture.pool.query("UPDATE users SET plan=$1 WHERE id=$2", [control ? "free" : "pro", ownerId]);
	const media = await (await import("./runner-multistream-media")).createMultistreamMedia(input, input.variant.startsWith("multistream_media_") ? [input.variant.replace("multistream_media_", "")] : control || input.variant === "multistream_independent_delivery" ? ["custom"] : ["youtube", "twitch"]);
	try {
		const ready = await media.ready();
		const overlayId = randomUUID();
		await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,$2,'private-media-source','Media source','active','Featured')", [overlayId, ownerId]);
		const { privateKey, publicKey } = keys;
		process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
		const { call } = await (await import("./runner-free-pro-probe")).runRunnerFreeProProbe(input);
		async function configureMediaSession() {
			let sessionId: string | undefined,
				revision = 1;
			if (control) {
				const target = ready.destinations[0];
				const saved = await input.actions.upsertStreamSession({ ownerId, runnerId: input.runnerId, overlayId, mode: "24/7" as Parameters<typeof input.actions.upsertStreamSession>[0]["mode"], rtmpUrl: target.rtmpUrl, streamKey: target.streamKey, resolution: "720p", fps: 15 });
				if (saved.success) sessionId = (await input.fixture.pool.query("SELECT id FROM stream_sessions WHERE owner_id=$1", [ownerId])).rows[0]?.id;
			} else {
				const ids: string[] = [];
				for (const target of ready.destinations) {
					const saved = await input.actions.saveRunnerDestination({ ownerId, runnerId: input.runnerId, ...target, credentialAction: target.streamKey ? "replace" : "clear" });
					if (saved.success) ids.push(saved.destination.id);
				}
				const configured = (await call("configure_stream_session", { runnerId: input.runnerId, overlayId, mode: "24/7", controlMode: "manual", destinationIds: ids, resolution: "720p", fps: 30, retryKey: `multistream-media-${input.runnerId}` })).result?.structuredContent;
				sessionId = configured?.id;
				revision = configured?.configurationRevision;
			}
			return { sessionId, revision };
		}
		const { sessionId, revision } = await configureMediaSession();
		if (!sessionId) return { authenticated: input.authenticated, sourcePrefixPreserved: ready.sourcePrefixPreserved, configurationAccepted: false };
		const { POST } = await import("@/app/api/runner/heartbeat/route");
		await POST(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: `Bearer ${input.deviceToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, requestId: randomUUID(), capabilities: ["admissions", "destinations", "drain", "runner_presentation", "free_lease"] }) }));
		const started = (await call("control_stream_session", { sessionId, expectedRevision: revision, state: "running" })).result?.structuredContent;
		if (!started?.accepted) return { authenticated: input.authenticated, configurationAccepted: true, admitted: false, error: started?.error };
		const playing = await media.start(started.executionGeneration, input.runnerId, input.deviceToken, publicKey.export({ type: "spki", format: "pem" }).toString(), started.admissionId);
		if (!playing.started) return { authenticated: input.authenticated, configurationAccepted: true, admitted: true, started: false };
		await onStarted?.();
		const stopped = (await call("control_stream_session", { sessionId, expectedRevision: started.configurationRevision, state: "stopped" })).result?.structuredContent;
		const result = await media.drain();
		return { authenticated: input.authenticated, sourcePrefixPreserved: ready.sourcePrefixPreserved, configurationAccepted: true, admitted: true, started: true, stopAccepted: stopped?.accepted === true, ...result };
	} finally {
		await media.close();
	}
}

async function runIndependentMedia(input: Input) {
	const runnerId = randomUUID(),
		deviceToken = randomUUID();
	await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,'fixture-creator','Independent media device',$2)", [runnerId, deviceToken]);
	const keys = ephemeralRunnerKeys();
	let started = 0;
	let release!: () => void;
	const bothStarted = new Promise<void>((resolve) => (release = resolve));
	const onStarted = async () => {
		if (++started === 2) release();
		let timer: ReturnType<typeof setTimeout>;
		try {
			await Promise.race([
				bothStarted,
				new Promise<never>((_, reject) => {
					timer = setTimeout(() => reject(new Error("Independent broadcast did not reach playback")), 25000);
				}),
			]);
		} finally {
			clearTimeout(timer!);
		}
	};
	const results = await Promise.all([runMediaProbe(input, keys, onStarted), runMediaProbe({ ...input, runnerId, deviceToken }, keys, onStarted)]);
	return { authenticated: input.authenticated, bothRan: started === 2, results };
}
