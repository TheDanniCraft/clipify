import { act, fireEvent, render, screen } from "@testing-library/react";
import EventPresenterChat from "@/app/components/events/EventPresenterChat";
const originalSocket = globalThis.WebSocket;
class Socket {
	static all: Socket[] = [];
	onopen: (() => void) | null = null;
	onmessage: ((event: { data: string }) => void) | null = null;
	onclose: ((event: { code: number }) => void) | null = null;
	onerror: (() => void) | null = null;
	send = jest.fn();
	close = jest.fn(() => this.onclose?.({ code: 1000 }));
	constructor(readonly url: URL) {
		Socket.all.push(this);
	}
	frame(type: string, data: unknown) {
		this.onmessage?.({ data: JSON.stringify({ type, data }) });
	}
}
const message = { id: "one", login: "viewer", name: "Viewer", color: "", text: "constructor toString", fragments: [{ type: "text", text: "constructor toString" }], badges: [], at: 1 };
beforeEach(() => {
	Socket.all = [];
	globalThis.WebSocket = Socket as unknown as typeof WebSocket;
});
afterEach(() => {
	globalThis.WebSocket = originalSocket;
	jest.useRealTimers();
});
it("renders pushed text safely instead of treating prototype names as emotes", () => {
	render(<EventPresenterChat eventId='show' secret='secret' />);
	act(() => Socket.all[0].frame("event_chat_catalog", { badges: {}, emotes: {}, warnings: [] }));
	act(() => Socket.all[0].frame("event_chat_messages", { messages: [message] }));
	expect(screen.getByText("constructor toString")).toBeInTheDocument();
	expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
it("shows a pushed active 7TV badge beside Twitch badges and emotes", () => {
	render(<EventPresenterChat eventId='show' secret='secret' />);
	act(() => Socket.all[0].frame("event_chat_catalog", { badges: { "subscriber:1": "https://static-cdn.jtvnw.net/sub.png" }, emotes: { peepoHappy: "https://cdn.7tv.app/emote/happy/2x.webp" }, warnings: [] }));
	act(() => Socket.all[0].frame("event_chat_messages", { messages: [{ ...message, fragments: [{ type: "text", text: "peepoHappy" }], badges: [{ set_id: "subscriber", id: "1" }], sevenTvBadge: { id: "founder", name: "Founder", url: "https://cdn.7tv.app/badge/founder/2x.webp" } }] }));
	expect(screen.getByRole("img", { name: "7TV Founder" })).toHaveAttribute("src", "https://cdn.7tv.app/badge/founder/2x.webp");
	expect(screen.getByRole("img", { name: "subscriber" })).toBeInTheDocument();
	expect(screen.getByRole("img", { name: "peepoHappy" })).toBeInTheDocument();
});
it("subscribes a preview without tokens in the URL and preserves text through reconnects", () => {
	jest.useFakeTimers();
	const view = render(<EventPresenterChat eventId='show' secret='read-only-capability' preview />);
	act(() => Socket.all[0].onopen?.());
	expect(Socket.all[0].url.pathname).toBe("/ws");
	expect(Socket.all[0].url.search).toBe("");
	expect(JSON.parse(Socket.all[0].send.mock.calls[0][0])).toMatchObject({ type: "event_chat_subscribe", data: { eventId: "show", secret: "read-only-capability", preview: true } });
	act(() => Socket.all[0].frame("event_chat_messages", { messages: [message] }));
	expect(screen.getByText("constructor toString")).toBeInTheDocument();
	act(() => Socket.all[0].onclose?.({ code: 1006 }));
	act(() => jest.advanceTimersByTime(1000));
	expect(Socket.all).toHaveLength(2);
	expect(screen.getByText("constructor toString")).toBeInTheDocument();
	view.unmount();
	act(() => jest.advanceTimersByTime(30000));
	expect(Socket.all).toHaveLength(2);
});
it("does not automatically retry revoked access and allows an explicit retry", () => {
	jest.useFakeTimers();
	render(<EventPresenterChat eventId='show' secret='secret' />);
	act(() => Socket.all[0].onclose?.({ code: 4002 }));
	act(() => jest.advanceTimersByTime(30000));
	expect(Socket.all).toHaveLength(1);
	expect(screen.getByText(/Chat access ended/)).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Retry chat" }));
	expect(Socket.all).toHaveLength(2);
});
