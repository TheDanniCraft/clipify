import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClipPreview from "@components/creator/clipPreview";
const preview = jest.fn();
jest.mock("@actions/creatorLibrary", () => ({ getCreatorClipPreview: (...args: unknown[]) => preview(...args) }));
jest.mock("@components/controlledModal", () => ({
	__esModule: true,
	default: ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
		<section>
			<button onClick={onClose}>Close</button>
			{children}
		</section>
	),
}));
const clip = { id: "exact-id", title: "Same title", url: "https://clips.twitch.tv/exact-id" };
beforeEach(() => preview.mockReset());
it.each([null, "reject"])("recovers an unavailable preview without changing its identity: %s", async (failure) => {
	if (failure) preview.mockRejectedValueOnce(new Error("offline"));
	else preview.mockResolvedValueOnce(null);
	preview.mockResolvedValueOnce({ playbackUrl: "https://media.example/clip.mp4" });
	const close = jest.fn();
	const view = render(<ClipPreview creatorId='owner' clip={clip} onClose={close} />);
	await screen.findByRole("alert");
	fireEvent.click(screen.getByRole("button", { name: "Retry preview" }));
	await waitFor(() => expect(view.container.querySelector("video")).toHaveAttribute("src", "https://media.example/clip.mp4"));
	expect(preview.mock.calls).toEqual([[{ creatorId: "owner", clipId: "exact-id" }], [{ creatorId: "owner", clipId: "exact-id" }]]);
	expect(screen.getByRole("link")).toHaveAttribute("href", clip.url);
	fireEvent.click(screen.getByRole("button", { name: "Close" }));
	expect(close).toHaveBeenCalledTimes(1);
});
it.each([false, true])("ignores a late result after closing, rejected=%s", async (rejected) => {
	let finish!: (value: unknown) => void;
	preview.mockImplementation(
		() =>
			new Promise((resolve, reject) => {
				finish = rejected ? reject : resolve;
			}),
	);
	const view = render(<ClipPreview creatorId='owner' clip={{ ...clip, title: "" }} onClose={jest.fn()} />);
	expect(screen.getByText("Untitled clip")).toBeInTheDocument();
	view.unmount();
	await act(async () => finish({ playbackUrl: "https://media.example/stale.mp4" }));
	expect(view.container).toBeEmptyDOMElement();
});
