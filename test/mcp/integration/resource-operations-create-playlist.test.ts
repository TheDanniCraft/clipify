/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US2-010 create_playlist through authenticated MCP", () => {
	test("creates one safe playlist and returns the original result on retry", () => {
		const result = flowProbe("resources:playlist-create");
		expect(result.protocolStatus).toBe(200);
		expect(result.resourceResult?.created).toMatchObject({ creatorId: "fixture-creator", name: "Agent playlist", configurationRevision: 1 });
		expect(result.resourceResult?.replayed).toEqual(result.resourceResult?.created);
		expect(result.playlistCount).toBe(1);
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/secret|token|ownerId/);
	});
});
