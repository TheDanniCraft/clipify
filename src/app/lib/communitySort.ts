import { Plan } from "@types";

import type { CommunityStreamer, CommunityStreamerStatus } from "./community-types";

const statusRank: Record<CommunityStreamerStatus, number> = {
	live_with_overlay: 0,
	live: 1,
	offline: 2,
};

const planRank: Record<Plan, number> = {
	[Plan.Pro]: 0,
	[Plan.Free]: 1,
};

export function compareCommunityStreamers(left: CommunityStreamer, right: CommunityStreamer): number {
	const partnerDiff = Number(right.partner) - Number(left.partner);
	if (partnerDiff !== 0) return partnerDiff;

	const statusDiff = statusRank[left.status] - statusRank[right.status];
	if (statusDiff !== 0) return statusDiff;

	const planDiff = planRank[left.plan] - planRank[right.plan];
	if (planDiff !== 0) return planDiff;

	if (left.viewCount !== right.viewCount) {
		return right.viewCount - left.viewCount;
	}

	const leftActiveAt = left.lastActiveAt ? Date.parse(left.lastActiveAt) : 0;
	const rightActiveAt = right.lastActiveAt ? Date.parse(right.lastActiveAt) : 0;
	if (leftActiveAt !== rightActiveAt) return rightActiveAt - leftActiveAt;

	return left.displayName.localeCompare(right.displayName, undefined, { sensitivity: "base" });
}
