/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
it("runs award setup, team grouping, nomination and publication through native OAuth and MCP", () => {
	const result = flowProbe("catalogue:workflow:awards:success");
	expect(result).toMatchObject({ discovered: true, title: "Babbler Awards", secretReturnedAtCreate: false, secretBeforeRelease: true, presenterWinner: true, safe: true, archive: { phase: "results", data: { status: "ready", title: "Babbler One", value: 321 } } });
	expect(result.archive.winners).toHaveLength(1);
});
