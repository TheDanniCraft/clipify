import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import MemberCardActions from "@components/membership/MemberCardActions";

jest.mock("@heroui/react", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Action = React.createContext<(id: string) => void>(() => undefined);
	const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
	return {
		Button: ({ children, onPress, "aria-label": label }: { children: ReactNode; onPress?: () => void; "aria-label"?: string }) => (
			<button onClick={onPress} aria-label={label}>
				{children}
			</button>
		),
		Label: Container,
		Dropdown: Object.assign(Container, {
			Popover: Container,
			Menu: ({ children, onAction }: { children: ReactNode; onAction: (id: string) => void }) => <Action.Provider value={onAction}>{children}</Action.Provider>,
			Item: ({ children, id, textValue }: { children: ReactNode; id: string; textValue: string }) => {
				const action = React.useContext(Action);
				return (
					<button aria-label={textValue} onClick={() => action(id)}>
						{children}
					</button>
				);
			},
		}),
	};
});

const cardId = "025dcf9a-10f5-47ad-a6f0-cbe1151b6fbc";
const url = `http://localhost/members/${cardId}`;
const writeText = jest.fn();
describe("MemberCardActions", () => {
	beforeEach(() => {
		writeText.mockReset().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
		Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
		jest.spyOn(window, "open").mockImplementation(() => null);
	});
	afterEach(() => jest.restoreAllMocks());
	const show = () => render(<MemberCardActions username='clipper' cardId={cardId} memberNumber={20} isOwner />);

	it("downloads through a real attachment link", () => {
		show();
		const download = screen.getByRole("link", { name: "Download member card PNG" });
		expect(download).toHaveAttribute("href", "/api/member-card?download=1");
		expect(download).toHaveAttribute("download");
	});
	it("copies the UUID URL without fetching or downloading a PNG", async () => {
		show();
		fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
		await waitFor(() => expect(writeText).toHaveBeenCalledWith(url));
		expect(await screen.findByText("Member card link copied.")).toBeInTheDocument();
	});
	it("copies a message for Discord including the member number", async () => {
		show();
		fireEvent.click(screen.getByRole("button", { name: "Copy for Discord" }));
		await waitFor(() => expect(writeText).toHaveBeenCalledWith(`I'm member #20 on Clipify. Here's my card!\n${url}`));
	});
	it.each(["LinkedIn", "X", "WhatsApp"])("opens a %s share composer with the correct URL", (platform) => {
		show();
		fireEvent.click(screen.getByRole("button", { name: `Share to ${platform}` }));
		const target = new URL(jest.mocked(window.open).mock.calls[0][0] as string);
		expect(platform === "WhatsApp" ? target.searchParams.get("text") : target.searchParams.get("url")).toContain(url);
		expect(window.open).toHaveBeenCalledWith(expect.any(String), "_blank", "noopener,noreferrer");
	});
	it("provides a selectable link when clipboard access fails", async () => {
		writeText.mockRejectedValue(new Error("denied"));
		show();
		fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
		expect(await screen.findByRole("textbox", { name: "Member card link" })).toHaveValue(url);
	});
	it("uses the native share sheet for links only", async () => {
		const share = jest.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "share", { configurable: true, value: share });
		show();
		fireEvent.click(screen.getByRole("button", { name: "More sharing options" }));
		await waitFor(() => expect(share).toHaveBeenCalledWith({ title: "clipper's Clipify Member Card", text: "I'm member #20 on Clipify. Here's my card!", url }));
	});
	it("does not download or copy anything when native sharing is cancelled", async () => {
		const share = jest.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
		Object.defineProperty(navigator, "share", { configurable: true, value: share });
		show();
		fireEvent.click(screen.getByRole("button", { name: "More sharing options" }));
		await waitFor(() => expect(share).toHaveBeenCalled());
		expect(writeText).not.toHaveBeenCalled();
	});
});
