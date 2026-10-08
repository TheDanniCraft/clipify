/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-OVERLAY-REWARD-OWNERSHIP-001 server-owned reward validation", () => {
	test("owned reward commits configuration/audit/intent after unlocked native HTTP validation", () => {
		const result = runMcpProbe("overlay-reward-ownership-probe", ["owned"]);
		expect(result).toMatchObject({ saved: true, rewardId: "RewardOne", revision: 2, jobs: 1, audits: 1, calls: 1, requestValid: true, lockFree: true });
	});
	test.each(["foreign-reward", "wrong-reward", "empty", "not-found", "rate", "provider-error", "malformed", "wrong-content-type", "oversized"])("%s reward metadata cannot alter resources or queue effects", (mode) => {
		const result = runMcpProbe("overlay-reward-ownership-probe", [mode]);
		expect(result).toMatchObject({ saved: false, rewardId: null, revision: 1, jobs: 0, audits: 0, calls: 1, requestValid: true, lockFree: true });
	});
	test.each(["missing-credentials", "stale", "free", "removed-member", "foreign-session", "unauthenticated"])("%s denies before provider metadata I/O", (mode) => {
		const result = runMcpProbe("overlay-reward-ownership-probe", [mode]);
		expect(result).toMatchObject({ saved: false, rewardId: null, revision: 1, jobs: 0, audits: 0, calls: 0 });
	});
	test.each(["unchanged", "unchanged-free", "clear"])("%s reward preserves ordinary edit without provider validation", (mode) => {
		const result = runMcpProbe("overlay-reward-ownership-probe", [mode]);
		expect(result).toMatchObject({ saved: true, rewardId: mode === "clear" ? null : "RewardOne", revision: 2, jobs: 0, audits: 1, calls: 0 });
	});
	test.each(["plan-change", "membership-change", "revision-change", "rollback"])("%s during provider validation cannot commit an outdated reward", (mode) => {
		const result = runMcpProbe("overlay-reward-ownership-probe", [mode]);
		expect(result).toMatchObject({ saved: false, rewardId: null, revision: mode === "revision-change" ? 2 : 1, jobs: 0, audits: 0, calls: 1, lockFree: true });
	});
});
