/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
test.each(["publish_gallery", "preview_playlist_import", "configure_stream_session"])("%s requires its additional consent permission before performing the operation", (tool) => {
	const row = flowProbe(`catalogue:workflow:${tool}:missing_secondary_scope`);
	expect(row.result?.isError).toBe(true);
	expect(row.result?.structuredContent.error.code).toBe("ACCESS_DENIED");
	expect(row.writes).toBe(0);
	expect(row.safe).toBe(true);
});
