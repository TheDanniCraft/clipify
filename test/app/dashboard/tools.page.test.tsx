import { render, screen } from "@testing-library/react";

const validateAuth = jest.fn();
const getAllOverlays = jest.fn();
const getEditorOverlays = jest.fn();
const getAllGalleries = jest.fn();
const getBaseUrl = jest.fn();

jest.mock("@actions/auth", () => ({ validateAuth: (...args: unknown[]) => validateAuth(...args) }));
jest.mock("@actions/database", () => ({
	getAllOverlays: (...args: unknown[]) => getAllOverlays(...args),
	getEditorOverlays: (...args: unknown[]) => getEditorOverlays(...args),
}));
jest.mock("@actions/gallery", () => ({ getAllGalleries: (...args: unknown[]) => getAllGalleries(...args) }));
jest.mock("@actions/utils", () => ({ getBaseUrl: (...args: unknown[]) => getBaseUrl(...args) }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("@components/dashboardNavbar", () => ({
	__esModule: true,
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("@components/tools/ToolsClient", () => ({
	__esModule: true,
	default: ({ origin, overlays, galleries }: { origin: string; overlays: { name: string }[]; galleries: { name: string }[] }) => (
		<div>
			{`tools-origin:${origin}`}{" "}
			{[...overlays, ...galleries].map((item) => (
				<span key={item.name}>{item.name}</span>
			))}
		</div>
	),
}));

describe("dashboard tools page", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		validateAuth.mockResolvedValue({ id: "user-1" });
		getAllOverlays.mockResolvedValue([]);
		getEditorOverlays.mockResolvedValue([]);
		getAllGalleries.mockResolvedValue([]);
		getBaseUrl.mockResolvedValue(new URL("https://preview.clipify.us/path"));
	});

	it("uses the configured base URL origin for generated snippets", async () => {
		const Page = (await import("@/app/dashboard/tools/page")).default;

		render(await Page({ searchParams: Promise.resolve({}) }));

		expect(screen.getByText("tools-origin:https://preview.clipify.us")).toBeInTheDocument();
		expect(getBaseUrl).toHaveBeenCalledTimes(1);
	});
	it("only offers website resources from the selected workspace", async () => {
		getAllOverlays.mockResolvedValue([{ id: "selected", ownerId: "user-1", name: "Selected overlay" }]);
		getEditorOverlays.mockResolvedValue([{ id: "other", ownerId: "other-creator", name: "Other overlay" }]);
		getAllGalleries.mockResolvedValue([
			{ ownerId: "user-1", name: "Selected gallery" },
			{ ownerId: "other-creator", name: "Other gallery" },
		]);
		const Page = (await import("@/app/dashboard/tools/page")).default;
		render(await Page({ searchParams: Promise.resolve({}) }));
		expect(screen.getByText("Selected overlay")).toBeInTheDocument();
		expect(screen.getByText("Selected gallery")).toBeInTheDocument();
		expect(screen.queryByText("Other overlay")).not.toBeInTheDocument();
		expect(screen.queryByText("Other gallery")).not.toBeInTheDocument();
		expect(getEditorOverlays).not.toHaveBeenCalled();
	});
});
