/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US5-001 entitlement-aware runner setup", () => {
	test("offers official platform download and human device enrollment without credentials", () => {
		const row = flowProbe("catalogue:workflow:get_runner_setup:success");
		expect(row.result?.structuredContent).toMatchObject({ platform: "linux", installationRequired: true, enrollmentRequired: true });
		expect(row.result?.structuredContent.downloadUrl).toContain("/api/runner/download?os=linux");
		expect(row.result?.structuredContent.enrollmentUrl).toContain("/runner/enroll");
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US5-002 runner listing", () => {
	test("lists safe runner metadata and fresh heartbeat status", () => {
		const row = flowProbe("catalogue:workflow:list_runners:success");
		expect(row.result?.structuredContent).toMatchObject({ items: [{ id: row.ids.runnerId, status: "online", configurationRevision: 1 }], nextCursor: null });
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US5-003 runner status", () => {
	test("reads the approved runner without its device token", () => {
		const row = flowProbe("catalogue:workflow:get_runner:success");
		expect(row.result?.structuredContent).toMatchObject({ id: row.ids.runnerId, creatorId: "fixture-creator", status: "online", configurationRevision: 1 });
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US5-004 safe runner provisioning", () => {
	test("creates an unenrolled runner record and keeps its credential server-side", () => {
		const row = flowProbe("catalogue:workflow:create_runner:success");
		expect(row.result?.structuredContent).toMatchObject({ name: "New runner", status: "offline", configurationRevision: 1, enrollmentRequired: true });
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US5-005 runner rename", () => {
	test("updates name with a current revision", () => {
		const row = flowProbe("catalogue:workflow:update_runner:success");
		expect(row.result?.structuredContent).toMatchObject({ id: row.ids.runnerId, name: "Edited runner", configurationRevision: 2 });
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US5-006 runner removal", () => {
	test("deletes the runner and requests its owned sessions to stop", () => {
		const row = flowProbe("catalogue:workflow:delete_runner:success");
		expect(row.result?.structuredContent).toMatchObject({ runnerId: row.ids.runnerId, deleted: true, desiredSessionsStopped: true, deviceShutdownConfirmed: false });
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US5-007 device unlink", () => {
	test("revokes the device credential without returning its replacement", () => {
		const row = flowProbe("catalogue:workflow:unlink_runner:success");
		expect(row.result?.structuredContent).toMatchObject({ id: row.ids.runnerId, status: "offline", configurationRevision: 2, enrollmentRequired: true, credentialRevoked: true, deviceShutdownConfirmed: false });
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US5-008 stream session listing", () => {
	test("lists desired/actual state and configuration without stream keys", () => {
		const row = flowProbe("catalogue:workflow:list_stream_sessions:success");
		expect(row.result?.structuredContent).toMatchObject({ items: [{ id: row.ids.sessionId, desiredState: "stopped", actualState: "stopped", credentialsConfigured: true }], nextCursor: null });
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US5-009 safe stream status", () => {
	test("returns observed state separately from requested state", () => {
		const row = flowProbe("catalogue:workflow:get_stream_session:success");
		expect(row.result?.structuredContent).toMatchObject({ id: row.ids.sessionId, desiredState: "stopped", actualState: "stopped", runner: { id: row.ids.runnerId, status: "online" } });
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US5-010 stream configuration", () => {
	test("configures owned runner/overlay video settings without exposing credentials", () => {
		const row = flowProbe("catalogue:workflow:configure_stream_session:success");
		expect(row.result?.structuredContent).toMatchObject({ id: row.ids.sessionId, runnerId: row.ids.runnerId, overlayId: row.ids.overlayId, mode: "24/7", resolution: "720p", fps: 30, configurationRevision: 2 });
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US5-011 asynchronous stream control", () => {
	test("requests start without claiming the runner already streams", () => {
		const row = flowProbe("catalogue:workflow:control_stream_session:success");
		expect(row.result?.structuredContent).toMatchObject({ id: row.ids.sessionId, desiredState: "running", actualState: "stopped", configurationRevision: 2, applied: false });
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US5-012 actual uploaded runner snapshot", () => {
	test("returns a current assigned JPEG as MCP image content with capture metadata", () => {
		const row = flowProbe("catalogue:workflow:get_runner_snapshot:success");
		expect(row.result?.structuredContent).toMatchObject({ runnerId: row.ids.runnerId, overlayId: row.ids.overlayId, status: "available", source: "current_server_instance" });
		expect(row.result?.structuredContent.capturedAt).toEqual(expect.any(String));
		expect(row.result?.content).toContainEqual({ type: "image", data: "/9j/2Q==", mimeType: "image/jpeg" });
		expect(row.safe).toBe(true);
	});
});

test.each([
	["no_snapshot", "unavailable"],
	["runner_offline", "runner_offline"],
	["foreign_assignment", "unavailable"],
])("snapshot %s is explicit and never emits an image", (variant, status) => {
	const row = flowProbe(`catalogue:workflow:get_runner_snapshot:${variant}`);
	expect(row.result?.structuredContent.status).toBe(status);
	expect(row.result?.content.some((item: any) => item.type === "image")).toBe(false);
	expect(row.safe).toBe(true);
});
