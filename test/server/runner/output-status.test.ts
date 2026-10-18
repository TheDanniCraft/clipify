/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

test("TDD-US2-FR008: authenticated generation-bound output states reach safe dashboard and MCP projections", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:multistream_output_status");
	expect(result.authenticated).toBe(true);
	expect(result.admitted).toBe(true);
	expect(result.telemetryAccepted).toBe(true);
	expect(result.publicOutputs).toEqual(result.expectedOutputs);
	expect(result.mcpOutputs).toEqual(result.expectedOutputs);
	expect(result.publicReadSafe).toBe(true);
	expect(result.allPublicReadSafe).toBe(true);
	expect(result.publicSafe).toBe(true);
});
