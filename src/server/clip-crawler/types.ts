export type ClipCrawlOptions = {
	kind: "recent" | "backfill";
	forceRecent?: boolean;
	requestMarker?: string;
	requestBudget: number;
};
export type ClipCrawlResult = {
	status: "completed" | "busy" | "unavailable" | "retry";
	backfillComplete?: boolean;
	recentPending?: boolean;
	retryAt?: string;
};
