import { randomUUID } from "node:crypto";
import type { runRunnerFreeProProbe } from "./runner-free-pro-probe";
import type * as RunnerActions from "@/app/actions/runner";
type Input = Parameters<typeof runRunnerFreeProProbe>[0] & { authenticated: boolean; runnerId: string; deviceToken: string; actions: typeof RunnerActions };

export async function runRunnerScheduleProbe(input: Input) {
	if (input.variant === "schedule_continuity") return (await import("./runner-schedule-continuity-probe")).runRunnerScheduleContinuityProbe(input);
	if (input.variant === "schedule_automation") return (await import("./runner-schedule-automation-probe")).runRunnerScheduleAutomationProbe(input);
	if (input.variant === "schedule_contract") return (await import("./runner-schedule-contract-probe")).runRunnerScheduleContractProbe(input);
	const ownerId = "fixture-creator";
	await input.fixture.pool.query("INSERT INTO auth.organization_role(id,organization_id,role,permission) VALUES('schedule-reader-role','creator-org','schedule-reader',$1)", [JSON.stringify({ creator: ["read"], runner: ["read"] })]);
	await input.fixture.pool.query("UPDATE auth.member SET role='schedule-reader' WHERE user_id=$1 AND organization_id='creator-org'", [input.actorId]);
	const snapshot = async () => (await input.fixture.pool.query("SELECT row_to_json(r) AS value FROM runners r WHERE owner_id=$1 ORDER BY id", [ownerId])).rows;
	const before = await snapshot();
	const auditsBefore = (await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE outcome='success'")).rows[0].count;
	const save = Reflect.get(input.actions, "saveRunnerScheduleEvent");
	if (input.variant !== "schedule_permission_service" && typeof save !== "function") return { authenticated: input.authenticated, available: false };
	const draft = { ownerId, runnerId: input.runnerId, id: randomUUID(), expectedRevision: 1, title: "Vacation", timeZone: "Europe/Berlin", recurrence: "once", localStartDate: "2027-01-04", localEndDate: "2027-01-06", localStartTime: "12:00", localEndTime: "12:00", overlayId: randomUUID(), destinationIds: [randomUUID()] };
	let result;
	if (input.variant === "schedule_permission_service") {
		const { getVerifiedSessionPrincipal } = await import("@/auth/session-principal");
		const principal = await getVerifiedSessionPrincipal();
		if (!principal) throw new Error("SCHEDULE_FIXTURE_PRINCIPAL_UNAVAILABLE");
		const service = await import("@/server/runner/schedules");
		result = await service.saveRunnerScheduleEventForPrincipal(principal, draft);
	} else result = await save(draft);
	return { authenticated: input.authenticated, available: true, result, unchanged: JSON.stringify(before) === JSON.stringify(await snapshot()), successAudits: Number((await input.fixture.pool.query("SELECT count(*) FROM audit_events WHERE outcome='success'")).rows[0].count) - Number(auditsBefore) };
}
