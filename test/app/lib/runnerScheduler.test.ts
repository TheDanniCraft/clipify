/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
test("U232 characterization: an exact thirty-second heartbeat stays online", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:health_snapshot");
	expect(result.completionWitness).toBe("offline");
	expect(result.atCutoff).toBe("online");
});

test("U233 characterization: a heartbeat one millisecond beyond the cutoff becomes offline", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:health_snapshot");
	expect(result.completionWitness).toBe("offline");
	expect(result.afterCutoff).toBe("offline");
});
