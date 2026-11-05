import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClipPlayer from "@components/creator/clipPlayer";
const preview = jest.fn(),
	notify = jest.fn();
jest.mock("@actions/creatorLibrary", () => ({ getCreatorClipPreview: (...args: unknown[]) => preview(...args) }));
jest.mock("@lib/toast", () => ({ notify: (...args: unknown[]) => notify(...args) }));
beforeEach(() => jest.clearAllMocks());
it("loads an authorized playback URL into the stable player frame", async () => {
	preview.mockResolvedValue({ playbackUrl: "https://media.test/a.mp4" });
	render(<ClipPlayer creatorId='owner' clipId='A' />);
	await waitFor(() => expect(screen.getByLabelText("Clip preview")).toHaveAttribute("src", "https://media.test/a.mp4"));
	expect(preview).toHaveBeenCalledWith({ creatorId: "owner", clipId: "A" });
});
it("retries unavailable and failed playback without leaving the clip", async () => {
	preview.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ playbackUrl: "https://media.test/a.mp4" });
	render(<ClipPlayer creatorId='owner' clipId='A' />);
	fireEvent.click(await screen.findByRole("button", { name: "Retry preview" }));
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ description: "Please try again." })));
	fireEvent.click(screen.getByRole("button", { name: "Retry preview" }));
	await screen.findByLabelText("Clip preview");
});
it.each([false, true])("ignores playback settled after unmount, rejection=%s", async (reject) => {
	let resolve!: (value: unknown) => void, fail!: (reason: Error) => void;
	preview.mockImplementation(
		() =>
			new Promise((done, error) => {
				resolve = done;
				fail = error;
			}),
	);
	const view = render(<ClipPlayer creatorId='owner' clipId='A' />);
	view.unmount();
	await act(async () => {
		if (reject) fail(new Error("offline"));
		else resolve(null);
	});
	expect(notify).not.toHaveBeenCalled();
});
it("recovers from an expired media URL after the server resolves it", async () => {
	preview.mockResolvedValueOnce({ playbackUrl: "https://media.test/expired.mp4" }).mockResolvedValue({ playbackUrl: "https://media.test/fresh.mp4" });
	render(<ClipPlayer creatorId='owner' clipId='A' />);
	const video = await screen.findByLabelText("Clip preview");
	fireEvent.error(video);
	fireEvent.click(await screen.findByRole("button", { name: "Retry preview" }));
	await waitFor(() => expect(screen.getByLabelText("Clip preview")).toHaveAttribute("src", "https://media.test/fresh.mp4"));
});
