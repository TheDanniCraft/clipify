import type { ElementType, ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CreatorPageClient from "@components/creator/CreatorPageClient";
import type { TwitchClip } from "@types";

const getCreatorClipPage = jest.fn();
const getCreatorClipPlayback = jest.fn();
const plausible = jest.fn();
const scrollIntoView = jest.fn();

jest.mock("@actions/creatorPage", () => ({
	getCreatorClipPage: (...args: unknown[]) => getCreatorClipPage(...args),
	getCreatorClipPlayback: (...args: unknown[]) => getCreatorClipPlayback(...args),
}));
jest.mock("next-plausible", () => ({ usePlausible: () => plausible }));
jest.mock("@components/appDateRangePicker", () => ({ __esModule: true, default: () => <div data-testid='date-range' /> }));
jest.mock("@heroui/react", () => {
	const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
	const Button = ({ as, children, onPress, isDisabled, isPending: _isPending, isIconOnly: _isIconOnly, ...props }: { as?: ElementType; children?: ReactNode; onPress?: () => void; isDisabled?: boolean; isPending?: boolean; isIconOnly?: boolean }) => {
		const Component = as ?? "button";
		return (
			<Component {...props} disabled={isDisabled} onClick={onPress}>
				{children}
			</Component>
		);
	};
	const Card = Object.assign(Part, { Content: Part });
	const Select = Object.assign(Part, { Trigger: Part, Value: () => null, Indicator: () => null, Popover: Part });
	const ListBox = Object.assign(Part, { Item: Part, ItemIndicator: () => null });
	return { Button, Card, Label: Part, ListBox, Select };
});

function buildClip(index: number): TwitchClip {
	return {
		id: `clip-${index}`,
		url: `https://clips.twitch.tv/clip-${index}`,
		embed_url: "",
		broadcaster_id: "owner",
		broadcaster_name: "Owner",
		creator_id: "creator",
		creator_name: "Creator",
		video_id: "video",
		game_id: "game",
		language: "en",
		title: `Clip ${index}`,
		view_count: index * 10,
		created_at: "2026-08-14T00:00:00.000Z",
		thumbnail_url: `https://example.com/${index}.jpg`,
		duration: 30,
	};
}

describe("CreatorPageClient", () => {
	beforeAll(() => {
		Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
			configurable: true,
			value: function (this: HTMLDialogElement) {
				Object.defineProperty(this, "open", { configurable: true, value: true });
			},
		});
		Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
		Object.defineProperty(window, "requestAnimationFrame", {
			configurable: true,
			value: (callback: FrameRequestCallback) => {
				callback(0);
				return 1;
			},
		});
		Object.defineProperty(global, "IntersectionObserver", {
			configurable: true,
			value: class {
				observe() {}
				disconnect() {}
			},
		});
	});

	beforeEach(() => {
		jest.clearAllMocks();
		getCreatorClipPlayback.mockResolvedValue({ playbackUrl: "https://example.com/clip.mp4" });
	});

	it("loads another page while navigating at the initial boundary and keeps the selected card in view", async () => {
		const initialItems = Array.from({ length: 24 }, (_, index) => buildClip(index + 1));
		getCreatorClipPage.mockResolvedValue({ items: [buildClip(25)], nextCursor: null, total: 25 });
		render(<CreatorPageClient creator={{ username: "creator", avatar: "https://example.com/avatar.jpg", description: "", createdAt: "2026-01-01", visibility: "discoverable", twitchBadge: null, clipifyBadge: "free", live: null }} initialItems={initialItems} initialCursor='24' initialTotal={25} today='2026-08-14' />);

		fireEvent.click(screen.getByRole("button", { name: /Clip 24/i }));
		await waitFor(() => expect(getCreatorClipPage).toHaveBeenCalledWith("creator", expect.objectContaining({ cursor: "24", pageSize: 24 })));
		await screen.findByRole("button", { name: /Clip 25/i });
		fireEvent.click(screen.getByRole("button", { name: "Next clip", hidden: true }));

		await waitFor(() => expect(within(document.querySelector("dialog") as HTMLDialogElement).getByRole("heading", { name: "Clip 25", hidden: true })).toBeInTheDocument());
		expect(within(document.querySelector("dialog") as HTMLDialogElement).getByText(/250 views/)).toBeInTheDocument();
		expect(within(document.querySelector("dialog") as HTMLDialogElement).getByText("25 / 25")).toBeInTheDocument();
		expect(scrollIntoView).toHaveBeenCalled();
	});
});
