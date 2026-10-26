import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { runRunnerScheduleProbe } from "./runner-schedule-probe";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import * as schedules from "@/server/runner/schedules";
type Input = Parameters<typeof runRunnerScheduleProbe>[0];

export async function runRunnerScheduleAutomationProbe(input: Input) {
	const ownerId = "fixture-creator",
		overlayId = randomUUID(),
		sessionId = randomUUID(),
		targetId = randomUUID();
	await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,$2,'automation-source-secret','Automation source','active','Featured')", [overlayId, ownerId]);
	await input.fixture.pool.query("INSERT INTO runner_destinations(id,owner_id,name,provider,rtmp_url) VALUES($1,$2,'Automation target','custom','rtmp://127.0.0.1:1949/live')", [targetId, ownerId]);
	await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode) VALUES($1,$2,$3,$4,'24/7','scheduled')", [sessionId, ownerId, input.runnerId, overlayId]);
	await input.fixture.pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,$3,0)", [sessionId, targetId, ownerId]);
	const principal = await getVerifiedSessionPrincipal();
	if (!principal) throw new Error("AUTOMATION_FIXTURE_PRINCIPAL_UNAVAILABLE");
	const saved = await schedules.saveRunnerScheduleEventForPrincipal(principal, { ownerId, runnerId: input.runnerId, sessionId, title: "Retained automation event", timezone: "UTC", recurrence: "once", localStartDate: "2027-01-04", localEndDate: "2027-01-04", localStartTime: "12:00", localEndTime: "13:00", overlayId, destinationIds: [targetId], enabled: true });
	const now = Date.parse("2027-01-04T11:00:00Z");
	const before = await schedules.getRunnerScheduleSnapshotForPrincipal(principal, { ownerId, runnerId: input.runnerId }, new Date(now));
	const deviceBefore = (await input.fixture.pool.query("SELECT configuration_revision FROM runners WHERE id=$1", [input.runnerId])).rows[0].configuration_revision;
	const safetyControls: Record<string, unknown> = {};
	const pause = await schedules.setRunnerAutomationPausedForPrincipal(principal, { ownerId, runnerId: input.runnerId, sessionId, expectedRevision: 1, expectedAutomationRevision: 0, paused: true });
	if (!pause.success) return { authenticated: input.authenticated, safetyControls, saved, before, pause };
	const session = (await input.fixture.pool.query("SELECT control_mode,configuration_revision,automation_revision,automation_paused_at,desired_state FROM stream_sessions WHERE id=$1", [sessionId])).rows[0];
	const after = await schedules.getRunnerScheduleSnapshotForPrincipal(principal, { ownerId, runnerId: input.runnerId }, new Date(now));
	const deviceAfter = (await input.fixture.pool.query("SELECT configuration_revision FROM runners WHERE id=$1", [input.runnerId])).rows[0].configuration_revision;
	const retained = await schedules.listRunnerScheduleEventsForPrincipal(principal, { ownerId, runnerId: input.runnerId });
	const control = { ownerId, runnerId: input.runnerId, sessionId, expectedRevision: 1, expectedAutomationRevision: 1, paused: true };
	const snapshot = async () => JSON.stringify((await input.fixture.pool.query("SELECT automation_revision,automation_paused_at,configuration_revision FROM stream_sessions WHERE id=$1", [sessionId])).rows);
	const pausedSnapshot = await snapshot();
	const stale = await schedules.setRunnerAutomationPausedForPrincipal(principal, { ...control, expectedAutomationRevision: 0, paused: false });
	const staleUnchanged = pausedSnapshot === (await snapshot());
	const missing = await schedules.setRunnerAutomationPausedForPrincipal(principal, { ...control, sessionId: randomUUID() });
	const missingUnchanged = pausedSnapshot === (await snapshot());
	const repeat = await schedules.setRunnerAutomationPausedForPrincipal(principal, control);
	const repeatUnchanged = pausedSnapshot === (await snapshot());
	const deviceAfterRepeat = (await input.fixture.pool.query("SELECT configuration_revision FROM runners WHERE id=$1", [input.runnerId])).rows[0].configuration_revision;
	const resume = await schedules.setRunnerAutomationPausedForPrincipal(principal, { ...control, paused: false });
	const resumedSession = (await input.fixture.pool.query("SELECT control_mode,configuration_revision,automation_revision,automation_paused_at,desired_state FROM stream_sessions WHERE id=$1", [sessionId])).rows[0];
	const resumedSnapshot = await schedules.getRunnerScheduleSnapshotForPrincipal(principal, { ownerId, runnerId: input.runnerId }, new Date(now));
	const deviceAfterResume = (await input.fixture.pool.query("SELECT configuration_revision FROM runners WHERE id=$1", [input.runnerId])).rows[0].configuration_revision;
	await input.fixture.pool.query("INSERT INTO auth.organization_role(id,organization_id,role,permission) VALUES('automation-reader-role','creator-org','automation-reader',$1)", [JSON.stringify({ creator: ["read"], runner: ["read"] })]);
	const authorityState = async () =>
		JSON.stringify({
			session: (await input.fixture.pool.query("SELECT configuration_revision,automation_revision,automation_paused_at,control_mode,mode,desired_state FROM stream_sessions WHERE id=$1", [sessionId])).rows,
			device: (await input.fixture.pool.query("SELECT configuration_revision FROM runners WHERE id=$1", [input.runnerId])).rows,
			audit: (await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE outcome='success' AND target_id=$1", [sessionId])).rows,
		});
	for (const vector of ["read_only", "free_pause", "manual_mode", "fallback_mode", "foreign_runner", "stale_media", "extra_field"]) {
		const before = await authorityState(),
			rollback = new Error("AUTOMATION_SAFETY_ROLLBACK");
		let observed: unknown;
		try {
			await input.fixture.db.transaction(async (tx) => {
				if (vector === "read_only") await tx.execute(sql`UPDATE auth.member SET role='automation-reader' WHERE user_id=${input.actorId} AND organization_id='creator-org'`);
				if (vector === "free_pause") await tx.execute(sql`UPDATE users SET plan='free' WHERE id=${ownerId}`);
				if (vector === "manual_mode") await tx.execute(sql`UPDATE stream_sessions SET control_mode='manual' WHERE id=${sessionId}`);
				if (vector === "fallback_mode") await tx.execute(sql`UPDATE stream_sessions SET mode='failsafe',control_mode='manual' WHERE id=${sessionId}`);
				const candidate = { ...control, expectedAutomationRevision: 2, ...(vector === "foreign_runner" ? { runnerId: randomUUID() } : {}), ...(vector === "stale_media" ? { expectedRevision: 2 } : {}), ...(vector === "extra_field" ? { clock: now } : {}) };
				const result = await schedules.setRunnerAutomationPausedForPrincipal(principal, candidate, tx);
				let freeResume: unknown;
				if (vector === "free_pause" && result.success) freeResume = await schedules.setRunnerAutomationPausedForPrincipal(principal, { ...candidate, expectedAutomationRevision: 3, paused: false }, tx);
				observed = { result, ...(freeResume ? { freeResume } : {}) };
				throw rollback;
			});
		} catch (error) {
			if (error !== rollback) throw error;
		}
		safetyControls[vector] = { ...(observed as object), unchanged: before === (await authorityState()) };
	}
	return { authenticated: input.authenticated, safetyControls, saved, before, pause, session, after, retained, deviceBefore, deviceAfter, stale, staleUnchanged, missing, missingUnchanged, repeat, repeatUnchanged, deviceAfterRepeat, resume, resumedSession, resumedSnapshot, deviceAfterResume };
}
