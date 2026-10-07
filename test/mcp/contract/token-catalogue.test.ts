/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
test("TDD-US1-022 every malformed header/claim fails and supported bearer controls read", () => {
	const result = runMcpProbe("flow-probe", ["protocol:token-catalogue"], 30000);
	expect(result.outcomes).toHaveLength(29);
	expect(result.clockChecks).toEqual({ before: true, at: false, after: false });
	for (const outcome of result.outcomes) {
		const valid = ["valid", "lowercase-bearer"].includes(outcome.name);
		expect({ name: outcome.name, status: outcome.status }).toEqual({ name: outcome.name, status: valid ? 200 : 401 });
		expect(outcome.read).toBe(valid);
		if (!valid) expect(outcome.challenge).toBe(true);
	}
});
