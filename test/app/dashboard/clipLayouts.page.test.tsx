import { render, screen } from "@testing-library/react";
import Page from "@/app/dashboard/clip-layouts/page";
const auth = jest.fn(),
	brand = jest.fn(),
	library = jest.fn();
jest.mock("@actions/auth", () => ({ validateAuth: () => auth() }));
jest.mock("@actions/creatorBrand", () => ({ getCreatorBrand: (...args: unknown[]) => brand(...args) }));
jest.mock("@components/dashboardNavbar", () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock("@components/creator/clipLayoutLibrary", () => ({
	__esModule: true,
	default: (props: any) => {
		library(props);
		return <div>Library</div>;
	},
}));
jest.mock("next/navigation", () => ({
	redirect: () => {
		throw Error("redirect");
	},
}));
beforeEach(() => {
	jest.clearAllMocks();
	auth.mockResolvedValue({ id: "creator" });
	brand.mockResolvedValue({ ok: true, brand: null, canRemoveWatermark: false });
});
it("passes creator branding and the enforced watermark to paired templates", async () => {
	render(await Page({ searchParams: Promise.resolve({ layout: "paired", clip: "clip", reference: "ref", format: "mobile", new: "desktop" }) }));
	expect(library).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "creator", layoutId: "paired", clipId: "clip", referenceId: "ref", canRemoveWatermark: false }));
	brand.mockResolvedValue({ ok: true, brand: { watermark: false }, canRemoveWatermark: true });
	render(await Page({ searchParams: Promise.resolve({ layout: "<invalid>", clip: "", reference: "x" }) }));
	expect(library).toHaveBeenLastCalledWith(expect.objectContaining({ canRemoveWatermark: true, layoutId: undefined, clipId: undefined }));
});
it("preserves layouts behind a retry when brand access fails and redirects signed-out users", async () => {
	brand.mockResolvedValue({ ok: false, code: "SERVICE_UNAVAILABLE" });
	render(await Page({ searchParams: Promise.resolve({}) }));
	expect(screen.getByRole("link", { name: "Retry layouts" })).toBeVisible();
	auth.mockResolvedValue(null);
	await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect");
});
