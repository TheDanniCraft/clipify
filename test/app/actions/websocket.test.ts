/** @jest-environment node */
export {};

import { WebSocket } from "ws";
import { Plan } from "@/app/lib/types";

const getOverlayBySecret = jest.fn();
const getOverlayPublic = jest.fn();
const getOverlayOwnerPlanPublic = jest.fn();
const addSubscriber = jest.fn();
const jwtVerify = jest.fn();
const ownerSubscribers = new Map<string, Set<unknown>>();
const overlaySubscribers = new Map<string, Set<unknown>>();

jest.mock("jsonwebtoken", () => ({
	verify: (...args: unknown[]) => jwtVerify(...args),
}));

jest.mock("@actions/database", () => ({
	getOverlayBySecret: (...args: unknown[]) => getOverlayBySecret(...args),
	getOverlayPublic: (...args: unknown[]) => getOverlayPublic(...args),
	getOverlayOwnerPlanPublic: (...args: unknown[]) => getOverlayOwnerPlanPublic(...args),
}));

jest.mock("@store/overlaySubscribers", () => ({
	ownerSubscribers,
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
		ownerId?: string;
		overlayId?: string;
		role?: string;
	};
}

describe("actions/websocket", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		ownerSubscribers.clear();
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
		getOverlayBySecret.mockResolvedValue({ ownerId: "owner-1", id: "ov-1" });
		const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient();

		await handleMessage(
			Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-1", secret: "sec-1" } })),
			client as never,
		);

		expect(clearTimeoutSpy).toHaveBeenCalledWith(client.subscribeDeadline);
		expect(client.ownerId).toBe("owner-1");
		expect(client.overlayId).toBe("ov-1");
		expect(client.role).toBe("overlay");
		expect(addSubscriber).toHaveBeenCalledWith("owner-1", "ov-1", client);
		expect(client.send).toHaveBeenCalledWith("subscribed ov-1");
	});

	it("subscribes valid controller clients with a signed controller token", async () => {
		jwtVerify.mockReturnValue({ overlayId: "ov-1", userId: "editor-1" });
		getOverlayPublic.mockResolvedValue({ ownerId: "owner-1", id: "ov-1" });
		getOverlayOwnerPlanPublic.mockResolvedValue(Plan.Pro);
		const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient();

		await handleMessage(
			Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-1", controllerToken: "signed-token", role: "controller" } })),
			client as never,
		);

		expect(jwtVerify).toHaveBeenCalledWith("signed-token", process.env.JWT_SECRET, expect.objectContaining({ issuer: "clipify-controller" }));
		expect(getOverlayPublic).toHaveBeenCalledWith("ov-1");
		expect(getOverlayOwnerPlanPublic).toHaveBeenCalledWith("ov-1");
		expect(clearTimeoutSpy).toHaveBeenCalledWith(client.subscribeDeadline);
		expect(client.ownerId).toBe("owner-1");
		expect(client.overlayId).toBe("ov-1");
		expect(client.role).toBe("controller");
		expect(addSubscriber).toHaveBeenCalledWith("owner-1", "ov-1", client);
		expect(client.send).toHaveBeenCalledWith("subscribed ov-1");
	});

	it("rejects controller subscriptions with invalid tokens", async () => {
		jwtVerify.mockImplementation(() => {
			throw new Error("invalid");
		});
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient();

		await handleMessage(
			Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-1", controllerToken: "bad-token", role: "controller" } })),
			client as never,
		);

		expect(client.close).toHaveBeenCalledWith(4002);
		expect(getOverlayPublic).not.toHaveBeenCalled();
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
		ownerSubscribers.set("owner-1", new Set([openClient, closedClient]));

		await sendMessage("event", { clipId: "clip-1" }, "owner-1");

		expect(openClient.send).toHaveBeenCalledWith(JSON.stringify({ type: "event", data: { clipId: "clip-1" } }));
		expect(closedClient.send).not.toHaveBeenCalled();
	});

	it("broadcasts messages to all open clients when broadcaster id is omitted", async () => {
		const { sendMessage } = await loadWebsocketActions();
		const ownerAOpen = createClient({ readyState: WebSocket.OPEN });
		const ownerAClosed = createClient({ readyState: WebSocket.CLOSING });
		const ownerBOpen = createClient({ readyState: WebSocket.OPEN });
		overlaySubscribers.set("overlay-a", new Set([ownerAOpen, ownerAClosed]));
		overlaySubscribers.set("overlay-b", new Set([ownerBOpen]));

		await sendMessage("refresh", { full: true });

		expect(ownerAOpen.send).toHaveBeenCalledWith(JSON.stringify({ type: "refresh", data: { full: true } }));
		expect(ownerBOpen.send).toHaveBeenCalledWith(JSON.stringify({ type: "refresh", data: { full: true } }));
		expect(ownerAClosed.send).not.toHaveBeenCalled();
	});
});
