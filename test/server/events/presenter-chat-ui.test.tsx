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
