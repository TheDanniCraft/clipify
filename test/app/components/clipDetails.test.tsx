import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClipDetails from "@components/creator/clipDetails";
const push = jest.fn(),
	refresh = jest.fn(),
	notify = jest.fn(),
	download = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
jest.mock("@lib/toast", () => ({ notify: (...args: unknown[]) => notify(...args) }));
jest.mock("@components/dashboardEditorLayout", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }));
jest.mock("@components/codeSnippet", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <code>{children}</code> }));
jest.mock("@components/localizedDate", () => ({ __esModule: true, default: ({ value }: { value: string }) => <time>{value}</time> }));
jest.mock("@components/creator/clipPlayer", () => ({ __esModule: true, default: () => null }));
jest.mock("@components/creator/clipExport", () => ({
	__esModule: true,
	default: (props: unknown) => {
		download(props);
		return null;
	},
}));
const clip = { id: "A", title: "Winning round", url: "https://clips.twitch.tv/A", categoryId: "game", createdAt: "2026-11-01T00:00:00Z", views: 42, duration: 12, thumbnailUrl: null, broadcasterId: "owner", broadcasterName: "Channel", clipCreatorId: "viewer", clipCreatorName: "Viewer", videoId: "123", vodOffsetSeconds: 10, language: "en", isFeatured: true };
beforeEach(() => jest.clearAllMocks());
it("keeps metadata and individual downloads scoped to the owned clip", () => {
	render(<ClipDetails creatorId='owner' data={{ ok: true, clip, categoryName: "Game", fetchedAt: clip.createdAt }} />);
	expect(screen.getByRole("heading", { name: "Winning round" })).toBeVisible();
	expect(screen.getByRole("link", { name: "View stream" })).toHaveAttribute("href", "/dashboard/streams/123");
	expect(download).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "owner", clipIds: ["A"], format: "mp4" }));
	fireEvent.click(screen.getByRole("button", { name: "Back to clip inventory" }));
	expect(push).toHaveBeenCalledWith("/dashboard/clips");
});
it("handles missing optional metadata without inventing a stream", () => {
	render(<ClipDetails creatorId='owner' data={{ ok: true, clip: { ...clip, title: "", broadcasterName: null, clipCreatorName: null, videoId: null, vodOffsetSeconds: null, language: null, isFeatured: null }, categoryName: null, fetchedAt: clip.createdAt }} />);
	expect(screen.getByRole("heading", { name: "Untitled clip" })).toBeVisible();
	expect(screen.queryByRole("link", { name: "View stream" })).toBeNull();
	expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
});
it.each(["NOT_FOUND", "PERMISSION_DENIED"] as const)("recovers from %s without displaying metadata", async (code) => {
	render(<ClipDetails creatorId='owner' data={{ ok: false, code }} />);
	expect(download).not.toHaveBeenCalled();
	expect(screen.queryByText("Winning round")).toBeNull();
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" })));
	fireEvent.click(screen.getByRole("button", { name: "Retry loading clip" }));
	expect(refresh).toHaveBeenCalledTimes(1);
});
