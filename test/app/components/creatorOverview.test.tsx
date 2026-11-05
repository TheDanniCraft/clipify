let mockActiveTask: string | null = null;
jest.mock("@components/user-tour/provider", () => ({ useUserTour: () => ({ activeTask: mockActiveTask }) }));
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CreatorOverview from "@components/creator/creatorOverview";
import { DashboardNavigationContext } from "@components/dashboardNavigation";
jest.mock("@components/creator/clipPreview", () => ({
	__esModule: true,
	default: ({ clip }: { clip: { id: string } }) => (
		<div role='dialog' aria-label='Clip preview'>
			{clip.id}
		</div>
	),
}));
const overview = jest.fn();
const broadcasts = jest.fn();
const analytics = jest.fn();
jest.mock("@actions/creatorAnalytics", () => ({ getCreatorAnalytics: (...args: unknown[]) => analytics(...args) }));
jest.mock("@actions/creatorLibrary", () => ({ getCreatorClipOverview: (...args: unknown[]) => overview(...args), getCreatorBroadcasts: (...args: unknown[]) => broadcasts(...args) }));
jest.mock("@components/localizedDate", () => ({ __esModule: true, default: ({ value }: { value: string }) => <time>{value}</time> }));
const metrics = { ok: true, count: 2, views: 20, topClips: [{ id: "A", title: "Clutch", views: 20 }], allTimeTopClips: [{ id: "A", title: "Clutch", views: 20 }], complete: false, fetchedAt: "2026-11-03T00:00:00Z", timeZone: "UTC" };
beforeEach(() => {
	mockActiveTask = null;
	overview.mockReset();
	broadcasts.mockReset();
	analytics.mockReset();
});
it.each([true, false])("provides C quick access for mobile=%s outside an active guide", async (mobile) => {
	overview.mockResolvedValue(metrics);
	broadcasts.mockResolvedValue({ ok: true, stale: false, items: [] });
	render(
		<DashboardNavigationContext.Provider value={{ mobile, expanded: false, toggle: jest.fn(), search: jest.fn(), registerSearch: jest.fn() }}>
			<CreatorOverview creatorId='owner' />
		</DashboardNavigationContext.Provider>,
	);
	await screen.findByText("Clutch");
	for (const name of ["Overlays", "Playlists", "Galleries", "Runner"]) expect(screen.getByRole("link", { name })).toBeInTheDocument();
});
it("loads clip metrics independently of unavailable broadcasts", async () => {
	overview.mockResolvedValue(metrics);
	broadcasts.mockResolvedValue({ ok: false, code: "SERVICE_UNAVAILABLE" });
	render(<CreatorOverview creatorId='owner' />);
	await screen.findByText("Clutch");
	expect(screen.getByText("Broadcasts could not be loaded. Your clip data is kept.")).toBeInTheDocument();
	expect(screen.getByText(/older clips may still be syncing/)).toBeInTheDocument();
	expect(overview).toHaveBeenCalledWith({ creatorId: "owner", timeZone: expect.any(String) });
});
it("shows independently cached broadcasts when clip metrics fail", async () => {
	overview.mockRejectedValue(new Error("offline"));
	broadcasts.mockResolvedValue({ ok: true, stale: true, items: [{ id: "1", title: "Saved stream", clipCount: null, createdAt: "2026-11-03T00:00:00Z" }] });
	render(<CreatorOverview creatorId='owner' />);
	await screen.findByText("Saved stream");
	expect(screen.getByText("Clip performance could not be loaded.")).toBeInTheDocument();
	expect(screen.getByText(/Showing saved broadcasts/)).toBeInTheDocument();
	expect(screen.getByText(/Clip counts unavailable/)).toBeInTheDocument();
});
it("recovers failed requests without remounting the page", async () => {
	overview.mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" }).mockResolvedValue({ ...metrics, complete: true });
	broadcasts.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ok: true, stale: false, items: [] });
	render(<CreatorOverview creatorId='owner' />);
	await screen.findByText("Clip performance could not be loaded.");
	fireEvent.click(screen.getByRole("button", { name: "Retry" }));
	await screen.findByText("Clutch");
	expect(screen.getByText(/Library synchronized/)).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Retry broadcasts" }));
	await screen.findByText(/No available broadcasts/);
});
it("shows honest empty metrics and stream titles", async () => {
	overview.mockResolvedValue({ ...metrics, count: 0, views: 0, topClips: [], allTimeTopClips: [], fetchedAt: null });
	broadcasts.mockResolvedValue({ ok: true, stale: false, items: [{ id: "1", title: "", clipCount: 0, createdAt: "2026-11-03T00:00:00Z" }] });
	render(<CreatorOverview creatorId='owner' />);
	await screen.findByText(/No clips from the last 30 days/);
	expect(screen.getByRole("link", { name: "Untitled stream" })).toHaveAttribute("href", "/dashboard/streams/1");
	expect(screen.getByText(/0 clips/)).toBeInTheDocument();
});
it("ignores stale responses after changing creators", async () => {
	let resolve: (value: unknown) => void = () => {};
	overview.mockImplementationOnce(() => new Promise((r) => (resolve = r))).mockResolvedValue({ ...metrics, allTimeTopClips: [{ id: "B", title: "New creator", views: 1 }] });
	broadcasts.mockResolvedValue({ ok: true, items: [], stale: false });
	const view = render(<CreatorOverview creatorId='old' />);
	view.rerender(<CreatorOverview creatorId='new' />);
	await screen.findByText("New creator");
	resolve(metrics);
	await waitFor(() => expect(screen.queryByText("Clutch")).not.toBeInTheDocument());
});
it("retries broadcasts through their local recovery action", async () => {
	overview.mockResolvedValue(metrics);
	broadcasts.mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" }).mockResolvedValue({ ok: true, stale: false, items: [] });
	render(<CreatorOverview creatorId='owner' />);
	fireEvent.click(await screen.findByRole("button", { name: "Retry broadcasts" }));
	await screen.findByText(/No available broadcasts/);
	expect(screen.getByText("Clutch")).toBeInTheDocument();
});
it("ignores failures from the previous creator while retaining the new creator metrics", async () => {
	let rejectOverview: (error: Error) => void = () => {};
	let rejectBroadcasts: (error: Error) => void = () => {};
	overview.mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectOverview = reject))).mockResolvedValue({ ...metrics, allTimeTopClips: [{ id: "B", title: "", views: 1 }] });
	broadcasts.mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectBroadcasts = reject))).mockResolvedValue({ ok: true, stale: false, items: [] });
	const view = render(<CreatorOverview creatorId='old' />);
	view.rerender(<CreatorOverview creatorId='new' />);
	await screen.findByText("Untitled clip");
	rejectOverview(new Error("old failure"));
	rejectBroadcasts(new Error("old failure"));
	await waitFor(() => expect(screen.queryByText("Clip performance could not be loaded.")).not.toBeInTheDocument());
});
it("retries only the failed broadcasts without replacing successful clip metrics", async () => {
	overview.mockResolvedValueOnce(metrics).mockResolvedValue({ ok: false, code: "SERVICE_UNAVAILABLE" });
	broadcasts.mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" }).mockResolvedValue({ ok: true, stale: false, items: [] });
	render(<CreatorOverview creatorId='owner' />);
	await screen.findByText("Clutch");
	fireEvent.click(await screen.findByRole("button", { name: "Retry broadcasts" }));
	await screen.findByText(/No available broadcasts/);
	expect(screen.getByText("Clutch")).toBeInTheDocument();
	expect(overview).toHaveBeenCalledTimes(1);
});

it.each([true, false])("shows guide destination shortcuts only during mobile guidance: mobile=%s", async (mobile) => {
	mockActiveTask = "overlay.name";
	overview.mockResolvedValue(metrics);
	broadcasts.mockResolvedValue({ ok: true, stale: false, items: [{ id: "one", title: "One clip stream", clipCount: 1, createdAt: "2026-11-03T00:00:00Z" }] });
	render(
		<DashboardNavigationContext.Provider value={{ mobile, expanded: false, toggle: jest.fn(), search: jest.fn(), registerSearch: jest.fn() }}>
			<CreatorOverview creatorId='owner' />
		</DashboardNavigationContext.Provider>,
	);
	await screen.findByText("Clutch");
	expect(screen.getByText("1 clip", { exact: true })).toBeInTheDocument();
	if (mobile) {
		expect(screen.getByRole("navigation", { name: "Creator shortcuts" })).toBeVisible();
		for (const [name, path, target] of [
			["Home", "/dashboard", "dashboard-home"],
			["Overlays", "/dashboard/overlays", "overlays-tab"],
			["Playlists", "/dashboard/playlists", "playlists-tab"],
			["Galleries", "/dashboard/galleries", "galleries-tab"],
			["Runner", "/dashboard/runners", "runners-tab"],
		]) {
			expect(screen.getByRole("link", { name })).toHaveAttribute("href", path);
			expect(screen.getByRole("link", { name })).toHaveAttribute("data-tour", target);
		}
	} else expect(screen.queryByRole("navigation", { name: "Creator shortcuts" })).not.toBeInTheDocument();
});

it("opens the exact top clip even when titles are identical", async () => {
	overview.mockResolvedValue({
		...metrics,
		allTimeTopClips: [
			{ id: "A", title: "Same title", views: 20 },
			{ id: "B", title: "Same title", views: 10 },
		],
	});
	broadcasts.mockResolvedValue({ ok: true, stale: false, items: [] });
	render(<CreatorOverview creatorId='owner' />);
	fireEvent.click((await screen.findAllByRole("button", { name: "Same title" }))[1]);
	expect(screen.getByRole("dialog", { name: "Clip preview" })).toHaveTextContent("B");
});
it("offers linked-account recovery when Twitch must reconnect", async () => {
	overview.mockResolvedValue({ ok: false, code: "RECONNECT_REQUIRED" });
	broadcasts.mockResolvedValue({ ok: true, stale: false, items: [] });
	render(<CreatorOverview creatorId='owner' />);
	await screen.findByText("Reconnect Twitch to load your clips.");
	expect(screen.getByRole("link", { name: "Manage linked accounts" })).toHaveAttribute("href", "/dashboard/settings?tab=connections");
});
it("gives an empty Home a library action instead of empty statistic cards", async () => {
	overview.mockResolvedValue({ ...metrics, count: 0, views: 0, topClips: [] });
	broadcasts.mockResolvedValue({ ok: true, stale: false, items: [] });
	render(<CreatorOverview creatorId='owner' />);
	expect(await screen.findByRole("link", { name: "Browse clip inventory" })).toHaveAttribute("href", "/dashboard/clips");
	expect(screen.queryByRole("status", { name: "Known clips" })).not.toBeInTheDocument();
});

it("keeps older top clips visible without recent streams or clips", async () => {
	overview.mockResolvedValue({ ...metrics, count: 0, topClips: [], allTimeTopClips: [{ id: "old", title: "An old favourite", views: 123 }] });
	broadcasts.mockResolvedValue({ ok: true, items: [], stale: false });
	render(<CreatorOverview creatorId='owner' />);
	await screen.findByText("An old favourite");
	expect(screen.getByText(/All-time most viewed/)).toBeVisible();
	for (const name of ["Overlays", "Playlists", "Galleries", "Runner", "Clip Inventory"]) expect(screen.getByRole("link", { name }).querySelector("svg")).not.toBeNull();
	expect(analytics).not.toHaveBeenCalled();
	expect(screen.getByRole("link", { name: "Unlock with Pro" })).toHaveAttribute("href", expect.stringContaining("upgrade=1"));
});
it("loads genuine page metrics for Pro and recovers without dropping clip metrics", async () => {
	overview.mockResolvedValue(metrics);
	broadcasts.mockResolvedValue({ ok: true, items: [], stale: false });
	analytics.mockResolvedValueOnce(null).mockResolvedValue({ metrics: { visitors: 12, pageviews: 30, clipPlays: 8, visits: 15 }, stale: true, fetchedAt: "2026-11-05T00:00:00Z" });
	render(<CreatorOverview creatorId='owner' analyticsAllowed />);
	fireEvent.click(await screen.findByRole("button", { name: "Retry page analytics" }));
	await screen.findByRole("status", { name: "Creator Page visitors" });
	expect(screen.getByRole("status", { name: "Creator Page visitors" })).toHaveTextContent("12");
	expect(screen.getByText(/Showing saved analytics/)).toBeVisible();
	expect(screen.getByText("Clutch")).toBeVisible();
	expect(analytics).toHaveBeenCalledWith("owner", { start: expect.any(String), end: expect.any(String) });
	expect(screen.queryByRole("link", { name: "Unlock with Pro" })).not.toBeInTheDocument();
});
it("keeps a Pro service failure separate from the upgrade prompt", async () => {
	overview.mockResolvedValue(metrics);
	broadcasts.mockResolvedValue({ ok: true, items: [], stale: false });
	analytics.mockRejectedValue(new Error("offline"));
	render(<CreatorOverview creatorId='owner' analyticsAllowed />);
	await screen.findByRole("button", { name: "Retry page analytics" });
	expect(screen.queryByRole("link", { name: "Unlock with Pro" })).not.toBeInTheDocument();
	expect(screen.getByText("Clutch")).toBeVisible();
});
it("does not display a previous creator's late page analytics", async () => {
	overview.mockResolvedValue(metrics);
	broadcasts.mockResolvedValue({ ok: true, items: [], stale: false });
	let finish: (value: unknown) => void = () => {};
	const result = (visitors: number) => ({ metrics: { visitors, pageviews: 0, visits: 0, clipPlays: 0 }, stale: false, fetchedAt: "2026-11-05T00:00:00Z" });
	analytics
		.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		)
		.mockResolvedValue(result(0));
	const view = render(<CreatorOverview creatorId='old' analyticsAllowed />);
	await waitFor(() => expect(analytics).toHaveBeenCalledWith("old", expect.any(Object)));
	view.rerender(<CreatorOverview creatorId='new' analyticsAllowed />);
	await screen.findByRole("status", { name: "Creator Page visitors" });
	await act(async () => finish(result(99)));
	await waitFor(() => expect(screen.getByRole("status", { name: "Creator Page visitors" })).toHaveTextContent("0"));
});
