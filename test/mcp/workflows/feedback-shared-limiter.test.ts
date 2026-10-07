/** @jest-environment node */
import { consumeAppRateLimit } from "@/server/rate-limit";
import { FeedbackReplayCache } from "@/server/resources/feedback-replay";

test("feedback respects a budget already consumed through the shared app limiter", async () => {
	const policy = { key: "mcp-feedback", points: 5, duration: 86400, identifier: "shared-feedback-user" };
	for (let index = 0; index < 5; index++) expect((await consumeAppRateLimit(policy)).success).toBe(true);
	const send = jest.fn(() => "1".repeat(32));
	await expect(new FeedbackReplayCache().submit(policy.identifier, { creatorId: "creator", kind: "bug", message: "A user report", retryKey: "one" }, send)).rejects.toThrow("RATE_LIMITED");
	expect(send).not.toHaveBeenCalled();
});
