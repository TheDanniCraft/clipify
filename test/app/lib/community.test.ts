/** @jest-environment node */

import { Plan } from "@types";
import type { CommunitySnapshot } from "@/app/lib/community-types";

const selectExecute = jest.fn();
const insertExecute = jest.fn();
const lockQuery = jest.fn();
const lockRelease = jest.fn();
const getAppAccessToken = jest.fn();
const getUsersDetailsBulk = jest.fn();
const resolveUserEntitlementsForUsers = jest.fn();

const queryBuilder = {
	from: jest.fn(),
	where: jest.fn(),
	limit: jest.fn(),
	groupBy: jest.fn(),
	innerJoin: jest.fn(),
	leftJoin: jest.fn(),
	execute: (...args: unknown[]) => selectExecute(...args),
};

queryBuilder.from.mockImplementation(() => queryBuilder);
queryBuilder.where.mockImplementation(() => queryBuilder);
queryBuilder.limit.mockImplementation(() => queryBuilder);
queryBuilder.groupBy.mockImplementation(() => queryBuilder);
queryBuilder.innerJoin.mockImplementation(() => queryBuilder);
queryBuilder.leftJoin.mockImplementation(() => queryBuilder);

const insertBuilder: any = {
	values: jest.fn(() => insertBuilder),
	onConflictDoUpdate: jest.fn(() => insertBuilder),
	execute: () => insertExecute(),
};

const db = {
	select: jest.fn(() => queryBuilder),
	insert: jest.fn(() => insertBuilder),
	delete: jest.fn(),
	execute: jest.fn(),
	transaction: jest.fn(),
};

jest.mock("@/db/client", () => ({
	db,
	dbPool: {
		connect: () => ({
			query: (...args: unknown[]) => lockQuery(...args),
			release: lockRelease,
		}),
	},
}));

jest.mock("@actions/twitch", () => ({
	getAppAccessToken: (...args: unknown[]) => getAppAccessToken(...args),
	getUsersDetailsBulk: (...args: unknown[]) => getUsersDetailsBulk(...args),
}));

jest.mock("@lib/entitlements", () => ({
	resolveUserEntitlementsForUsers: (...args: unknown[]) => resolveUserEntitlementsForUsers(...args),
}));

async function loadCommunity() {
	jest.resetModules();
	return import("@/app/lib/community");
}

describe("lib/community", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getAppAccessToken.mockResolvedValue(null);
		getUsersDetailsBulk.mockResolvedValue([]);
		resolveUserEntitlementsForUsers.mockResolvedValue(new Map());
		lockQuery.mockResolvedValueOnce({ rows: [{ locked: true }] }).mockResolvedValue({ rows: [] });
		insertExecute.mockResolvedValue(undefined);
		selectExecute
			.mockResolvedValueOnce([
				{
					id: "user-1",
					username: "thedanni",
					avatar: "https://example.com/avatar.png",
					plan: Plan.Free,
					lastLogin: null,
					createdAt: new Date("2026-06-28T00:00:00.000Z"),
					updatedAt: new Date("2026-06-29T00:00:00.000Z"),
				},
			])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);
	});

	it("builds the shared community snapshot without community-page visibility filtering", async () => {
		const { refreshCommunitySnapshot } = await loadCommunity();

		const snapshot = await refreshCommunitySnapshot();

		expect(snapshot?.totalCount).toBe(1);
		expect(snapshot?.streamers.map((streamer) => streamer.id)).toEqual(["user-1"]);
		expect(queryBuilder.leftJoin).not.toHaveBeenCalled();
		expect(queryBuilder.innerJoin).toHaveBeenCalled();
	});

	it("returns the opt-in ids for the community page separately", async () => {
		selectExecute.mockReset();
		selectExecute.mockResolvedValueOnce([{ id: "user-1" }]);

		const { fetchCommunityPageVisibleUserIds } = await loadCommunity();
		const visibleUserIds = await fetchCommunityPageVisibleUserIds(["user-1", "user-2"]);

		expect(visibleUserIds).toEqual(new Set(["user-1"]));
		expect(queryBuilder.where).toHaveBeenCalled();
	});

	it("builds a teaser list in server order and keeps the payload minimal", async () => {
		const { buildCommunityTeaserStreamers } = await import("@/app/community/community-data");

		const snapshot = {
			streamers: [
				{
					id: "offline",
					username: "offline",
					displayName: "Offline",
					avatar: "https://example.com/offline.png",
					plan: Plan.Free,
					viewCount: 10,
					partner: false,
					status: "offline" as const,
					lastActiveAt: "2026-06-28T00:00:00.000Z",
				},
				{
					id: "live",
					username: "live",
					displayName: "Live",
					avatar: "https://example.com/live.png",
					plan: Plan.Free,
					viewCount: 20,
					partner: false,
					status: "live" as const,
					lastActiveAt: "2026-06-28T01:00:00.000Z",
				},
				{
					id: "overlay",
					username: "overlay",
					displayName: "Overlay",
					avatar: "https://example.com/overlay.png",
					plan: Plan.Pro,
					viewCount: 30,
					partner: false,
					status: "live_with_overlay" as const,
					lastActiveAt: "2026-06-28T02:00:00.000Z",
				},
			],
			totalCount: 3,
			liveCount: 2,
			overlayActiveCount: 1,
			updatedAt: "2026-06-29T00:00:00.000Z",
		} satisfies CommunitySnapshot;

		const streamers = buildCommunityTeaserStreamers(snapshot, new Set(["overlay", "live", "offline"]));

		expect(streamers.map((streamer) => streamer.id)).toEqual(["overlay", "live", "offline"]);
		expect(streamers[0]).toEqual({
			id: "overlay",
			avatar: "https://example.com/overlay.png",
			displayName: "Overlay",
			status: "live_with_overlay",
		});
	});

	it("groups public community page streamers after filtering opt-out users", async () => {
		const { buildCommunityPageGroups } = await import("@/app/community/community-data");

		const snapshot = {
			streamers: [
				{
					id: "partner",
					username: "partner",
					displayName: "Partner",
					avatar: "https://example.com/partner.png",
					plan: Plan.Free,
					viewCount: 10,
					partner: true,
					status: "offline" as const,
					lastActiveAt: "2026-06-28T00:00:00.000Z",
				},
				{
					id: "offline",
					username: "offline",
					displayName: "Offline",
					avatar: "https://example.com/offline.png",
					plan: Plan.Free,
					viewCount: 20,
					partner: false,
					status: "offline" as const,
					lastActiveAt: "2026-06-28T01:00:00.000Z",
				},
				{
					id: "hidden",
					username: "hidden",
					displayName: "Hidden",
					avatar: "https://example.com/hidden.png",
					plan: Plan.Pro,
					viewCount: 30,
					partner: false,
					status: "live" as const,
					lastActiveAt: "2026-06-28T02:00:00.000Z",
				},
			],
			totalCount: 3,
			liveCount: 1,
			overlayActiveCount: 0,
			updatedAt: "2026-06-29T00:00:00.000Z",
		} satisfies CommunitySnapshot;

		const groups = buildCommunityPageGroups(snapshot, new Set(["partner", "offline"]));

		expect(groups.map((group) => group.key)).toEqual(["partners", "offline"]);
		expect(groups[0]?.streamers.map((streamer) => streamer.id)).toEqual(["partner"]);
		expect(groups[1]?.streamers.map((streamer) => streamer.id)).toEqual(["partner", "offline"]);
		expect(groups[0]?.streamers[0]).toEqual(expect.objectContaining({ twitchUrl: "https://twitch.tv/partner" }));
	});
});
