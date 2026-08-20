import { render, screen } from "@testing-library/react";

const validateAuth = jest.fn();
const getAllPlaylists = jest.fn();
const getGallery = jest.fn();
const getGalleryPreview = jest.fn();
const getGalleryPreviewPlayer = jest.fn();
const redirect = jest.fn((_path?: string) => {
	throw new Error("NEXT_REDIRECT");
});
const notFound = jest.fn(() => {
	throw new Error("NEXT_NOT_FOUND");
});

jest.mock("@actions/auth", () => ({ validateAuth: (...args: unknown[]) => validateAuth(...args) }));
jest.mock("@actions/database", () => ({ getAllPlaylists: (...args: unknown[]) => getAllPlaylists(...args) }));
jest.mock("@actions/gallery", () => ({
	getGallery: (...args: unknown[]) => getGallery(...args),
	getGalleryPreview: (...args: unknown[]) => getGalleryPreview(...args),
	getGalleryPreviewPlayer: (...args: unknown[]) => getGalleryPreviewPlayer(...args),
}));
jest.mock("next/navigation", () => ({ redirect: (path: string) => redirect(path), notFound: () => notFound() }));
jest.mock("@components/dashboardNavbar", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
jest.mock("@components/gallery/GalleryEditor", () => ({ __esModule: true, default: ({ canUseAdvanced, previewOwnerName }: { canUseAdvanced: boolean; previewOwnerName: string }) => <div>{`editor:${canUseAdvanced}:${previewOwnerName}`}</div> }));
jest.mock("@components/gallery/GalleryPlayerClientOnly", () => ({ __esModule: true, default: ({ initialIndex, showCloseButton }: { initialIndex: number; showCloseButton?: boolean }) => <div>{`preview-player:${initialIndex}:${String(showCloseButton)}`}</div> }));

describe("gallery dashboard pages", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		validateAuth.mockResolvedValue({ id: "owner", username: "fallback" });
		getGallery.mockResolvedValue({ id: "gallery" });
		getAllPlaylists.mockResolvedValue([{ id: "playlist" }]);
		getGalleryPreview.mockResolvedValue({ canUseAdvanced: true, ownerName: "alice", clips: [], showAttribution: false });
	});

	it("loads the editor with owner-scoped resources", async () => {
		const Page = (await import("@/app/dashboard/galleries/[galleryId]/page")).default;
		render(await Page({ params: Promise.resolve({ galleryId: "gallery" }) }));
		expect(screen.getByText("editor:true:alice")).toBeInTheDocument();
		expect(getAllPlaylists).toHaveBeenCalledWith("owner");
	});

	it("uses safe preview defaults and rejects missing galleries", async () => {
		getAllPlaylists.mockResolvedValue(null);
		getGalleryPreview.mockResolvedValue(null);
		const Page = (await import("@/app/dashboard/galleries/[galleryId]/page")).default;
		render(await Page({ params: Promise.resolve({ galleryId: "gallery" }) }));
		expect(screen.getByText("editor:false:fallback")).toBeInTheDocument();
		getGallery.mockResolvedValue(null);
		await expect(Page({ params: Promise.resolve({ galleryId: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
	});

	it("redirects unauthenticated users", async () => {
		validateAuth.mockResolvedValue(null);
		const Page = (await import("@/app/dashboard/galleries/[galleryId]/page")).default;
		await expect(Page({ params: Promise.resolve({ galleryId: "gallery" }) })).rejects.toThrow("NEXT_REDIRECT");
	});

	it("renders and validates the authenticated preview player", async () => {
		getGalleryPreviewPlayer.mockResolvedValue({ gallery: {}, clips: [], selectedIndex: 1, playbackUrl: "video", ownerName: "alice", showAttribution: false });
		const Page = (await import("@/app/dashboard/galleries/[galleryId]/preview/clip/[clipId]/page")).default;
		render(await Page({ params: Promise.resolve({ galleryId: "gallery", clipId: "clip" }) }));
		expect(screen.getByText("preview-player:1:false")).toBeInTheDocument();
		getGalleryPreviewPlayer.mockResolvedValue(null);
		await expect(Page({ params: Promise.resolve({ galleryId: "gallery", clipId: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
	});
});
