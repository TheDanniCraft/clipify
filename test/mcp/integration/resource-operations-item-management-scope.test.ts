/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US2-043 item management does not require an unrequested read scope", () => {
	test.each(["add", "remove", "reorder"])("%s honors its declared management permission", (operation) => {
		const result = flowProbe(`resources:playlist-${operation}:no-read`);
		expect(result.protocolStatus).toBe(200);
		expect(result.resourceResult?.playlist?.configurationRevision).toBe(2);
		expect(result.resourceResult?.error).toBeUndefined();
		expect(result.persistedPlaylist.configuration_revision).toBe(2);
	});
});
