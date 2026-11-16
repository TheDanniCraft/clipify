import "server-only";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import type { DatabaseClient } from "@/db/client";
import { clipCrawlerStatus, refreshCreatorClips } from "@/server/clip-cache";
import { authorizeTrustedCreatorOperation } from "@/auth/authorize-operation";
import { collectionState } from "@/server/mcp/entry-guidance";
import { workflowOperation } from "./workflow";
export function getClipCrawlerStatus(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"get_clip_crawler_status",
		input,
		async (input, context) => {
			const [status, refresh] = await Promise.all([clipCrawlerStatus(input.creatorId), authorizeTrustedCreatorOperation({ principal, creatorId: input.creatorId, permission: "creator:update", client: context.tx })]);
			const inventoryReady = collectionState(status) === "ready";
			return { ...status, historyComplete: status.isSyncComplete, isSyncComplete: inventoryReady, progressScope: "historical_time_window", collectionState: collectionState(status), inventoryReady, refreshPermission: { allowed: refresh.allowed, requiredScope: "creator:update", ...(!refresh.allowed ? { reason: "ACCESS_DENIED" } : {}) }, cooldownElapsed: status.canRefresh, canRefresh: refresh.allowed && status.canRefresh };
		},
		client,
	);
}
export function refreshClips(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"refresh_clips",
		input,
		async (input, context) => {
			context.assertCurrent();
			return refreshCreatorClips(input.creatorId, context);
		},
		client,
	);
}
