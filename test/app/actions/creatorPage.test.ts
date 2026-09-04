/** @jest-environment node */
export {};

const selectRows: unknown[][] = [];
const dbSelect = jest.fn(() => {
	const chain: Record<string, jest.Mock> = {};
	for (const method of ["from", "leftJoin", "where", "limit"]) chain[method] = jest.fn(() => chain);
	chain.execute = jest.fn().mockImplementation(async () => selectRows.shift() ?? []);
	return chain;
});
const getCreatorTwitchDetails = jest.fn();
const getCachedClipByOwner = jest.fn();
const getTwitchClipPlaybackUrl = jest.fn();
const getCachedClipPageByOwner = jest.fn();
const resolveUserEntitlements = jest.fn();
const getFeatureAccess = jest.fn();
const canResolvePublicClipPlayback = jest.fn();
const getMemberBadges = jest.fn();

jest.mock("@/db/client", () => ({ db: { select: () => dbSelect() } }));
jest.mock("@actions/twitch", () => ({
	getCreatorTwitchDetails: (...args: unknown[]) => getCreatorTwitchDetails(...args),
	getCachedClipByOwner: (...args: unknown[]) => getCachedClipByOwner(...args),
	getTwitchClipPlaybackUrl: (...args: unknown[]) => getTwitchClipPlaybackUrl(...args),
}));
jest.mock("@actions/database", () => ({ getCachedClipPageByOwner: (...args: unknown[]) => getCachedClipPageByOwner(...args) }));
jest.mock("@lib/entitlements", () => ({ resolveUserEntitlements: (...args: unknown[]) => resolveUserEntitlements(...args) }));
jest.mock("@lib/featureAccess", () => ({ getFeatureAccess: (...args: unknown[]) => getFeatureAccess(...args) }));
jest.mock("@actions/rateLimit", () => ({ canResolvePublicClipPlayback: (...args: unknown[]) => canResolvePublicClipPlayback(...args) }));
jest.mock("@lib/membership", () => ({ getMemberBadges: (...args: unknown[]) => getMemberBadges(...args) }));
jest.mock("react", () => ({
	cache: (fn: (...args: unknown[]) => unknown) => {
		const values = new Map<string, unknown>();
		return async (...args: unknown[]) => {
			const key = JSON.stringify(args);
			if (!values.has(key)) values.set(key, await fn(...args));
			return values.get(key);
		};
	},
}));

const user = { id: "owner", username: "Alice", avatar: "fallback.png", disabled: false, plan: "free", createdAt: new Date("2024-01-01T00:00:00Z") };
const settings = { creatorPageEnabled: true, creatorPageShowBio: true, creatorPageVisibility: "discoverable", creatorPageSocialTitle: "Alice clips", creatorPageSocialDescription: "Highlights" };

async function loadActions() {
	jest.resetModules();
	return import("@actions/creatorPage");
}

describe("creator page actions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		selectRows.length = 0;
		resolveUserEntitlements.mockResolvedValue({ effectivePlan: "pro", grantSource: "stripe" });
		getFeatureAccess.mockReturnValue({ allowed: true });
		getCreatorTwitchDetails.mockResolvedValue({ profile: { profile_image_url: "profile.png", description: "Creator bio", broadcaster_type: "partner" }, live: null });
		getCachedClipPageByOwner.mockResolvedValue({ items: [{ id: "clip-1" }], nextCursor: null, total: 1 });
		canResolvePublicClipPlayback.mockResolvedValue(true);
		getMemberBadges.mockResolvedValue([]);
	});

	it("shares creator presentation data between metadata and the page without loading clips for metadata", async () => {
		selectRows.push([{ user, settings }]);
		const { getCreatorPageMetadata, getCreatorPage } = await loadActions();
		await expect(getCreatorPageMetadata("Alice")).resolves.toMatchObject({ username: "Alice", avatar: "profile.png", twitchBadge: "Twitch Partner" });
		expect(getCachedClipPageByOwner).not.toHaveBeenCalled();
		await expect(getCreatorPage("Alice", { pageSize: 24 })).resolves.toMatchObject({ items: [{ id: "clip-1" }], total: 1 });
		expect(dbSelect).toHaveBeenCalledTimes(1);
		expect(getCreatorTwitchDetails).toHaveBeenCalledTimes(1);
		expect(getMemberBadges).toHaveBeenCalledWith("owner");
		expect(getCachedClipPageByOwner).toHaveBeenCalledWith("owner", { pageSize: 24 });
	});

	it("loads playback clips through the exact cache key path", async () => {
		selectRows.push([{ user: { ...user, username: "Bob" }, settings }]);
		getCachedClipByOwner.mockResolvedValue({ id: "clip-1", broadcaster_id: "owner" });
		getTwitchClipPlaybackUrl.mockResolvedValue("https://video.example/clip.mp4");
		const { getCreatorClipPlayback } = await loadActions();
		await expect(getCreatorClipPlayback("Bob", "clip-1")).resolves.toMatchObject({ playbackUrl: "https://video.example/clip.mp4" });
		expect(getCachedClipByOwner).toHaveBeenCalledWith("owner", "clip-1");
	});
});
