import { render, screen } from "@testing-library/react";

const getPublicGalleryPlayer = jest.fn();

jest.mock("@actions/gallery", () => ({ getPublicGalleryPlayer: (...args: unknown[]) => getPublicGalleryPlayer(...args) }));
jest.mock("@components/gallery/GalleryPlayerClientOnly", () => ({
	__esModule: true,
	default: ({ ownerName, initialIndex }: { ownerName: string; initialIndex: number }) => <div>{`player:${ownerName}:${initialIndex}`}</div>,
}));

describe("gallery clip page", () => {
	beforeEach(() => jest.clearAllMocks());

	it("renders the transparent player document", async () => {
		getPublicGalleryPlayer.mockResolvedValue({ gallery: {}, clips: [{}], selectedIndex: 2, playbackUrl: "video", owner: { username: "alice" }, showAttribution: true });
		const Page = (await import("@/app/gallery/[galleryId]/clip/[clipId]/page")).default;
		render(await Page({ params: Promise.resolve({ galleryId: "gallery", clipId: "clip" }) }));
		expect(screen.getByText("player:alice:2")).toBeInTheDocument();
		expect(getPublicGalleryPlayer).toHaveBeenCalledWith("gallery", "clip");
	});

	it("renders an unavailable state without exposing playback", async () => {
		getPublicGalleryPlayer.mockResolvedValue(null);
		const Page = (await import("@/app/gallery/[galleryId]/clip/[clipId]/page")).default;
		render(await Page({ params: Promise.resolve({ galleryId: "missing", clipId: "clip" }) }));
		expect(screen.getByText("Clip unavailable")).toBeInTheDocument();
	});
});
