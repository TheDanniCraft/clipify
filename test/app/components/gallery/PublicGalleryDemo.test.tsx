import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PublicGalleryDemo from "@components/gallery/PublicGalleryDemo";
import { buildClip } from "../../gallery/fixtures";
const clips = [buildClip("one")];
const load = jest.fn();
const media = jest.fn();
jest.mock("@actions/gallery", () => ({ getDemoGalleryClips: () => load() }));
jest.mock("@actions/twitch", () => ({ getTwitchClipPlaybackUrl: (...args: unknown[]) => media(...args) }));
jest.mock("@components/gallery/GalleryFrame", () => ({ __esModule: true, default: ({ onSelectClip }: { onSelectClip: (clip: (typeof clips)[number]) => void }) => <button onClick={() => onSelectClip(clips[0])}>Play sample</button> }));
jest.mock("@heroui/react", () => {
	const Part = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
	return {
		Button: ({ children, onPress, isPending: _pending, isDisabled, ...props }: { children: React.ReactNode; onPress: () => void; isPending?: boolean; isDisabled?: boolean }) => (
			<button {...props} disabled={isDisabled} onClick={onPress}>
				{children}
			</button>
		),
		Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
		Spinner: () => <span>spinner</span>,
		Modal: {
			Backdrop: ({ children, isOpen, onOpenChange }: { children: React.ReactNode; isOpen: boolean; onOpenChange: (open: boolean) => void }) =>
				isOpen ? (
					<div>
						<button onClick={() => onOpenChange(false)}>Close player</button>
						<button onClick={() => onOpenChange(true)}>Keep open</button>
						{children}
					</div>
				) : null,
			Container: Part,
			Dialog: Part,
			Header: Part,
			Heading: Part,
			Body: Part,
			CloseTrigger: () => null,
		},
	};
});
beforeEach(() => {
	jest.clearAllMocks();
	load.mockResolvedValue({ overlayId: "public-demo", clips });
	media.mockResolvedValue("https://media.example.invalid/clip.mp4");
});
async function open() {
	fireEvent.click(screen.getByRole("button", { name: "Explore the demo gallery" }));
	await screen.findByRole("button", { name: "Play sample" });
	fireEvent.click(screen.getByRole("button", { name: "Play sample" }));
}
it("loads only on intent, requests approved demo media, and removes it on close", async () => {
	const { container } = render(<PublicGalleryDemo />);
	expect(load).not.toHaveBeenCalled();
	expect(media).not.toHaveBeenCalled();
	await open();
	await waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", "https://media.example.invalid/clip.mp4"));
	expect(media).toHaveBeenCalledWith("one", "owner", { kind: "demo", overlayId: "public-demo" });
	expect(screen.getByRole("link", { name: "Watch on Twitch" })).toHaveAttribute("href", "https://clips.twitch.tv/one");
	fireEvent.click(screen.getByRole("button", { name: "Keep open" }));
	fireEvent.click(screen.getByRole("button", { name: "Close player" }));
	expect(container.querySelector("video")).toBeNull();
});
it.each([null, new Error("network")])("recovers from absent clips and gallery lookup failure", async (result) => {
	if (result instanceof Error) load.mockRejectedValueOnce(result);
	else load.mockResolvedValueOnce(result);
	render(<PublicGalleryDemo />);
	fireEvent.click(screen.getByRole("button", { name: "Explore the demo gallery" }));
	expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load");
	fireEvent.click(screen.getByRole("button", { name: "Try gallery again" }));
	await screen.findByRole("button", { name: "Play sample" });
});
it.each([undefined, new Error("network")])("retries missing or rejected playback URLs", async (result) => {
	if (result instanceof Error) media.mockRejectedValueOnce(result);
	else media.mockResolvedValueOnce(result);
	const { container } = render(<PublicGalleryDemo />);
	await open();
	await screen.findByRole("button", { name: "Try clip again" });
	fireEvent.click(screen.getByRole("button", { name: "Try clip again" }));
	await waitFor(() => expect(container.querySelector("video")).not.toBeNull());
	fireEvent.error(container.querySelector("video")!);
	expect(screen.getByRole("alert")).toHaveTextContent("couldn't play");
});
it.each(["resolve", "reject"])("ignores late %s after the player closes", async (mode) => {
	let resolve!: (value: string) => void;
	let reject!: (error: Error) => void;
	media.mockReturnValueOnce(
		new Promise<string>((yes, no) => {
			resolve = yes;
			reject = no;
		}),
	);
	const { container } = render(<PublicGalleryDemo />);
	await open();
	expect(screen.getByRole("status")).toHaveTextContent("Loading clip");
	fireEvent.click(screen.getByRole("button", { name: "Close player" }));
	await act(async () => {
		if (mode === "resolve") resolve("https://media.example.invalid/late.mp4");
		else reject(new Error("late"));
	});
	expect(container.querySelector("video")).toBeNull();
	expect(screen.queryByRole("alert")).toBeNull();
});
