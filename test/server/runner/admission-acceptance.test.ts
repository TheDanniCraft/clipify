/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

test("TDD-US1-CON001 U137 direct / TDD-US1-SC001 U36: the shared admission service serializes callers without an outer mutex", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:admission_service_lock");
	expect(result.observedLocks).toBe(2);
	expect(result.beforeRelease).toBe(0);
	expect(result.accepted).toBe(1);
	expect(result.loserCodes).toEqual(["RUNNER_CONCURRENCY_LIMIT"]);
	expect(result.occupied).toBe(1);
	expect(result.desiredRunning).toBe(0);
});

test("TDD-US1-SC006 U136: a long-running active Free lease denies another reservation for concurrency without consuming time", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:free_admission_extended");
	expect(result.extendedHours).toBeGreaterThanOrEqual(1000);
	expect(result.monthlyUsageLimit).toBeNull();
	expect(result.accepted).toBe(false);
	expect(result.errorCode).toBe("RUNNER_CONCURRENCY_LIMIT");
	expect(result.holderUnchanged).toBe(true);
	expect(result.occupied).toBe(1);
	expect(result.second).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
});
