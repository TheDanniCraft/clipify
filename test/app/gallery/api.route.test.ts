const getPublicGalleryPlayer = jest.fn();

jest.mock("@actions/gallery", () => ({ getPublicGalleryPlayer: (...args: unknown[]) => getPublicGalleryPlayer(...args) }));
jest.mock("next/server", () => ({
	NextResponse: {
		json: (body: unknown, init?: { status?: number }) => ({
			status: init?.status ?? 200,
			json: async () => body,
		}),
	},
}));

describe("gallery playback API", () => {
	beforeEach(() => jest.clearAllMocks());

	it("returns only the playback and Twitch URLs", async () => {
		getPublicGalleryPlayer.mockResolvedValue({ playbackUrl: "https://video", selectedIndex: 1, clips: [{ url: "first" }, { url: "https://twitch/clip" }] });
		const { GET } = await import("@/app/api/gallery/[galleryId]/clip/[clipId]/route");
		const response = await GET({} as Request, { params: Promise.resolve({ galleryId: "gallery", clipId: "clip" }) });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ playbackUrl: "https://video", twitchUrl: "https://twitch/clip" });
		expect(getPublicGalleryPlayer).toHaveBeenCalledWith("gallery", "clip");
	});

	it("returns 404 for unavailable clips", async () => {
		getPublicGalleryPlayer.mockResolvedValue(null);
		const { GET } = await import("@/app/api/gallery/[galleryId]/clip/[clipId]/route");
		const response = await GET({} as Request, { params: Promise.resolve({ galleryId: "gallery", clipId: "missing" }) });
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Clip unavailable" });
	});
});
