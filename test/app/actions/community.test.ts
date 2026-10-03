/** @jest-environment node */
export {};

const getCommunitySnapshot = jest.fn();
const fetchCommunityPageVisibleUserIds = jest.fn();
const buildCommunityTeaserStreamers = jest.fn();
const buildCommunityPageGroups = jest.fn();

jest.mock("@/app/lib/community", () => ({
	getCommunitySnapshot: (...args: unknown[]) => getCommunitySnapshot(...args),
	fetchCommunityPageVisibleUserIds: (...args: unknown[]) => fetchCommunityPageVisibleUserIds(...args),
}));

jest.mock("@/app/community/community-data", () => ({
	buildCommunityTeaserStreamers: (...args: unknown[]) => buildCommunityTeaserStreamers(...args),
	buildCommunityPageGroups: (...args: unknown[]) => buildCommunityPageGroups(...args),
}));

describe("actions/community", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.resetModules();
	});

	it("returns a visible landing-page teaser and the uncapped community count", async () => {
		const snapshot = { streamers: [{ id: "public-1" }, { id: "public-2" }] };
		const visibleUserIds = new Set(["public-1", "public-2"]);
		getCommunitySnapshot.mockResolvedValue(snapshot);
		fetchCommunityPageVisibleUserIds.mockResolvedValue(visibleUserIds);
		buildCommunityTeaserStreamers.mockReturnValue(["public-1", "public-2"]);

		const { getPublicCommunityTeaserAction } = await import("@/app/actions/community");
		await expect(getPublicCommunityTeaserAction()).resolves.toEqual({ streamers: ["public-1", "public-2"], totalCount: 2 });

		expect(fetchCommunityPageVisibleUserIds).toHaveBeenCalledWith(["public-1", "public-2"]);
		expect(buildCommunityTeaserStreamers).toHaveBeenCalledWith(snapshot, visibleUserIds);
	});

	it("returns the footer teaser filtered by the community page visibility", async () => {
		const snapshot = { streamers: [{ id: "public-1" }, { id: "public-2" }] };
		const visibleUserIds = new Set(["public-2"]);
		getCommunitySnapshot.mockResolvedValue(snapshot);
		fetchCommunityPageVisibleUserIds.mockResolvedValue(visibleUserIds);
		buildCommunityTeaserStreamers.mockReturnValue(["public-2"]);

		const { getPublicCommunityFooterTeaserAction } = await import("@/app/actions/community");
		await expect(getPublicCommunityFooterTeaserAction()).resolves.toEqual({ streamers: ["public-2"], totalCount: 1 });

		expect(fetchCommunityPageVisibleUserIds).toHaveBeenCalledWith(["public-1", "public-2"]);
		expect(buildCommunityTeaserStreamers).toHaveBeenCalledWith(snapshot, visibleUserIds);
	});
});
