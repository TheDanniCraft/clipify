/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
test.each([
	["get_gallery", "gallery", "galleryId"],
	["get_runner", "runner", "runnerId"],
	["get_stream_session", "stream_session", "sessionId"],
	["configure_stream_session", "stream_session", "sessionId"],
])("%s records the concrete approved resource", (tool, type, key) => {
	const row = flowProbe(`catalogue:workflow:${tool}:success`);
	expect(row.activity).toEqual({ target_type: type, target_id: row.ids[key] });
});
