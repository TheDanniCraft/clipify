/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
test("client adoption survives new IDs and includes Custom names with real paginated database aggregation", () => {
	const result = runMcpProbe("client-adoption-probe", [], 60000);
	expect(result.summary).toMatchObject({ registeredClients: 4, authorizedClients: 2, activeClients30d: 4, calls30d: 4, applicationNames: 4 });
	expect(result.first.items).toEqual([expect.objectContaining({ name: "ChatGPT", registeredClients: 2, authorizedClients: 2, calls30d: 2 })]);
	expect(result.second.items[0]).toMatchObject({ name: "Meta MCP", calls30d: 1 });
	expect(result.allCount).toBe(29);
	expect(result.allSummary).toBe(29);
	expect(result.redacted).toBe(true);
	expect(result.invalidRejected).toBe(true);
});
