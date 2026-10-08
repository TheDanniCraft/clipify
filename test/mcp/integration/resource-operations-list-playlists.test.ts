/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US2-008 list_playlists through authenticated MCP", () => {
	test("lists approved creator playlists with safe revisions", () => {
		const result = flowProbe("resources:playlists");
		expect(result.resourceResult?.items).toEqual([expect.objectContaining({ id: "a1dca8b8-089a-47ce-b649-1c32bb3842c1", creatorId: "fixture-creator", name: "Existing playlist", configurationRevision: 1 })]);
		expect(result.resourceResult?.nextCursor).toBeNull();
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/secret|token|ownerId/);
	});
});
