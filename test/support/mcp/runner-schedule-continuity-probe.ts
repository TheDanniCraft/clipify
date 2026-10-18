import { randomUUID } from "node:crypto";
import type { runRunnerScheduleProbe } from "./runner-schedule-probe";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { ephemeralRunnerKeys } from "../runner/fixtures";
import * as schedules from "@/server/runner/schedules";
import { eq } from "drizzle-orm";
import { runnerBroadcastAdmissionsTable as admissions } from "@/db/schema";
import { requestBroadcastDrain } from "@/server/runner/admission";
import { acknowledgeFreeExecutions, issueFreeExecutionLease } from "@/server/runner/lease";
type Input = Parameters<typeof runRunnerScheduleProbe>[0];

export async function runRunnerScheduleContinuityProbe(input: Input) {
	const ownerId = "fixture-creator",
		overlayId = randomUUID(),
		sessionId = randomUUID(),
		targetId = randomUUID();
	await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,$2,'continuity-source-secret','Continuity source','active','Featured')", [overlayId, ownerId]);
	await input.fixture.pool.query("INSERT INTO runner_destinations(id,owner_id,runner_id,name,provider,rtmp_url) VALUES($1,$2,$3,'Continuity target','custom','rtmp://127.0.0.1:1949/live')", [targetId, ownerId, input.runnerId]);
	await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode) VALUES($1,$2,$3,$4,'24/7','scheduled')", [sessionId, ownerId, input.runnerId, overlayId]);
	await input.fixture.pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,$3,0)", [sessionId, targetId, ownerId]);
	await input.fixture.pool.query("UPDATE runners SET protocol_version=2,capabilities=$1::jsonb WHERE id=$2", [JSON.stringify(["admissions", "drain", "runner_presentation", "schedule_cache"]), input.runnerId]);
	const principal = await getVerifiedSessionPrincipal();
	if (!principal) throw new Error("CONTINUITY_FIXTURE_AUTH_MISSING");
	const { privateKey } = ephemeralRunnerKeys();
	process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
	const draft = { ownerId, runnerId: input.runnerId, sessionId, title: "First adjacent event", timezone: "UTC", recurrence: "once", localStartDate: "2027-01-04", localEndDate: "2027-01-04", localStartTime: "12:00", localEndTime: "13:00", overlayId, destinationIds: [targetId], enabled: true };
	const saved = await schedules.saveRunnerScheduleEventForPrincipal(principal, draft);
	const nextSaved = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ...draft, title: "Second adjacent event", localStartTime: "13:00", localEndTime: "14:00" });
	if (!saved.success || !nextSaved.success) throw new Error("CONTINUITY_FIXTURE_SAVE_DENIED");
	const identity = { id: input.runnerId, ownerId, token: input.deviceToken };
	const firstStart = Date.parse("2027-01-04T12:00:00Z"),
		boundary = firstStart + 3600000;
	const cache = await schedules.issueRunnerScheduleCache(identity, randomUUID(), input.fixture.db, () => firstStart - 3600000);
	const jobs = cache?.entries.map(({ job }) => job).sort((a, b) => a.scheduledStart! - b.scheduledStart!);
	if (!jobs || jobs.length !== 2) throw new Error("CONTINUITY_FIXTURE_TWO_AUTHORITIES_MISSING");
	const receipt = (index: number) => {
		const job = jobs[index],
			claims = JSON.parse(Buffer.from(job.lease.payload, "base64url").toString());
		return { admissionId: job.admissionId, sessionId, executionGeneration: job.executionGeneration, configurationRevision: job.configurationRevision, leaseId: claims.leaseId, state: "active" as const };
	};
	const firstActive = await acknowledgeFreeExecutions(identity, [receipt(0)], input.fixture.db, () => firstStart + 1);
	const automaticLease = await issueFreeExecutionLease(identity, sessionId, randomUUID(), input.fixture.db);
	const automaticDelivery = { permissionPending: automaticLease && "permissionPending" in automaticLease ? automaticLease.permissionPending : false, ordinaryLeaseIssued: !!automaticLease?.lease };
	const refreshed = await schedules.issueRunnerScheduleCache(identity, randomUUID(), input.fixture.db, () => firstStart + 2);
	const negativeJoins: Record<string, unknown> = {};
	const persisted = async () => JSON.stringify((await input.fixture.pool.query("SELECT row_to_json(r) FROM runner_broadcast_admissions r WHERE session_id=$1 ORDER BY id", [sessionId])).rows);
	for (const vector of ["different_media", "different_source_revision", "one_millisecond_gap", "uncertain_root", "revoked_root", "draining_root"]) {
		const before = await persisted(),
			rollback = new Error("CONTINUITY_VECTOR_ROLLBACK");
		let observed: unknown;
		try {
			await input.fixture.db.transaction(async (tx) => {
				const [member] = await tx.select().from(admissions).where(eq(admissions.id, jobs[1].admissionId));
				if (vector === "different_media")
					await tx
						.update(admissions)
						.set({ benefitsAtStart: { ...member.benefitsAtStart, executionPayloadHashAtStart: "b".repeat(64) } })
						.where(eq(admissions.id, member.id));
				if (vector === "different_source_revision")
					await tx
						.update(admissions)
						.set({ benefitsAtStart: { ...member.benefitsAtStart, sourceRevisionAtStart: Number(member.benefitsAtStart.sourceRevisionAtStart) + 1 } })
						.where(eq(admissions.id, member.id));
				if (vector === "one_millisecond_gap")
					await tx
						.update(admissions)
						.set({ benefitsAtStart: { ...member.benefitsAtStart, scheduledStart: boundary + 1 } })
						.where(eq(admissions.id, member.id));
				if (vector === "uncertain_root") await tx.update(admissions).set({ state: "uncertain" }).where(eq(admissions.id, jobs[0].admissionId));
				if (vector === "revoked_root")
					await tx
						.update(admissions)
						.set({ revokedAt: new Date(boundary) })
						.where(eq(admissions.id, jobs[0].admissionId));
				if (vector === "draining_root") {
					const [session] = await tx
						.select()
						.from((await import("@/db/schema")).streamSessionsTable)
						.where(eq((await import("@/db/schema")).streamSessionsTable.id, sessionId));
					await requestBroadcastDrain(tx, session);
				}
				const accepted = await acknowledgeFreeExecutions(identity, [receipt(1)], tx, () => boundary + 2);
				const [after] = await tx.select().from(admissions).where(eq(admissions.id, member.id));
				observed = { accepted: accepted.length, state: after.state, root: after.continuityRootAdmissionId };
				throw rollback;
			});
		} catch (error) {
			if (error !== rollback) throw error;
		}
		negativeJoins[vector] = { ...(observed as object), unchanged: before === (await persisted()) };
	}
	async function observeContinuityConstraints(approvedJobs: NonNullable<typeof jobs>) {
		const continuityConstraints: Record<string, unknown> = {};
		const foreignOwner = randomUUID();
		await input.fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES($1,$2,'Foreign continuity owner','','user','free')", [foreignOwner, foreignOwner + "@example.invalid"]);

		for (const vector of ["foreign_owner_root", "self_root", "second_physical_root"]) {
			const before = await persisted(),
				rollback = new Error("CONTINUITY_CONSTRAINT_ROLLBACK");
			let code = "accepted";
			try {
				await input.fixture.db.transaction(async (tx) => {
					if (vector === "foreign_owner_root") {
						const [foreign] = await tx.insert(admissions).values({ ownerId: foreignOwner, state: "authorized", configurationRevision: 1, executionGeneration: randomUUID(), benefitsAtStart: {} }).returning();
						await tx.update(admissions).set({ continuityRootAdmissionId: foreign.id }).where(eq(admissions.id, approvedJobs[1].admissionId));
					}
					if (vector === "self_root") await tx.update(admissions).set({ continuityRootAdmissionId: approvedJobs[1].admissionId }).where(eq(admissions.id, approvedJobs[1].admissionId));
					if (vector === "second_physical_root") await tx.insert(admissions).values({ ownerId, runnerId: input.runnerId, sessionId, state: "active", configurationRevision: 1, executionGeneration: randomUUID(), benefitsAtStart: { runnerPro: true } });
					throw rollback;
				});
			} catch (error) {
				if (error !== rollback) {
					let cause: unknown = error;
					for (let depth = 0; depth < 5 && cause && typeof cause === "object"; depth++) {
						if (typeof Reflect.get(cause, "code") === "string") {
							code = Reflect.get(cause, "code");
							break;
						}
						cause = Reflect.get(cause, "cause");
					}
					if (code === "accepted") throw error;
				}
			}
			continuityConstraints[vector] = { code, unchanged: before === (await persisted()) };
		}
		return continuityConstraints;
	}
	const continuityConstraints = await observeContinuityConstraints(jobs);
	const secondActive = await acknowledgeFreeExecutions(identity, [receipt(1)], input.fixture.db, () => boundary + 1);
	const states = (await input.fixture.pool.query("SELECT id,state,scheduled_end,stopped_at,to_jsonb(r)->>'continuity_root_admission_id' AS continuity_root FROM runner_broadcast_admissions r WHERE session_id=$1 ORDER BY scheduled_end", [sessionId])).rows;
	const repeatedFirst = await acknowledgeFreeExecutions(identity, [receipt(0)], input.fixture.db, () => boundary + 2);
	const afterRepeat = (await input.fixture.pool.query("SELECT id,state,scheduled_end,stopped_at,to_jsonb(r)->>'continuity_root_admission_id' AS continuity_root FROM runner_broadcast_admissions r WHERE session_id=$1 ORDER BY scheduled_end", [sessionId])).rows;
	const { streamSessionsTable } = await import("@/db/schema");
	const [session] = await input.fixture.db.select().from(streamSessionsTable).where(eq(streamSessionsTable.id, sessionId));
	await input.fixture.db.transaction((tx) => requestBroadcastDrain(tx, session));
	const drainedStates = (await input.fixture.pool.query("SELECT state FROM runner_broadcast_admissions WHERE session_id=$1 ORDER BY scheduled_end", [sessionId])).rows;
	const firstClosed = await acknowledgeFreeExecutions(identity, [{ ...receipt(0), state: "stopped", allOutputsClosed: true }], input.fixture.db, () => boundary + 3);
	const afterFirstClosed = (await input.fixture.pool.query("SELECT actual_state,desired_state FROM stream_sessions WHERE id=$1", [sessionId])).rows[0];
	const secondClosed = await acknowledgeFreeExecutions(identity, [{ ...receipt(1), state: "stopped", allOutputsClosed: true }], input.fixture.db, () => boundary + 4);
	const afterAllClosed = (await input.fixture.pool.query("SELECT actual_state,desired_state FROM stream_sessions WHERE id=$1", [sessionId])).rows[0];
	const finalStates = (await input.fixture.pool.query("SELECT state,scheduled_end,stopped_at FROM runner_broadcast_admissions WHERE session_id=$1 ORDER BY scheduled_end", [sessionId])).rows;
	return { authenticated: input.authenticated, automaticDelivery, continuityConstraints, negativeJoins, drainedStates, firstClosed, secondClosed, afterFirstClosed, afterAllClosed, finalStates, firstActive, secondActive, repeatedFirst, originalIds: jobs.map((job) => job.admissionId), initialCount: jobs.length, refreshedIds: refreshed?.entries.map(({ job }) => job.admissionId), firstEnd: boundary, secondEnd: boundary + 3600000, states, afterRepeat };
}
