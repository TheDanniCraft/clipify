import { render, screen } from "@testing-library/react";

const getPublicGallery = jest.fn();
const getHeader = jest.fn();
const notFound = jest.fn();

jest.mock("next/headers", () => ({
	headers: jest.fn(async () => ({ get: getHeader })),
}));

jest.mock("next/navigation", () => ({
	notFound: (...args: unknown[]) => notFound(...args),
}));

jest.mock("@actions/gallery", () => ({
	getPublicGallery: (...args: unknown[]) => getPublicGallery(...args),
}));

jest.mock("@components/gallery/GalleryFrame", () => ({
	__esModule: true,
	default: ({ ownerName }: { ownerName: string }) => <div>{`gallery-frame:${ownerName}`}</div>,
}));

describe("gallery frame page", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		notFound.mockImplementation(() => {
			throw new Error("NEXT_NOT_FOUND");
		});
		getPublicGallery.mockResolvedValue({ gallery: {}, clips: [], owner: { username: "alice" }, showAttribution: true });
	});

	it("renders only when the request destination is an iframe", async () => {
		getHeader.mockImplementation((name: string) => (name === "sec-fetch-dest" ? "iframe" : null));
		const Page = (await import("@/app/gallery/[galleryId]/frame/page")).default;

		const { container } = render(await Page({ params: Promise.resolve({ galleryId: "gallery-1" }) }));

		expect(screen.getByText("gallery-frame:alice")).toBeInTheDocument();
		expect(getPublicGallery).toHaveBeenCalledWith("gallery-1");
		expect(container.querySelector("style")).toHaveTextContent("html,body,#root{height:100%;background:transparent!important}html{color-scheme:normal!important}body{margin:0;padding:0;min-height:100%!important}");
	});

	it.each([null, "document"])("returns not found for destination %s", async (destination) => {
		getHeader.mockImplementation((name: string) => (name === "sec-fetch-dest" ? destination : null));
		const Page = (await import("@/app/gallery/[galleryId]/frame/page")).default;

		await expect(Page({ params: Promise.resolve({ galleryId: "gallery-1" }) })).rejects.toThrow("NEXT_NOT_FOUND");
		expect(getPublicGallery).not.toHaveBeenCalled();
	});
});
