import { render, screen } from "@testing-library/react";
const auth = jest.fn();
const inventory = jest.fn();
const detail = jest.fn();
const broadcasts = jest.fn();
const broadcast = jest.fn();
const redirect = jest.fn((destination: string) => {
	throw new Error(`redirect:${destination}`);
});
jest.mock("next/navigation", () => ({ redirect: (destination: string) => redirect(destination) }));
jest.mock("@actions/auth", () => ({ validateAuth: () => auth() }));
jest.mock("@actions/creatorLibrary", () => ({ getCreatorClipInventory: (...args: unknown[]) => inventory(...args), getCreatorClipDetail: (...args: unknown[]) => detail(...args), getCreatorBroadcasts: (...args: unknown[]) => broadcasts(...args), getCreatorBroadcast: (...args: unknown[]) => broadcast(...args) }));
jest.mock("@components/dashboardNavbar", () => ({
	__esModule: true,
	default: ({ children, title }: { children: React.ReactNode; title: string }) => (
		<main>
			<h1>{title}</h1>
			{children}
		</main>
	),
}));
jest.mock("@components/creator/clipInventory", () => ({ __esModule: true, default: ({ query }: { query: unknown }) => <output>{JSON.stringify(query)}</output> }));
jest.mock("@components/OverlayTable", () => ({ __esModule: true, default: ({ resourceType, userId }: { resourceType: string; userId: string }) => <output>{`${resourceType}:${userId}`}</output> }));
jest.mock("@components/localizedDate", () => ({ __esModule: true, default: ({ value }: { value: string }) => <time>{value}</time> }));
jest.mock("@components/creator/clipDetails", () => ({ __esModule: true, default: ({ creatorId }: { creatorId: string }) => <output>{creatorId}</output> }));
const empty = { ok: true, items: [], nextCursor: null, stale: false, fetchedAt: "2026-11-03T00:00:00Z" };
beforeEach(() => {
	jest.clearAllMocks();
	auth.mockResolvedValue({ id: "owner" });
	inventory.mockResolvedValue({ ok: true, items: [], total: 0 });
	broadcasts.mockResolvedValue(empty);
	broadcast.mockResolvedValue({ ok: true, broadcast: { id: "123", title: "Owned stream", url: "https://www.twitch.tv/videos/123", clipCount: 1, clipViews: 42 }, stale: false });
});
it("parses only scalar query values and converts numeric inventory filters", async () => {
	const Page = (await import("@/app/dashboard/clips/page")).default;
	render(await Page({ searchParams: Promise.resolve({ page: "2", pageSize: "50", minViews: "10", title: "Clutch", unknown: ["a", "b"] }) }));
	expect(inventory).toHaveBeenCalledWith({ creatorId: "owner", query: { page: 2, pageSize: 50, minViews: 10, title: "Clutch" } });
	expect(screen.getByRole("heading", { name: "Clip Inventory" })).toBeInTheDocument();
});
it("requires authentication before reading inventory", async () => {
	auth.mockResolvedValue(false);
	const Page = (await import("@/app/dashboard/clips/page")).default;
	await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect");
	expect(inventory).not.toHaveBeenCalled();
});
it.each(["playlists", "galleries", "runners"] as const)("opens the dedicated %s resource list", async (kind) => {
	const Page = (await import(`@/app/dashboard/${kind}/page`)).default;
	render(await Page());
	expect(screen.getByText(`${kind}:owner`)).toBeInTheDocument();
});
it.each(["playlists", "galleries", "runners"] as const)("protects the %s resource list", async (kind) => {
	auth.mockResolvedValue(false);
	const Page = (await import(`@/app/dashboard/${kind}/page`)).default;
	await expect(Page()).rejects.toThrow("redirect");
});
it("shows empty broadcasts without suggesting cached clips were deleted", async () => {
	const Page = (await import("@/app/dashboard/streams/page")).default;
	render(await Page({ searchParams: Promise.resolve({}) }));
	expect(screen.getByRole("heading", { name: "No available broadcasts" })).toBeInTheDocument();
	expect(screen.getByRole("link", { name: "Open Clip Inventory" })).toHaveAttribute("href", "/dashboard/clips");
});
it.each(["RECONNECT_REQUIRED", "SERVICE_UNAVAILABLE"])("offers recovery for %s", async (code) => {
	broadcasts.mockResolvedValue({ ok: false, code });
	const Page = (await import("@/app/dashboard/streams/page")).default;
	render(await Page({ searchParams: Promise.resolve({}) }));
	expect(screen.getByRole("alert")).toBeInTheDocument();
	expect(screen.getByRole("link", { name: "Retry streams" })).toBeInTheDocument();
	if (code === "RECONNECT_REQUIRED") expect(screen.getByRole("link", { name: "Manage linked accounts" })).toBeInTheDocument();
});
it("renders stale broadcasts, unknown counts and signed pagination", async () => {
	broadcasts.mockResolvedValue({ ...empty, stale: true, nextCursor: "signed/cursor", items: [{ id: "123", title: "", createdAt: "2026-11-03T00:00:00Z", duration: "1h", clipCount: null, clipViews: null }] });
	const Page = (await import("@/app/dashboard/streams/page")).default;
	render(await Page({ searchParams: Promise.resolve({ after: "previous" }) }));
	expect(screen.getByRole("link", { name: "Untitled stream" })).toHaveAttribute("href", "/dashboard/streams/123");
	expect(screen.getAllByText("Unavailable")).toHaveLength(2);
	expect(screen.getByRole("link", { name: "Next streams" })).toHaveAttribute("href", "/dashboard/streams?after=signed%2Fcursor");
	expect(screen.getByRole("link", { name: "Latest streams" })).toBeInTheDocument();
});
it("formats known broadcast counts", async () => {
	broadcasts.mockResolvedValue({ ...empty, items: [{ id: "123", title: "Stream", createdAt: "2026-11-03T00:00:00Z", duration: "1h", clipCount: 2, clipViews: 50 }] });
	const Page = (await import("@/app/dashboard/streams/page")).default;
	render(await Page({ searchParams: Promise.resolve({}) }));
	expect(screen.getByText("2")).toBeInTheDocument();
	expect(screen.getByText("50")).toBeInTheDocument();
});
it("authorizes the stream before querying clips and overrides a forged VOD query", async () => {
	const Page = (await import("@/app/dashboard/streams/[videoId]/page")).default;
	render(await Page({ params: Promise.resolve({ videoId: "123" }), searchParams: Promise.resolve({ videoId: "foreign", page: "2", minDuration: "3", junk: ["a"] }) }));
	expect(inventory).toHaveBeenCalledWith({ creatorId: "owner", query: { videoId: "123", page: 2, minDuration: 3 } });
	expect(screen.getByRole("heading", { name: "Owned stream" })).toBeInTheDocument();
	expect(screen.getByRole("status", { name: "Stream clip totals" })).toHaveTextContent("Known clips: 1");
	expect(screen.getByRole("status", { name: "Stream clip totals" })).toHaveTextContent("Current clip views: 42");
});
it("does not query clips for an unavailable broadcast", async () => {
	broadcast.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
	const Page = (await import("@/app/dashboard/streams/[videoId]/page")).default;
	render(await Page({ params: Promise.resolve({ videoId: "123" }), searchParams: Promise.resolve({}) }));
	expect(inventory).not.toHaveBeenCalled();
	expect(screen.getByRole("heading", { name: "Stream unavailable" })).toBeInTheDocument();
});
it("shows saved broadcast status and an untitled fallback", async () => {
	broadcast.mockResolvedValue({ ok: true, broadcast: { title: "", url: "https://www.twitch.tv/videos/123", clipCount: null, clipViews: null }, stale: true });
	const Page = (await import("@/app/dashboard/streams/[videoId]/page")).default;
	render(await Page({ params: Promise.resolve({ videoId: "123" }), searchParams: Promise.resolve({}) }));
	expect(screen.getByRole("heading", { name: "Untitled stream" })).toBeInTheDocument();
	expect(screen.getByText("Showing saved broadcast information.")).toBeInTheDocument();
});
it("protects both stream routes before provider access", async () => {
	auth.mockResolvedValue(false);
	const List = (await import("@/app/dashboard/streams/page")).default;
	const Detail = (await import("@/app/dashboard/streams/[videoId]/page")).default;
	await expect(List({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect");
	await expect(Detail({ params: Promise.resolve({ videoId: "123" }), searchParams: Promise.resolve({}) })).rejects.toThrow("redirect");
	expect(broadcasts).not.toHaveBeenCalled();
	expect(broadcast).not.toHaveBeenCalled();
});

it("authorizes clip details before reading the requested creator metadata", async () => {
	const Page = (await import("@/app/dashboard/clips/[clipId]/page")).default;
	render(await Page({ params: Promise.resolve({ clipId: "A" }) }));
	expect(detail).toHaveBeenCalledWith({ creatorId: "owner", clipId: "A" });
	expect(screen.getByRole("heading", { name: "Clip details" })).toBeVisible();
});
it("requires sign-in before resolving clip details", async () => {
	auth.mockResolvedValue(null);
	const Page = (await import("@/app/dashboard/clips/[clipId]/page")).default;
	await expect(Page({ params: Promise.resolve({ clipId: "A" }) })).rejects.toThrow("redirect");
	expect(detail).not.toHaveBeenCalled();
});

jest.mock("@components/creator/clipLayoutEditor", () => ({ __esModule: true, default: ({ creatorId, ids }: { creatorId: string; ids: string[] }) => <output>{`${creatorId}:${ids.join(",")}`}</output> }));
it("opens the portrait workspace for the authenticated creator and deduplicates selection", async () => {
	const Page = (await import("@/app/dashboard/clips/layout/page")).default;
	render(await Page({ searchParams: Promise.resolve({ clips: "A,A,B" }) }));
	expect(detail).toHaveBeenCalledWith({ creatorId: "owner", clipId: "A" });
	expect(screen.getByText("owner:A,B")).toBeVisible();
});
it.each(["", "x".repeat(201), Array.from({ length: 51 }, (_, i) => String(i)).join(",")])("rejects an invalid portrait selection before reading clips", async (clips) => {
	const Page = (await import("@/app/dashboard/clips/layout/page")).default;
	render(await Page({ searchParams: Promise.resolve({ clips }) }));
	expect(screen.getByRole("link", { name: "Select clips in your inventory" })).toBeVisible();
	expect(detail).not.toHaveBeenCalled();
});
it("requires authentication before opening a portrait layout", async () => {
	auth.mockResolvedValue(false);
	const Page = (await import("@/app/dashboard/clips/layout/page")).default;
	await expect(Page({ searchParams: Promise.resolve({ clips: "A" }) })).rejects.toThrow("redirect");
});
