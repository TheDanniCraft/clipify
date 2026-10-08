import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
const { Then } = createBdd(test);
Then("feedback submission is queued once without private context", async ({ mcpWorld }) => {
	const row = mcpWorld.result?.body;
	expect(row.result?.isError).not.toBe(true);
	expect(row.result?.structuredContent).toMatchObject({ status: "queued", receiptId: expect.any(String), limit: 5, windowSeconds: 86400, limiterScope: "server_process" });
	expect(row.feedbackEvents).toHaveLength(1);
	expect(row.feedbackEvents[0].contexts.feedback.message).toBe("The queue did not advance.");
	expect(row.feedbackEvents[0].tags).toMatchObject({ source: "mcp", feedback_kind: mcpWorld.input?.variant === "suggestion" ? "suggestion" : "bug" });
	expect(row.feedbackEvents[0].user.email).toBeUndefined();
	expect(row.feedbackEvents[0].contexts.feedback.replay_id).toBeUndefined();
	expect(row.safe).toBe(true);
	expect(row.auditMessageFree).toBe(true);
	if (mcpWorld.input?.variant === "replay") expect(row.replay.structuredContent).toMatchObject({ receiptId: row.result.structuredContent.receiptId, duplicate: true });
});
Then("the sixth feedback report is rate limited", async ({ mcpWorld }) => {
	const row = mcpWorld.result?.body;
	expect(row.result?.structuredContent.error.code).toBe("RATE_LIMITED");
	expect(row.feedbackEvents).toHaveLength(5);
	expect(row.writes).toBe(5);
	expect(row.auditMessageFree).toBe(true);
});
Then("changed feedback under the accepted alias is rejected", async ({ mcpWorld }) => {
	const row = mcpWorld.result?.body;
	expect(row.result?.structuredContent.status).toBe("queued");
	expect(row.replay?.structuredContent.error.code).toBe("RETRY_CONFLICT");
	expect(row.feedbackEvents).toHaveLength(1);
	expect(row.feedbackEvents[0].contexts.feedback.message).toBe("The queue did not advance.");
	expect(row.auditMessageFree).toBe(true);
	expect(row.writes).toBe(2);
});
Then("the shared feedback budget prevents submission", async ({ mcpWorld }) => {
	const row = mcpWorld.result?.body;
	expect(row.result?.structuredContent.error.code).toBe("RATE_LIMITED");
	expect(row.feedbackEvents).toEqual([]);
	expect(row.writes).toBe(0);
});
Then("feedback submission is rejected without contacting Sentry", async ({ mcpWorld }) => {
	const row = mcpWorld.result?.body;
	expect(row.status >= 400 || row.result?.isError || row.error).toBeTruthy();
	expect(row.feedbackEvents).toEqual([]);
	expect(row.writes).toBe(0);
});
