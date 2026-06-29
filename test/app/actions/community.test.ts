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

	it("returns the full teaser list for the landing page", async () => {
		const snapshot = { streamers: [{ id: "public-1" }, { id: "public-2" }] };
		getCommunitySnapshot.mockResolvedValue(snapshot);
		buildCommunityTeaserStreamers.mockReturnValue(["public-1", "public-2"]);

		const { getPublicCommunityTeaserAction } = await import("@/app/actions/community");
		await expect(getPublicCommunityTeaserAction()).resolves.toEqual(["public-1", "public-2"]);

		expect(fetchCommunityPageVisibleUserIds).not.toHaveBeenCalled();
		expect(buildCommunityTeaserStreamers).toHaveBeenCalledWith(snapshot);
	});

	it("returns the footer teaser filtered by the community page visibility", async () => {
		const snapshot = { streamers: [{ id: "public-1" }, { id: "public-2" }] };
		const visibleUserIds = new Set(["public-2"]);
		getCommunitySnapshot.mockResolvedValue(snapshot);
		fetchCommunityPageVisibleUserIds.mockResolvedValue(visibleUserIds);
		buildCommunityTeaserStreamers.mockReturnValue(["public-2"]);

		const { getPublicCommunityFooterTeaserAction } = await import("@/app/actions/community");
		await expect(getPublicCommunityFooterTeaserAction()).resolves.toEqual(["public-2"]);

		expect(fetchCommunityPageVisibleUserIds).toHaveBeenCalledWith(["public-1", "public-2"]);
		expect(buildCommunityTeaserStreamers).toHaveBeenCalledWith(snapshot, visibleUserIds);
	});
});
