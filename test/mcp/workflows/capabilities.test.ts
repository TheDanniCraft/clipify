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

test("capabilities expose only the current public tools and accurately flag Pro overlay editing", () => {
	const row = flowProbe("catalogue:workflow:get_capabilities:free");
	const operations = row.result?.structuredContent.operations;
	expect(Object.keys(operations)).toHaveLength(66);
	for (const name of ["update_overlay", "update_gallery", "get_overlay_embed"]) expect(operations).not.toHaveProperty(name);
	for (const name of ["update_overlay_theme", "update_overlay_filters", "update_overlay_playback"]) expect(operations[name]).toEqual({ allowed: false, reason: "FEATURE_RESTRICTED" });
	expect(operations.update_overlay_settings).toEqual({ allowed: true });
});
