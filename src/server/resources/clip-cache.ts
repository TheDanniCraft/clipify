import "server-only";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import type { DatabaseClient } from "@/db/client";
import { clipCrawlerStatus, refreshCreatorClips } from "@/server/clip-cache";
import { workflowOperation } from "./workflow";
export function getClipCrawlerStatus(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(principal, "get_clip_crawler_status", input, (input) => clipCrawlerStatus(input.creatorId), client);
}
export function refreshClips(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"refresh_clips",
		input,
		async (input, context) => {
			context.assertCurrent();
			return refreshCreatorClips(input.creatorId);
		},
		client,
	);
}
