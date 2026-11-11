import { render, screen } from "@testing-library/react";
import EventPresenterChat from "@/app/components/events/EventPresenterChat";
import { connectEventChatAction, pollEventChatAction } from "@/app/actions/events";
jest.mock("@/app/actions/events", () => ({ connectEventChatAction: jest.fn(), pollEventChatAction: jest.fn() }));
it("renders ordinary text tokens safely instead of treating object prototype names as emotes", async () => {
	Element.prototype.scrollIntoView = jest.fn();
	jest.mocked(connectEventChatAction).mockResolvedValue({ ok: true, catalog: { badges: {}, emotes: {}, warnings: [] } });
	jest.mocked(pollEventChatAction).mockResolvedValue({ ok: true, messages: [{ id: "one", login: "viewer", name: "Viewer", color: "", text: "constructor toString", fragments: [{ type: "text", text: "constructor toString" }], badges: [], at: 1 }] });
	render(<EventPresenterChat eventId='show' secret='secret' />);
	expect(await screen.findByText("constructor toString")).toBeInTheDocument();
	expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it("shows a chatter's active 7TV badge beside Twitch badges and emotes", async () => {
	Element.prototype.scrollIntoView = jest.fn();
	jest.mocked(connectEventChatAction).mockResolvedValue({ ok: true, catalog: { badges: { "subscriber:1": "https://static-cdn.jtvnw.net/sub.png" }, emotes: { peepoHappy: "https://cdn.7tv.app/emote/happy/2x.webp" }, warnings: [] } });
	jest.mocked(pollEventChatAction).mockResolvedValue({ ok: true, messages: [{ id: "badged", userId: "123", login: "viewer", name: "Viewer", color: "", text: "peepoHappy", fragments: [{ type: "text", text: "peepoHappy" }], badges: [{ set_id: "subscriber", id: "1" }], sevenTvBadge: { id: "founder", name: "Founder", url: "https://cdn.7tv.app/badge/founder/2x.webp" }, at: 1 }] });
	render(<EventPresenterChat eventId='show' secret='secret' />);
	expect(await screen.findByRole("img", { name: "7TV Founder" })).toHaveAttribute("src", "https://cdn.7tv.app/badge/founder/2x.webp");
	expect(screen.getByRole("img", { name: "subscriber" })).toBeInTheDocument();
	expect(screen.getByRole("img", { name: "peepoHappy" })).toBeInTheDocument();
});
