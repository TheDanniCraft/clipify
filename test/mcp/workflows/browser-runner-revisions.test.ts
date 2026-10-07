/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
test("browser stream configuration advances the revision used by MCP", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["runner-browser-configure"]);
	expect(row.runnerOutcome).toEqual({ success: true });
	expect(row.runnerSession).toMatchObject({ configuration_revision: 2, resolution: "720p", fps: 30 });
});

test("stale browser stream configuration cannot overwrite a newer revision", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["runner-browser-configure-stale"]);
	expect(row.runnerOutcome).toMatchObject({ success: false, code: "REVISION_CONFLICT" });
	expect(row.runnerSession).toMatchObject({ configuration_revision: 1, resolution: "1080p", fps: 60 });
});

test("browser start requests advance the stream configuration revision", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["runner-browser-control"]);
	expect(row.runnerOutcome).toEqual({ success: true });
	expect(row.runnerSession).toMatchObject({ configuration_revision: 2, desired_state: "running" });
});

test("stale browser start cannot act on newer stream configuration", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["runner-browser-control-stale"]);
	expect(row.runnerOutcome).toMatchObject({ success: false, code: "REVISION_CONFLICT" });
	expect(row.runnerSession).toMatchObject({ configuration_revision: 1, desired_state: "stopped" });
});

test("browser device unlink advances runner and stopped-session revisions without exposing credentials", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["runner-browser-unlink"]);
	expect(row.runnerOutcome).toEqual({ success: true });
	expect(row.runnerRecord).toMatchObject({ configuration_revision: 2, status: "offline", credential_rotated: true, last_heartbeat_at: null });
	expect(row.runnerSession).toMatchObject({ configuration_revision: 2, desired_state: "stopped" });
	expect(JSON.stringify(row)).not.toContain("private-browser-runner");
});

test("device naming advances configuration once while ordinary heartbeats preserve it", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["runner-browser-heartbeat"]);
	expect(row.firstHeartbeatStatus).toBe(200);
	expect(row.firstHeartbeatRecord).toEqual({ name: "Native runner", configuration_revision: 2 });
	expect(row.secondHeartbeatStatus).toBe(200);
	expect(row.runnerRecord).toMatchObject({ name: "Native runner", configuration_revision: 2 });
});

test("human-approved device enrollment advances the runner configuration revision", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["runner-browser-enroll"]);
	expect(row.runnerOutcome.status).toBe("approved");
	expect(row.runnerRecord).toMatchObject({ name: "Enrolled native runner", configuration_revision: 2, credential_rotated: false });
});

test("entitlement suspension versions shutdown intent without inventing a device acknowledgement", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["runner-browser-suspend"]);
	expect(row.runnerOutcome).toEqual({ runners: 1, sessions: 1 });
	expect(row.firstSuspendRevision).toBe(2);
	expect(row.runnerSession).toMatchObject({ configuration_revision: 2, desired_state: "stopped", actual_state: "running" });
	expect(row.runnerRecord.status).toBe("offline");
});

test("expired-access heartbeats version shutdown intent once and never claim it was applied", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["runner-browser-heartbeat-expired"]);
	expect(row.firstHeartbeatStatus).toBe(403);
	expect(row.secondHeartbeatStatus).toBe(403);
	expect(row.firstHeartbeatSessionRevision).toBe(2);
	expect(row.runnerSession).toMatchObject({ configuration_revision: 2, desired_state: "stopped", actual_state: "running" });
});
