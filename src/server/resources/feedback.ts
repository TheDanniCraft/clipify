import "server-only";
import * as Sentry from "@sentry/nextjs";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import type { DatabaseClient } from "@/db/client";
import { workflowOperation } from "./workflow";
import { FeedbackReplayCache } from "./feedback-replay";
declare global {
	var __clipifyFeedbackReplay: FeedbackReplayCache | undefined;
}
const replay = globalThis.__clipifyFeedbackReplay ?? (globalThis.__clipifyFeedbackReplay = new FeedbackReplayCache());
export function submitFeedback(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"submit_feedback",
		input,
		async (input, context) => {
			const sentry = Sentry.getClient();
			if (!sentry?.getDsn() || sentry.getOptions().enabled === false) throw new Error("SERVICE_UNAVAILABLE");
			context.assertCurrent();
			const receipt = await replay.submit(principal.authUserId, input, () => {
				context.assertCurrent();
				const scope = new Sentry.Scope();
				scope.setClient(sentry);
				scope.setUser({ id: principal.authUserId });
				return Sentry.captureFeedback({ message: input.message, source: "mcp", tags: { source: "mcp", feedback_kind: input.kind } }, { includeReplay: false }, scope);
			});
			return { status: "queued", ...receipt, limit: 5, windowSeconds: 86400, limiterScope: "server_process" };
		},
		client,
	);
}
