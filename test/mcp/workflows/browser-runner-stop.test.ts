/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";

test.each(["graceful", "immediate"])("TDD-US1-FR004 dashboard action preserves %s stop intent until physical closure", (mode) => {
	const row = runMcpProbe("browser-playlist-delete-probe", [`runner-browser-stop-${mode}-admission`]);
	expect(row.runnerOutcome).toMatchObject({ success: true, accepted: true, applied: false, configurationRevision: 2 });
	expect(row.runnerSession).toMatchObject({ configuration_revision: 2, desired_state: "stopped", actual_state: "running" });
	expect(row.runnerStop).toEqual({ state: "draining", stopMode: mode, generationRetained: true, stoppedAt: null });
});

test("TDD-US1-FR004 dashboard emergency stop rejects stale configuration without changing the active execution", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["runner-browser-stop-immediate-stale-admission"]);
	expect(row.runnerOutcome).toMatchObject({ success: false, code: "REVISION_CONFLICT" });
	expect(row.runnerSession).toMatchObject({ configuration_revision: 1, desired_state: "running", actual_state: "running" });
	expect(row.runnerStop).toEqual({ state: "active", stopMode: "graceful", generationRetained: true, stoppedAt: null });
});
