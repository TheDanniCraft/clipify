jest.mock("@heroui/react", () => {
	const base = jest.requireActual("@heroui/react");
	const React = jest.requireActual("react");
	const Checkbox = ({ children, isSelected, onChange, ...props }: { children: React.ReactNode; isSelected: boolean; onChange: (value: boolean) => void; "aria-label"?: string }) => React.createElement("label", null, React.createElement("input", { type: "checkbox", checked: isSelected, "aria-label": props["aria-label"], onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked) }), children);
	Object.assign(Checkbox, { Content: base.Checkbox.Content, Control: base.Checkbox.Control, Indicator: base.Checkbox.Indicator });
	return { ...base, Checkbox };
});
import { fireEvent, render, screen } from "@testing-library/react";
import { EventMedia, EventNomineeCard } from "@/app/components/events/EventMedia";
it("separates nominee selection from playback", () => {
	const select = jest.fn(),
		open = jest.fn();
	render(<EventNomineeCard candidate={{ id: "one", content: { kind: "text", title: "Lampe", description: "Original", reference: "" } }} selected={false} onSelect={select} onOpen={open} />);
	fireEvent.click(screen.getByRole("button", { name: "View Lampe" }));
	expect(open).toHaveBeenCalledTimes(1);
	expect(select).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("checkbox", { name: "Vote for Lampe" }));
	expect(select).toHaveBeenCalled();
});
it("embeds a canonical YouTube video and displays text safely", () => {
	const view = render(<EventMedia content={{ kind: "youtube", reference: "abcdefghijk", title: "Video", description: "", thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg" }} />);
	expect(screen.getByTitle("Video")).toHaveAttribute("src", expect.stringContaining("youtube-nocookie.com/embed/abcdefghijk"));
	view.rerender(<EventMedia content={{ kind: "text", reference: "", title: "<script>alert(1)</script>", description: "Insider" }} />);
	expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
	expect(document.querySelector("script")).toBeNull();
});

it("keeps a saved selection explicit after voting closes", () => {
	render(<EventNomineeCard candidate={{ id: "one", content: { kind: "text", title: "Lampe", description: "", reference: "" } }} selected onOpen={() => undefined} />);
	expect(screen.getByText("Your selection", { exact: true })).toBeInTheDocument();
	expect(screen.queryByRole("checkbox")).toBeNull();
});

it("uses a stored image as the nominee thumbnail", () => {
	const mediaUrl = "/api/events/11111111-1111-4111-8111-111111111111/media/22222222-2222-4222-8222-222222222222";
	render(<EventNomineeCard candidate={{ id: "image", content: { kind: "image", title: "Bild", description: "", reference: "asset", mediaUrl } }} onOpen={() => undefined} />);
	expect(screen.getByRole("button", { name: "View Bild" }).querySelector("img")).toHaveAttribute("src", mediaUrl);
});

it.each(["image", "video", "audio"] as const)("offers local retry after a %s fails without taking over navigation", (kind) => {
	render(<EventMedia content={{ kind, title: "Unavailable nominee", description: "", reference: "", mediaUrl: "https://storage.example.invalid/nominee" }} />);
	const media = kind === "image" ? screen.getByRole("img", { name: "Unavailable nominee" }) : screen.getByLabelText("Unavailable nominee");
	fireEvent.error(media);
	expect(screen.getByRole("status")).toHaveTextContent("could not load");
	fireEvent.click(screen.getByRole("button", { name: "Retry media" }));
	expect(screen.queryByRole("status")).not.toBeInTheDocument();
	expect(kind === "image" ? screen.getByRole("img", { name: "Unavailable nominee" }) : screen.getByLabelText("Unavailable nominee")).toBeInTheDocument();
});

it.each([
	["clip", "ValidClip", "clips.twitch.tv"],
	["youtube", "abcdefghijk", "www.youtube-nocookie.com"],
] as const)("provides an origin referrer to the %s provider without leaking preview credentials", (kind, reference, host) => {
	render(<EventMedia content={{ kind, reference, title: "Playable nominee", description: "" }} />);
	const frame = screen.getByTitle("Playable nominee");
	expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
	expect(new URL(frame.getAttribute("src")!).hostname).toBe(host);
	expect(new URL(frame.getAttribute("src")!).hash).toBe("");
});
