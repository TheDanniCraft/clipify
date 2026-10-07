/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
test("capabilities reflect Free gallery quota and remote-control restrictions", () => {
	const row = flowProbe("catalogue:workflow:get_capabilities:free");
	const value = row.result?.structuredContent;
	expect(value.usage.galleries).toBe(1);
	expect(value.limits.galleries).toBe(1);
	expect(value.operations.create_gallery).toEqual({ allowed: false, reason: "PLAN_LIMIT_REACHED" });
	for (const name of ["get_overlay_runtime", "get_overlay_queues", "control_overlay", "enqueue_overlay_clip", "clear_overlay_queue"]) expect(value.operations[name]).toEqual({ allowed: false, reason: "FEATURE_RESTRICTED" });
});
test("expired Runner access denies setup and streaming but preserves cleanup", () => {
	const row = flowProbe("catalogue:workflow:get_capabilities:no_runner_access");
	const value = row.result?.structuredContent;
	for (const name of ["get_runner_setup", "create_runner", "configure_stream_session", "control_stream_session"]) expect(value.operations[name]).toEqual({ allowed: false, reason: "FEATURE_RESTRICTED" });
	for (const name of ["get_runner", "list_runners", "delete_runner", "unlink_runner"]) expect(value.operations[name]).toEqual({ allowed: true });
});
