const notFound = jest.fn(() => {
	throw new Error("NEXT_NOT_FOUND");
});

jest.mock("next/navigation", () => ({ notFound: () => notFound() }));

it("does not expose a raw standalone gallery page", async () => {
	const Page = (await import("@/app/gallery/[galleryId]/page")).default;
	expect(() => Page()).toThrow("NEXT_NOT_FOUND");
	expect(notFound).toHaveBeenCalled();
});
