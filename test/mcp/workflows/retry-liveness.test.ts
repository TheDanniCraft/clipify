/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
test.each(["create_gallery", "create_runner", "configure_stream_session"])("%s never replays a deleted resource as a successful creation", (tool) => {
	const row = flowProbe(`catalogue:workflow:${tool}:deleted_replay`);
	expect(row.result?.isError).not.toBe(true);
	expect(row.replay?.isError).toBe(true);
	expect(row.replay?.structuredContent.error.code).toBe("RESOURCE_UNAVAILABLE");
	expect(row.writes).toBe(1);
});
