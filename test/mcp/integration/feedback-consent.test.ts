/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
test("a native Read grant cannot submit feedback or contact Sentry", () => {
	const row = flowProbe("catalogue:workflow:submit_feedback:read_only");
	expect(row.status >= 400 || row.result?.isError || row.error).toBeTruthy();
	expect(row.feedbackEvents).toEqual([]);
	expect(row.writes).toBe(0);
});
