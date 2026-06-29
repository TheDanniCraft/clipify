/** @jest-environment node */

import { Plan } from "@types";

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
});
