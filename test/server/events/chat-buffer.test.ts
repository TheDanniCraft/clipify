/** @jest-environment node */
import { activateAwardChat, relayAwardChat, readAwardChat, filterAwardChat } from "@/server/events/chat-buffer";
const message = { broadcaster_user_id: "host", message_id: "one", chatter_user_login: "viewer", chatter_user_name: "Viewer", color: "#abcdef", message: { text: "hi", fragments: [{ type: "text", text: "hi" }] }, badges: [] };
it("retains only active channels, deduplicates delivery and expires show messages", () => {
	const now = 1000;
	relayAwardChat(message, now);
	expect(readAwardChat("host", now)).toEqual([]);
	activateAwardChat("host", now);
	relayAwardChat(message, now);
	relayAwardChat(message, now);
	expect(readAwardChat("host", now)).toHaveLength(1);
	expect(readAwardChat("host", now + 61000)).toEqual([]);
});
it("applies the team's account and command prefixes while preserving ordinary chat", () => {
	activateAwardChat("filter", 1000);
	for (const [id, login, text] of [
		["a", "bot", "hi"],
		["b", "viewer", "?song"],
		["c", "viewer", "hello Kappa"],
	])
		relayAwardChat({ ...message, broadcaster_user_id: "filter", message_id: id, chatter_user_login: login, message: { text, fragments: [{ type: "text", text }] } }, 1000);
	expect(filterAwardChat(readAwardChat("filter", 1000), { hiddenAccounts: ["bot"], commandPrefixes: ["?"] }).map((m) => m.text)).toEqual(["hello Kappa"]);
});
it("bounds the buffer and rejects malformed or executable fragment data", () => {
	activateAwardChat("bounded", 1000);
	for (let i = 0; i < 70; i++) relayAwardChat({ ...message, broadcaster_user_id: "bounded", message_id: String(i) }, 1000);
	expect(readAwardChat("bounded", 1000)).toHaveLength(50);
	relayAwardChat({ ...message, broadcaster_user_id: "bounded", message: { text: "x".repeat(5000), fragments: [] } }, 1000);
	expect(readAwardChat("bounded", 1000)).toHaveLength(50);
});

it("pushes each accepted message immediately and stops on unsubscribe", async () => {
	const { subscribeAwardChat } = await import("@/server/events/chat-buffer");
	activateAwardChat("streaming", 1000);
	const receive = jest.fn();
	const unsubscribe = subscribeAwardChat("streaming", receive);
	relayAwardChat({ ...message, broadcaster_user_id: "streaming" }, 1000);
	expect(receive).toHaveBeenCalledTimes(1);
	expect(receive.mock.calls[0][0]).toMatchObject([{ text: "hi" }]);
	relayAwardChat({ ...message, broadcaster_user_id: "streaming" }, 1000);
	expect(receive).toHaveBeenCalledTimes(1);
	unsubscribe();
	relayAwardChat({ ...message, broadcaster_user_id: "streaming", message_id: "two" }, 1000);
	expect(receive).toHaveBeenCalledTimes(1);
});
