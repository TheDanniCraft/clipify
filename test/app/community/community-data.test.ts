/** @jest-environment node */

import { Plan } from "@types";

import type { CommunitySnapshot } from "@/app/lib/community-types";
import { buildCommunityPageGroups } from "@/app/community/community-data";

function makeSnapshot(): CommunitySnapshot {
	return {
		streamers: [
			{
				id: "partner-live",
				username: "partner_live",
				displayName: "Partner Live",
				avatar: "https://example.com/partner.png",
				plan: Plan.Pro,
				partner: true,
				status: "live_with_overlay",
				viewCount: 100,
				lastActiveAt: "2026-06-29T00:00:00.000Z",
			},
			{
				id: "pro-offline",
				username: "pro_offline",
				displayName: "Pro Offline",
				avatar: "https://example.com/pro.png",
				plan: Plan.Pro,
				partner: false,
				status: "offline",
				viewCount: 80,
				lastActiveAt: "2026-06-28T00:00:00.000Z",
			},
			{
				id: "free-offline",
				username: "free_offline",
				displayName: "Free Offline",
				avatar: "https://example.com/free.png",
				plan: Plan.Free,
				partner: false,
				status: "offline",
				viewCount: 20,
				lastActiveAt: "2026-06-27T00:00:00.000Z",
			},
		],
		totalCount: 3,
		liveCount: 1,
		overlayActiveCount: 1,
		updatedAt: "2026-06-29T00:00:00.000Z",
	};
}

describe("buildCommunityPageGroups", () => {
	it("filters the community page by visible user ids while keeping the shared snapshot intact", () => {
		const snapshot = makeSnapshot();
		const visibleUserIds = new Set(["partner-live", "free-offline"]);

		const groups = buildCommunityPageGroups(snapshot, visibleUserIds);
		const groupKeys = groups.map((group) => group.key);

		expect(groupKeys).toEqual(["partners", "now_live_with_clipify", "offline"]);
		expect(groups.find((group) => group.key === "partners")?.streamers.map((streamer) => streamer.id)).toEqual(["partner-live"]);
		expect(groups.find((group) => group.key === "pro")).toBeUndefined();
		expect(groups.find((group) => group.key === "offline")?.streamers.map((streamer) => streamer.id)).toEqual(["free-offline"]);
	});

	it("returns the full shared snapshot when no visibility set is provided", () => {
		const snapshot = makeSnapshot();

		const groups = buildCommunityPageGroups(snapshot);

		expect(groups.map((group) => group.key)).toEqual(["partners", "pro", "now_live_with_clipify", "offline"]);
		expect(groups.find((group) => group.key === "pro")?.streamers.map((streamer) => streamer.id)).toEqual(["pro-offline"]);
	});
});
