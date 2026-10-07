/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US2-011 update_playlist through authenticated MCP", () => {
	test("renames the current owned playlist and increments its revision", () => {
		const result = flowProbe("resources:playlist-update");
		expect(result.resourceResult?.playlist).toMatchObject({ name: "Renamed playlist", configurationRevision: 2 });
		expect(result.persistedPlaylist).toMatchObject({ name: "Renamed playlist", configuration_revision: 2 });
	});
	test.each([
		["stale", "CONFLICT"],
		["missing", "RESOURCE_UNAVAILABLE"],
		["denied", "ACCESS_DENIED"],
	])("%s rename preserves configuration", (mode, code) => {
		const result = flowProbe(`resources:playlist-update:${mode}`);
		expect(result.resourceResult?.error?.code).toBe(code);
		expect(result.persistedPlaylist).toMatchObject({ name: "Existing playlist", configuration_revision: 1 });
	});
});
