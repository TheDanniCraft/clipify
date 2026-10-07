import { FREE_PLAYLIST_LIMIT } from "@lib/constants";
export class CreationQuotaError extends Error {
	readonly code = "PLAN_LIMIT_REACHED";
	constructor(
		public readonly usage: number,
		public readonly limit: number,
	) {
		super("PLAN_LIMIT_REACHED");
	}
}
/** Count only after holding the creator lock shared by every creation path. */
export function assertCreationQuota(plan: "free" | "pro", kind: "overlay" | "playlist", usage: number): void {
	if (!Number.isSafeInteger(usage) || usage < 0) throw new Error("SERVICE_UNAVAILABLE");
	const limit = kind === "playlist" ? FREE_PLAYLIST_LIMIT : 1;
	if (plan === "free" && usage >= limit) throw new CreationQuotaError(usage, limit);
}
