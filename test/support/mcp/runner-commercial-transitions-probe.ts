import { randomUUID } from "node:crypto";
import { runRunnerFreeProProbe } from "./runner-free-pro-probe";
import { ephemeralRunnerKeys } from "../runner/fixtures";
import { verifyExecutionBundle, ProExecutionPermit, hashExecutionTargets } from "../../../packages/runner/src/protocol";

export async function runRunnerCommercialTransitionsProbe(input: Parameters<typeof runRunnerFreeProProbe>[0]) {
	const previousFetch = globalThis.fetch;
	const previousKey = process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY;
	globalThis.fetch = (async (value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== input.origin) throw new Error("RUNNER_FIXTURE_EXTERNAL_IO_FORBIDDEN");
		return input.auth.handler(request);
	}) as typeof fetch;
	try {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
		const keys = ephemeralRunnerKeys();
		process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
		if (["_known_expiry", "_owner_snapshot", "_revoked_before_dispatch", "_revoked_after_dispatch", "_renewed_pending", "_owner_long_refresh"].some((suffix) => input.variant.endsWith(suffix))) return await runKnownExpiryBoundary(input, keys);
		const ownerId = "fixture-creator",
			overlayId = randomUUID();
		const zero = input.variant.endsWith("_zero");
		const single = input.variant.endsWith("_single");
		const many = input.variant.endsWith("_many");
		const scheduled = input.variant.endsWith("_scheduled");
		const activeCount = zero ? 0 : single || scheduled ? 1 : 2;
		const devices = Array.from({ length: 3 }, () => ({ runnerId: randomUUID(), sessionId: randomUUID(), token: randomUUID() }));
		await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id=$1", [ownerId]);
		await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,$2,'private-transition-source','Transition source','active','Featured')", [overlayId, ownerId]);
		for (const device of devices) {
			await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at,protocol_version,capabilities) VALUES($1,$2,'Transition device',$3,'online',now(),2,$4)", [device.runnerId, ownerId, device.token, JSON.stringify(["admissions", "destinations", "drain", "runner_presentation", "free_lease"])]);
			await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,rtmp_url) VALUES($1,$2,$3,$4,'24/7','rtmp://127.0.0.1:19350/live')", [device.sessionId, ownerId, device.runnerId, overlayId]);
		}
		if (zero || scheduled) await input.fixture.pool.query("UPDATE stream_sessions SET control_mode='scheduled' WHERE id=$1", [devices[0].sessionId]);
		const { call } = await runRunnerFreeProProbe(input);
		const capturedEnd = Math.floor(Date.now() / 1000) * 1000 + 120000;
		if (scheduled) {
			const device = devices[0],
				eventId = randomUUID();
			const start = new Date(capturedEnd - 3600000).toISOString(),
				end = new Date(capturedEnd).toISOString();
			// Use the same canonical target identity as the old scalar fixture.
			await input.fixture.pool.query("INSERT INTO runner_destinations(id,owner_id,runner_id,name,provider,rtmp_url) VALUES($1,$2,$3,'Captured expiry target','custom','rtmp://127.0.0.1:19350/live')", [device.sessionId, ownerId, device.runnerId]);
			await input.fixture.pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$1,$2,0)", [device.sessionId, ownerId]);
			await input.fixture.pool.query("INSERT INTO runner_schedule_events(id,owner_id,runner_id,session_id,overlay_id,title,timezone,recurrence,recurrence_anchor,local_start_date,local_end_date,local_start_time,local_end_time) VALUES($1,$2,$3,$4,$5,'Captured expiry window','UTC','once',$6,$6,$7,$8,$9)", [eventId, ownerId, device.runnerId, device.sessionId, overlayId, start.slice(0, 10), end.slice(0, 10), start.slice(11, 19), end.slice(11, 19)]);
			await input.fixture.pool.query("INSERT INTO runner_schedule_event_destinations(event_id,destination_id,owner_id,position) VALUES($1,$2,$3,0)", [eventId, device.sessionId, ownerId]);
		}
		for (const device of devices.slice(0, activeCount)) await call("control_stream_session", { sessionId: device.sessionId, expectedRevision: 1, state: "running" });
		const { POST } = await import("@/app/api/runner/heartbeat/route");
		const heartbeat = async (device: (typeof devices)[number], executions?: unknown[]) => {
			const requestId = randomUUID();
			const response = await POST(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: `Bearer ${device.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, requestId, executions, capabilities: ["admissions", "destinations", "drain", "runner_presentation", "free_lease"] }) }));
			return { body: await response.json(), requestId };
		};
		// Establish accepted active generations before expiry, rather than treating an
		// undispatched reservation as grandfathered output.
		async function establishAcceptedGenerations() {
			for (const device of devices.slice(0, activeCount)) {
				const first = await heartbeat(device);
				const job = first.body.jobs?.find((value: any) => value.id === device.sessionId);
				if (!job?.lease) throw new Error("TRANSITION_FIXTURE_PAID_START_UNAVAILABLE");
				const captured = (await input.fixture.pool.query("SELECT lease_id FROM runner_broadcast_admissions WHERE id=$1", [job.admissionId])).rows[0];
				const claims = verifyExecutionBundle(job.lease, { [job.lease.keyId]: keys.publicKey.export({ type: "spki", format: "pem" }).toString() }, { ...job, sessionId: device.sessionId, generation: job.executionGeneration, requestId: first.requestId, sourceId: overlayId, leaseId: captured.lease_id });
				if (claims?.policy !== "pro_broadcast") throw new Error("TRANSITION_FIXTURE_INVALID_START_SIGNATURE");
				await heartbeat(device, [{ admissionId: job.admissionId, sessionId: device.sessionId, executionGeneration: job.executionGeneration, leaseId: captured.lease_id, configurationRevision: job.configurationRevision, state: "active" }]);
			}
		}
		await establishAcceptedGenerations();
		const established = Number((await input.fixture.pool.query("SELECT count(*) FROM runner_broadcast_admissions WHERE owner_id=$1 AND state='active'", [ownerId])).rows[0].count);
		const readSessions = async () => (await input.fixture.pool.query("SELECT id,runner_id,overlay_id,mode,control_mode,rtmp_url,desired_state,configuration_revision FROM stream_sessions WHERE owner_id=$1 ORDER BY id", [ownerId])).rows;
		const readAdmissions = async () => (await input.fixture.pool.query("SELECT id,session_id,execution_generation,state,benefits_at_start FROM runner_broadcast_admissions WHERE owner_id=$1 ORDER BY id", [ownerId])).rows;
		const beforeSessions = await readSessions(),
			beforeAdmissions = await readAdmissions();
		await input.fixture.pool.query("UPDATE users SET plan='free' WHERE id=$1", [ownerId]);
		const { reconcileUserEntitlements } = await import("@/app/lib/entitlements");
		const reconciled = await reconcileUserEntitlements(ownerId);
		const afterSessions = await readSessions(),
			afterAdmissions = await readAdmissions();
		const settingsRetained = JSON.stringify(afterSessions.map(({ desired_state: _desiredState, configuration_revision: _configurationRevision, ...saved }) => saved)) === JSON.stringify(beforeSessions.map(({ desired_state: _desiredState, configuration_revision: _configurationRevision, ...saved }) => saved));
		async function observeScheduledExpiry() {
			// The active calendar window was captured by the real control path.
			// Never rewrite that immutable capture while output is active.
			const initial = (await input.fixture.pool.query("SELECT id,execution_generation,lease_id,configuration_revision,scheduled_end,occurrence_id,benefits_at_start FROM runner_broadcast_admissions WHERE session_id=$1", [devices[0].sessionId])).rows[0];
			const { issueFreeExecutionLease } = await import("@/server/runner/lease");
			const sampleAt = async (at: number) => {
				const originalNow = Date.now;
				Date.now = () => at;
				try {
					if (input.variant.startsWith("transition_workflow_")) {
						const response = await heartbeat(devices[0]);
						return { job: response.body.jobs?.find((value: any) => value.id === devices[0].sessionId), requestId: response.requestId };
					}
					const requestId = randomUUID();
					return { job: await issueFreeExecutionLease({ id: devices[0].runnerId, ownerId, token: devices[0].token }, devices[0].sessionId, requestId, input.fixture.db), requestId };
				} finally {
					Date.now = originalNow;
				}
			};
			const beforeEnd = await sampleAt(capturedEnd - 1);
			const beforeEndState = (await readSessions()).find((value) => value.id === devices[0].sessionId)?.desired_state;
			const expected = {
				occurrenceId: initial.occurrence_id,
				scheduledStart: initial.benefits_at_start.scheduledStart,
				ownerId,
				runnerId: devices[0].runnerId,
				sessionId: devices[0].sessionId,
				admissionId: initial.id,
				generation: initial.execution_generation,
				leaseId: initial.lease_id,
				configurationRevision: initial.configuration_revision,
				sourceRevision: 1,
				sourceId: overlayId,
				targetHash: hashExecutionTargets([{ id: devices[0].sessionId, rtmpUrl: "rtmp://127.0.0.1:19350/live", streamKey: null }]),
				scheduledEnd: capturedEnd,
			};
			const verified = beforeEnd.job?.lease ? verifyExecutionBundle(beforeEnd.job.lease, { [beforeEnd.job.lease.keyId]: keys.publicKey.export({ type: "spki", format: "pem" }).toString() }, { ...expected, requestId: beforeEnd.requestId }, capturedEnd - 1) : null;
			let monotonic = 0;
			const guard = new ProExecutionPermit(expected, beforeEnd.job?.lease ? { [beforeEnd.job.lease.keyId]: keys.publicKey.export({ type: "spki", format: "pem" }).toString() } : {}, () => monotonic);
			guard.beginRenewal({ requestId: beforeEnd.requestId, sentAt: 0 });
			guard.accept(beforeEnd.job?.lease);
			monotonic = 1;
			const localAtEnd = guard.state;
			const afterEnd = await sampleAt(capturedEnd);
			const final = (await input.fixture.pool.query("SELECT state,scheduled_end,occurrence_id FROM runner_broadcast_admissions WHERE id=$1", [initial.id])).rows[0];
			return {
				established,
				capturedEnd,
				signedEnd: (verified as { scheduledEnd?: number } | null)?.scheduledEnd,
				localAtEnd,
				beforeEndState,
				afterEndState: (await readSessions()).find((value) => value.id === devices[0].sessionId)?.desired_state,
				afterAdmissionState: final.state,
				afterCommand: afterEnd.job && "command" in afterEnd.job ? afterEnd.job.command : undefined,
				stopMode: afterEnd.job && "stopMode" in afterEnd.job ? afterEnd.job.stopMode : undefined,
				captureRetained: new Date(final.scheduled_end).getTime() === capturedEnd && final.occurrence_id === initial.occurrence_id,
				settingsRetained,
			};
		}
		if (scheduled) return await observeScheduledExpiry();
		async function observeCapturedAdmissionClosure() {
			const { controlStreamSession } = await import("@/server/resources/runners");
			const { toPublicResourceError } = await import("@/server/resources/errors");
			const principal = { kind: "session" as const, authUserId: input.actorId, sessionId: "fixture-transition-session", authenticatedAt: new Date(), organizationId: "creator-org" };
			const control = async (command: Record<string, unknown>) => {
				if (input.variant.startsWith("transition_workflow_")) return (await call("control_stream_session", command)).result?.structuredContent;
				try {
					return await controlStreamSession(principal, { creatorId: ownerId, ...command }, input.fixture.db);
				} catch (error) {
					return { error: toPublicResourceError(error) };
				}
			};
			const original = beforeAdmissions.find((value) => value.session_id === devices[0].sessionId);
			const oldSession = beforeSessions.find((value) => value.id === devices[0].sessionId);
			const stop = await control({ sessionId: devices[0].sessionId, expectedRevision: oldSession.configuration_revision, state: "stopped" });
			const beforeAck = await control({ sessionId: devices[2].sessionId, expectedRevision: 1, state: "running" });
			const occupiedBeforeAck = (await readAdmissions()).filter((value) => !["stopped", "failed_before_output"].includes(value.state)).length;
			const captured = (await input.fixture.pool.query("SELECT lease_id,configuration_revision FROM runner_broadcast_admissions WHERE id=$1", [original.id])).rows[0];
			await heartbeat(devices[0], [{ admissionId: original.id, sessionId: devices[0].sessionId, executionGeneration: original.execution_generation, leaseId: captured.lease_id, configurationRevision: captured.configuration_revision, state: "stopped", allOutputsClosed: true }]);
			let betweenCode, remainingBeforeLastAck;
			if (many) {
				const between = await control({ sessionId: devices[2].sessionId, expectedRevision: 1, state: "running" });
				betweenCode = between.error?.code;
				remainingBeforeLastAck = (await readAdmissions()).filter((value) => !["stopped", "failed_before_output"].includes(value.state)).length;
				const second = beforeAdmissions.find((value) => value.session_id === devices[1].sessionId);
				const secondSession = beforeSessions.find((value) => value.id === devices[1].sessionId);
				await control({ sessionId: devices[1].sessionId, expectedRevision: secondSession.configuration_revision, state: "stopped" });
				const secondLease = (await input.fixture.pool.query("SELECT lease_id,configuration_revision FROM runner_broadcast_admissions WHERE id=$1", [second.id])).rows[0];
				await heartbeat(devices[1], [{ admissionId: second.id, sessionId: devices[1].sessionId, executionGeneration: second.execution_generation, leaseId: secondLease.lease_id, configurationRevision: secondLease.configuration_revision, state: "stopped", allOutputsClosed: true }]);
			}
			const basic = await control({ sessionId: devices[2].sessionId, expectedRevision: 1, state: "running" });
			const final = await readAdmissions();
			return {
				established,
				beforeAckCode: beforeAck.error?.code,
				occupiedBeforeAck,
				stopAccepted: stop.desiredState === "stopped",
				betweenCode,
				remainingBeforeLastAck,
				closedOriginalGeneration: beforeAdmissions.every((original) => final.some((value) => value.id === original.id && value.execution_generation === original.execution_generation && value.state === "stopped")),
				basicAccepted: basic.desiredState === "running",
				freeAdmissionPaid: final.find((value) => value.session_id === devices[2].sessionId)?.benefits_at_start?.runnerPro,
				finalOccupied: final.filter((value) => !["stopped", "failed_before_output"].includes(value.state)).length,
				settingsRetained,
				safe: !JSON.stringify([stop, beforeAck, basic]).includes("private-transition-source"),
			};
		}
		if (single || many) return await observeCapturedAdmissionClosure();
		async function observeDowngradedIdleStart() {
			const { controlStreamSession } = await import("@/server/resources/runners");
			const principal = { kind: "session" as const, authUserId: input.actorId, sessionId: "fixture-transition-session", authenticatedAt: new Date(), organizationId: "creator-org" };
			const internal = input.variant === "transition_service_zero";
			const command = (index: number) => ({ creatorId: ownerId, sessionId: devices[index].sessionId, expectedRevision: 1, state: "running" });
			const paidDenied = internal ? await controlStreamSession(principal, command(0), input.fixture.db) : await call("control_stream_session", command(0));
			const paidAdmissions = Number((await input.fixture.pool.query("SELECT count(*) FROM runner_broadcast_admissions WHERE session_id=$1", [devices[0].sessionId])).rows[0].count);
			const paidSuccessAudits = Number((await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE target_id=$1 AND outcome='success'", [devices[0].sessionId])).rows[0].count);
			const paidStartUnchanged = JSON.stringify(await readSessions()) === JSON.stringify(afterSessions);
			const deniedCode = internal ? paidDenied.error?.code : paidDenied.result?.structuredContent?.error?.code;
			if (deniedCode !== "FEATURE_RESTRICTED") return { established, paidDenied, paidAdmissions, paidSuccessAudits, paidStartUnchanged, settingsRetained };
			const basic = internal ? await controlStreamSession(principal, command(1), input.fixture.db) : (await call("control_stream_session", command(1))).result?.structuredContent;
			const basicAdmission = (await input.fixture.pool.query("SELECT benefits_at_start FROM runner_broadcast_admissions WHERE session_id=$1", [devices[1].sessionId])).rows[0];
			return { established, paidDenied, paidAdmissions, paidSuccessAudits, paidStartUnchanged, settingsRetained, basicAccepted: basic.desiredState === "running", basicAdmissionPaid: basicAdmission?.benefits_at_start?.runnerPro, safe: !JSON.stringify([paidDenied, basic]).includes("private-transition-source") };
		}
		if (zero) return await observeDowngradedIdleStart();
		if (input.variant === "transition_service_multiple") return { established, reconciled, beforeSessions, afterSessions, beforeAdmissions, afterAdmissions, settingsRetained, runnersOnline: Number((await input.fixture.pool.query("SELECT count(*) FROM runners WHERE owner_id=$1 AND status='online'", [ownerId])).rows[0].count) };
		async function observeGrandfatheredContinuation() {
			const jobs = [];
			for (const device of devices.slice(0, 2)) {
				const { body, requestId } = await heartbeat(device);
				const job = body.jobs?.find((value: any) => value.id === device.sessionId);
				const original = beforeAdmissions.find((value) => value.session_id === device.sessionId);
				const captured = original ? (await input.fixture.pool.query("SELECT lease_id FROM runner_broadcast_admissions WHERE id=$1", [original.id])).rows[0] : null;
				const claims = job?.lease ? verifyExecutionBundle(job.lease, { [job.lease.keyId]: keys.publicKey.export({ type: "spki", format: "pem" }).toString() }, { ...job, sessionId: device.sessionId, generation: job.executionGeneration, requestId, sourceId: overlayId, leaseId: captured?.lease_id }) : null;
				jobs.push({ desiredState: job?.desiredState, signed: claims?.policy === "pro_broadcast", originalGeneration: job?.executionGeneration === original?.execution_generation });
			}
			const denied = await call("control_stream_session", { sessionId: devices[2].sessionId, expectedRevision: 1, state: "running" });
			return { established, jobs, denied, occupied: (await readAdmissions()).filter((value) => !["stopped", "failed_before_output"].includes(value.state)).length, thirdState: (await readSessions()).find((value) => value.id === devices[2].sessionId)?.desired_state, settingsRetained, safe: !JSON.stringify([jobs, denied]).includes("private-transition-source") };
		}
		return await observeGrandfatheredContinuation();
	} finally {
		globalThis.fetch = previousFetch;
		restoreSigningKey(previousKey);
	}
}

async function runKnownExpiryBoundary(input: Parameters<typeof runRunnerFreeProProbe>[0], keys: ReturnType<typeof ephemeralRunnerKeys>) {
	const ownerId = "fixture-creator",
		runnerId = randomUUID(),
		overlayId = randomUUID(),
		token = randomUUID();
	const sessionIds = [randomUUID(), randomUUID()];
	const revokedBeforeDispatch = input.variant.endsWith("_revoked_before_dispatch");
	const longProfile = input.variant.endsWith("_owner_long_refresh");
	const knownEnd = Date.now() + (longProfile ? 30 * 86400000 : 120000);
	await input.fixture.pool.query("UPDATE users SET plan='free' WHERE id=$1", [ownerId]);
	await input.fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at,ends_at) VALUES($1,'pro_access','support',now()-interval '1 hour',$2)", [ownerId, revokedBeforeDispatch ? null : new Date(knownEnd)]);
	await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at,protocol_version,capabilities) VALUES($1,$2,'Known expiry device',$3,'online',now(),2,$4)", [runnerId, ownerId, token, JSON.stringify(["admissions", "destinations", "drain", "runner_presentation", "free_lease"])]);
	await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,$2,'private-known-expiry-source','Expiry source','active','Featured')", [overlayId, ownerId]);
	for (const id of sessionIds) await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,rtmp_url) VALUES($1,$2,$3,$4,'24/7','rtmp://127.0.0.1:19350/live')", [id, ownerId, runnerId, overlayId]);
	const { call } = await runRunnerFreeProProbe(input);
	const { controlStreamSession } = await import("@/server/resources/runners");
	const { toPublicResourceError } = await import("@/server/resources/errors");
	const principal = { kind: "session" as const, authUserId: input.actorId, sessionId: "fixture-known-expiry-session", authenticatedAt: new Date(), organizationId: "creator-org" };
	const start = async (index: number, expectedRevision = 1) => {
		const command = { creatorId: ownerId, sessionId: sessionIds[index], expectedRevision, state: "running" };
		if (input.variant.startsWith("transition_workflow_")) return (await call("control_stream_session", command)).result?.structuredContent;
		try {
			return await controlStreamSession(principal, command, input.fixture.db);
		} catch (error) {
			return { error: toPublicResourceError(error) };
		}
	};
	await start(0);
	if (revokedBeforeDispatch) await input.fixture.pool.query("UPDATE entitlement_grants SET revoked_at=now() WHERE user_id=$1 AND entitlement='pro_access'", [ownerId]);
	const { POST } = await import("@/app/api/runner/heartbeat/route");
	const heartbeat = async (executions?: unknown[]) => {
		const requestId = randomUUID();
		const response = await POST(new Request(input.origin + "/api/runner/heartbeat", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 2, requestId, executions, capabilities: ["admissions", "destinations", "drain", "runner_presentation", "free_lease"] }) }));
		return { body: await response.json(), requestId };
	};
	const first = await heartbeat();
	async function observeRevokedReservation() {
		const before = (await input.fixture.pool.query("SELECT * FROM runner_broadcast_admissions WHERE session_id=$1", [sessionIds[0]])).rows[0];
		const next = await start(1);
		return { freshPaidPermit: first.body.jobs?.some((job: any) => Boolean(job.lease)) ?? false, admissionState: before.state, dispatched: before.dispatched_at !== null, nextAccepted: !next.error, capturedPaid: before.benefits_at_start.runnerPro };
	}
	if (revokedBeforeDispatch) return await observeRevokedReservation();
	const job = first.body.jobs?.find((value: any) => value.id === sessionIds[0]);
	const captured = (await input.fixture.pool.query("SELECT * FROM runner_broadcast_admissions WHERE session_id=$1", [sessionIds[0]])).rows[0];
	const expected = { ownerId, runnerId, sessionId: sessionIds[0], admissionId: captured.id, generation: captured.execution_generation, leaseId: captured.lease_id, configurationRevision: captured.configuration_revision, sourceId: overlayId, sourceRevision: 1, targetHash: hashExecutionTargets([{ id: sessionIds[0], rtmpUrl: "rtmp://127.0.0.1:19350/live", streamKey: null }]), scheduledEnd: null };
	const trusted = { [job.lease.keyId]: keys.publicKey.export({ type: "spki", format: "pem" }).toString() };
	const claims = verifyExecutionBundle(job.lease, trusted, { ...expected, requestId: first.requestId });
	if (!claims || claims.policy !== "pro_broadcast") throw new Error("KNOWN_EXPIRY_FIXTURE_PAID_PERMIT_INVALID");
	async function observeRevokedDispatch() {
		await input.fixture.pool.query("UPDATE entitlement_grants SET revoked_at=now() WHERE user_id=$1 AND entitlement='pro_access'", [ownerId]);
		const uncertain = await heartbeat();
		const pending = uncertain.body.jobs?.find((value: any) => value.id === sessionIds[0]);
		const denied = await start(1);
		const late = await heartbeat([{ admissionId: captured.id, sessionId: sessionIds[0], executionGeneration: captured.execution_generation, leaseId: captured.lease_id, configurationRevision: captured.configuration_revision, state: "active" }]);
		return {
			pendingBound: pending?.admissionId === captured.id && pending?.executionGeneration === captured.execution_generation,
			freshPaidPermit: Boolean(pending?.lease),
			occupied: Number((await input.fixture.pool.query("SELECT count(*) FROM runner_broadcast_admissions WHERE owner_id=$1 AND state NOT IN ('stopped','failed_before_output')", [ownerId])).rows[0].count),
			secondCode: denied.error?.code,
			lateAckAccepted: late.body.acceptedExecutions?.some((value: any) => value.admissionId === captured.id && value.state === "active"),
			lateContinuation: Boolean(late.body.jobs?.find((value: any) => value.id === sessionIds[0])?.lease),
		};
	}
	if (input.variant.endsWith("_revoked_after_dispatch")) return await observeRevokedDispatch();
	async function observeLongProfileRefresh() {
		const { RunnerBenefitSnapshotCache } = await import("../../../packages/runner/src/protocol");
		let profileElapsed = 0;
		const cache = new RunnerBenefitSnapshotCache({ ownerId, runnerId, keys: trusted, clock: () => profileElapsed });
		const firstAccepted = cache.accept(first.body.benefitSnapshot, { requestId: first.requestId, sentAt: 0 });
		if (!firstAccepted || !cache.capabilities) return { firstAccepted: false };
		const profileIssuedAt = Date.parse(cache.capabilities.evaluatedAt);
		const firstClaims = JSON.parse(Buffer.from(first.body.benefitSnapshot.payload, "base64url").toString("utf8"));
		const previousNow = Date.now;
		try {
			profileElapsed = 604800000 - 1000;
			Date.now = () => profileIssuedAt + profileElapsed;
			const refreshed = await heartbeat();
			const refreshAccepted = cache.accept(refreshed.body.benefitSnapshot, { requestId: refreshed.requestId, sentAt: profileElapsed });
			profileElapsed = 604800000;
			const paidAfterFirstHorizon = cache.runnerPro;
			profileElapsed = knownEnd - profileIssuedAt - 1000;
			const last = await heartbeat();
			const lastAccepted = cache.accept(last.body.benefitSnapshot, { requestId: last.requestId, sentAt: profileElapsed });
			profileElapsed = knownEnd - profileIssuedAt - 1;
			const paidBeforeKnownEnd = cache.runnerPro;
			profileElapsed += 1;
			return { firstAccepted, firstHorizon: firstClaims.expiresAt - firstClaims.issuedAt, refreshAccepted, paidAfterFirstHorizon, lastAccepted, paidBeforeKnownEnd, paidAtKnownEnd: cache.runnerPro };
		} finally {
			Date.now = previousNow;
		}
	}
	if (longProfile) return await observeLongProfileRefresh();
	let monotonic = 0;
	const accepted = new ProExecutionPermit(expected, trusted, () => monotonic);
	accepted.beginRenewal({ requestId: first.requestId, sentAt: 0 });
	if (!accepted.accept(job.lease)) throw new Error("KNOWN_EXPIRY_FIXTURE_ACCEPTANCE_FAILED");
	monotonic = knownEnd - claims.issuedAt;
	const delayed = new ProExecutionPermit(expected, trusted, () => monotonic);
	delayed.beginRenewal({ requestId: first.requestId, sentAt: 0 });
	const delayedStartAccepted = delayed.accept(job.lease);
	const originalNow = Date.now;
	Date.now = () => knownEnd;
	try {
		const expired = await heartbeat();
		const expiredJob = expired.body.jobs?.find((value: any) => value.id === sessionIds[0]);
		async function observePendingRenewal() {
			const renewedEnd = knownEnd + 86400000;
			await input.fixture.pool.query("UPDATE entitlement_grants SET ends_at=$2 WHERE user_id=$1 AND entitlement='pro_access'", [ownerId, new Date(renewedEnd)]);
			Date.now = () => knownEnd + 1000;
			monotonic += 1000;
			const renewal = await heartbeat();
			const renewedJob = renewal.body.jobs?.find((value: any) => value.id === sessionIds[0]);
			const refreshedClaims = renewedJob?.lease ? verifyExecutionBundle(renewedJob.lease, trusted, { ...expected, requestId: renewal.requestId }, Date.now()) : null;
			accepted.beginRenewal({ requestId: renewal.requestId, sentAt: monotonic });
			const localRenewalAccepted = accepted.accept(renewedJob?.lease);
			const saved = (await input.fixture.pool.query("SELECT benefits_at_start FROM runner_broadcast_admissions WHERE id=$1", [captured.id])).rows[0];
			const current = (await input.fixture.pool.query("SELECT configuration_revision FROM stream_sessions WHERE id=$1", [sessionIds[0]])).rows[0];
			const repeated = await start(0, current.configuration_revision);
			return {
				validFreshPermit: refreshedClaims?.policy === "pro_broadcast",
				freshExpiry: refreshedClaims?.expiresAt,
				expectedExpiry: Date.now() + 300000,
				sameGeneration: renewedJob?.admissionId === captured.id && renewedJob?.executionGeneration === captured.execution_generation,
				localRenewalAccepted,
				capturedHistorySame: JSON.stringify(saved.benefits_at_start) === JSON.stringify(captured.benefits_at_start),
				repeatAccepted: !repeated.error,
				admissions: Number((await input.fixture.pool.query("SELECT count(*) FROM runner_broadcast_admissions WHERE owner_id=$1", [ownerId])).rows[0].count),
			};
		}
		if (input.variant.endsWith("_renewed_pending")) return await observePendingRenewal();
		const denied = await start(1);
		const occupied = Number((await input.fixture.pool.query("SELECT count(*) FROM runner_broadcast_admissions WHERE owner_id=$1 AND state NOT IN ('stopped','failed_before_output')", [ownerId])).rows[0].count);
		const late = await heartbeat([{ admissionId: captured.id, sessionId: sessionIds[0], executionGeneration: captured.execution_generation, leaseId: captured.lease_id, configurationRevision: captured.configuration_revision, state: "active" }]);
		function observeExpiryOutcome(validClaims: NonNullable<typeof claims>) {
			return {
				knownEnd: new Date(knownEnd).toISOString(),
				capturedValidity: captured.benefits_at_start.validUntil,
				permitExpiresAt: new Date(validClaims.expiresAt).toISOString(),
				delayedStartAccepted,
				acceptedStillActive: accepted.state === "active",
				expiredFreshPermit: Boolean(expiredJob?.lease),
				pendingBound: expiredJob?.admissionId === captured.id && expiredJob?.executionGeneration === captured.execution_generation,
				secondCode: denied.error?.code,
				occupied,
				lateAckAccepted: late.body.acceptedExecutions?.some((value: any) => value.admissionId === captured.id && value.state === "active"),
				lateContinuation: Boolean(late.body.jobs?.find((value: any) => value.id === sessionIds[0])?.lease),
			};
		}
		const outcome = observeExpiryOutcome(claims);
		if (!input.variant.endsWith("_owner_snapshot")) return outcome;
		async function observeOwnerSnapshotExpiry() {
			const verifier = Reflect.get(await import("../../../packages/runner/src/protocol"), "verifyRunnerBenefitSnapshot");
			if (typeof verifier !== "function" || !first.body.benefitSnapshot || !expired.body.benefitSnapshot) return { ...outcome, snapshotPresent: false };
			const scope = { ownerId, runnerId, configurationRevision: 1 };
			const before = verifier(first.body.benefitSnapshot, trusted, { ...scope, requestId: first.requestId }, knownEnd - 1);
			const baseline = verifier(expired.body.benefitSnapshot, trusted, { ...scope, requestId: expired.requestId }, knownEnd);
			if (!before || !baseline) throw new Error("OWNER_SNAPSHOT_FIXTURE_VERIFICATION_FAILED");
			const Cache = Reflect.get(await import("../../../packages/runner/src/protocol"), "RunnerBenefitSnapshotCache");
			if (typeof Cache !== "function") return { ...outcome, snapshotPresent: true, cacheAvailable: false, beforePolicy: before?.capabilities, afterPolicy: baseline?.capabilities };
			let cacheMonotonic = 0;
			const guard = new Cache({ ownerId, runnerId, keys: trusted, clock: () => cacheMonotonic });
			const cachedAccepted = guard.accept(first.body.benefitSnapshot, { requestId: first.requestId, sentAt: 0 });
			const cachedPaidBefore = guard.runnerPro;
			cacheMonotonic = knownEnd - before.issuedAt;
			const cachedPaidAfter = guard.runnerPro;
			return {
				...outcome,
				snapshotPresent: true,
				cacheAvailable: true,
				cachedAccepted,
				cachedPaidBefore,
				cachedPaidAfter,
				cachedScope: guard.scope,
				beforePolicy: before?.capabilities,
				afterPolicy: baseline?.capabilities,
				ownerBound: verifier(first.body.benefitSnapshot, trusted, { ...scope, ownerId: "operator", requestId: first.requestId }, knownEnd - 1) === null,
				runnerBound: verifier(first.body.benefitSnapshot, trusted, { ...scope, runnerId: randomUUID(), requestId: first.requestId }, knownEnd - 1) === null,
			};
		}
		return await observeOwnerSnapshotExpiry();
	} finally {
		Date.now = originalNow;
	}
}

function restoreSigningKey(value: string | undefined) {
	if (value === undefined) delete process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY;
	else process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = value;
}
