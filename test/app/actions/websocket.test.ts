/** @jest-environment node */
export {};

import { WebSocket } from "ws";

const getOverlayBySecret = jest.fn();
const addSubscriber = jest.fn();
const overlaySubscribers = new Map<string, Set<unknown>>();

jest.mock("@actions/database", () => ({
	getOverlayBySecret: (...args: unknown[]) => getOverlayBySecret(...args),
}));

jest.mock("@store/overlaySubscribers", () => ({
	overlaySubscribers,
	addSubscriber: (...args: unknown[]) => addSubscriber(...args),
}));

async function loadWebsocketActions() {
	jest.resetModules();
	return import("@/app/actions/websocket");
}

function createClient(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		close: jest.fn(),
		send: jest.fn(),
		readyState: WebSocket.OPEN,
		subscribeDeadline: 123,
		...overrides,
	} as {
		close: jest.Mock;
		send: jest.Mock;
		readyState: number;
		subscribeDeadline: unknown;
		broadcaster?: string;
	};
}

describe("actions/websocket", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		overlaySubscribers.clear();
	});

	it("closes subscribe requests when overlay id or secret is missing", async () => {
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient();
		await handleMessage(Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-1" } })), client as never);
		expect(client.close).toHaveBeenCalledWith(4002);
	});

	it("closes subscribe requests when overlay lookup fails", async () => {
		getOverlayBySecret.mockResolvedValue(null);
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient();
		await handleMessage(
			Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-1", secret: "wrong" } })),
			client as never,
		);
		expect(getOverlayBySecret).toHaveBeenCalledWith("ov-1", "wrong");
		expect(client.close).toHaveBeenCalledWith(4002);
	});

	it("subscribes valid clients and stores them by broadcaster", async () => {
		getOverlayBySecret.mockResolvedValue({ ownerId: "owner-1" });
		const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient();

		await handleMessage(
			Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-1", secret: "sec-1" } })),
			client as never,
		);

		expect(clearTimeoutSpy).toHaveBeenCalledWith(client.subscribeDeadline);
		expect(client.broadcaster).toBe("owner-1");
		expect(addSubscriber).toHaveBeenCalledWith("owner-1", client);
		expect(overlaySubscribers.get("owner-1")?.has(client)).toBe(true);
		expect(client.send).toHaveBeenCalledWith("subscribed owner-1");
	});

	it("closes unknown message types", async () => {
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient();
		await handleMessage(Buffer.from(JSON.stringify({ type: "nope", data: {} })), client as never);
		expect(client.close).toHaveBeenCalledWith(4003);
	});

	it("sends messages only to open clients for a specific broadcaster", async () => {
		const { sendMessage } = await loadWebsocketActions();
		const openClient = createClient({ readyState: WebSocket.OPEN });
		const closedClient = createClient({ readyState: WebSocket.CLOSED });
		overlaySubscribers.set("owner-1", new Set([openClient, closedClient]));

		await sendMessage("event", { clipId: "clip-1" }, "owner-1");

		expect(openClient.send).toHaveBeenCalledWith(JSON.stringify({ type: "event", data: { clipId: "clip-1" } }));
		expect(closedClient.send).not.toHaveBeenCalled();
	});

	it("broadcasts messages to all open clients when broadcaster id is omitted", async () => {
		const { sendMessage } = await loadWebsocketActions();
		const ownerAOpen = createClient({ readyState: WebSocket.OPEN });
		const ownerAClosed = createClient({ readyState: WebSocket.CLOSING });
		const ownerBOpen = createClient({ readyState: WebSocket.OPEN });
		overlaySubscribers.set("owner-a", new Set([ownerAOpen, ownerAClosed]));
		overlaySubscribers.set("owner-b", new Set([ownerBOpen]));

		await sendMessage("refresh", { full: true });

		expect(ownerAOpen.send).toHaveBeenCalledWith(JSON.stringify({ type: "refresh", data: { full: true } }));
		expect(ownerBOpen.send).toHaveBeenCalledWith(JSON.stringify({ type: "refresh", data: { full: true } }));
		expect(ownerAClosed.send).not.toHaveBeenCalled();
	});
});
