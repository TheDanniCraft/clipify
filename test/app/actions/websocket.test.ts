/** @jest-environment node */
export {};

import { WebSocket } from "ws";
import { Plan } from "@/app/lib/types";

const getOverlayBySecret = jest.fn();
const revalidateOverlaySource = jest.fn().mockResolvedValue(true);
jest.mock("@/server/resources/overlay-source-runtime", () => ({ revalidateOverlaySource: (...args: unknown[]) => revalidateOverlaySource(...args) }));
const getOverlayPublic = jest.fn();
const getOverlayOwnerPlanPublic = jest.fn();
const addSubscriber = jest.fn();
const removeSubscriber = jest.fn();
const jwtVerify = jest.fn();
const ownerSubscribers = new Map<string, Set<unknown>>();
const overlaySubscribers = new Map<string, Set<unknown>>();
const recordWebSocketSubscribed = jest.fn();
const recordWebSocketRejected = jest.fn();
const recordOverlayStateUpdate = jest.fn();

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
	removeSubscriber: (...args: unknown[]) => removeSubscriber(...args),
}));

jest.mock("@lib/operationalHealth", () => ({
	recordWebSocketSubscribed: (...args: unknown[]) => recordWebSocketSubscribed(...args),
	recordWebSocketRejected: (...args: unknown[]) => recordWebSocketRejected(...args),
	recordOverlayStateUpdate: (...args: unknown[]) => recordOverlayStateUpdate(...args),
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
		sourceActive?: boolean;
	};
}

describe("actions/websocket", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		revalidateOverlaySource.mockReset().mockResolvedValue(true);
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
		await handleMessage(Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-1", secret: "wrong" } })), client as never);
		expect(getOverlayBySecret).toHaveBeenCalledWith("ov-1", "wrong");
		expect(client.close).toHaveBeenCalledWith(4002);
	});

	it("subscribes valid clients and stores them by broadcaster", async () => {
		getOverlayBySecret.mockResolvedValue({ ownerId: "owner-1", id: "ov-1" });
		const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient();

		await handleMessage(Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-1", secret: "sec-1" } })), client as never);

		expect(clearTimeoutSpy).toHaveBeenCalledWith(client.subscribeDeadline);
		expect(client.ownerId).toBe("owner-1");
		expect(client.overlayId).toBe("ov-1");
		expect(client.role).toBe("overlay");
		expect(addSubscriber).toHaveBeenCalledWith("owner-1", "ov-1", client);
		expect(recordWebSocketSubscribed).toHaveBeenCalledWith(client, "ov-1", "owner-1", "overlay");
		expect(client.send).toHaveBeenCalledWith("subscribed ov-1");
	});

	it("subscribes valid controller clients with a signed controller token", async () => {
		jwtVerify.mockReturnValue({ overlayId: "ov-1", userId: "editor-1" });
		getOverlayPublic.mockResolvedValue({ ownerId: "owner-1", id: "ov-1" });
		getOverlayOwnerPlanPublic.mockResolvedValue(Plan.Pro);
		const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient();

		await handleMessage(Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-1", controllerToken: "signed-token", role: "controller" } })), client as never);

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

		await handleMessage(Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-1", controllerToken: "bad-token", role: "controller" } })), client as never);

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

describe("WebSocket source activity", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		revalidateOverlaySource.mockReset().mockResolvedValue(true);
		overlaySubscribers.clear();
	});
	it("accepts ordered activity changes after current runtime validation", async () => {
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient({ overlayId: "ov-1", ownerId: "owner-1", role: "overlay" });
		overlaySubscribers.set("ov-1", new Set([client]));
		await handleMessage(Buffer.from(JSON.stringify({ type: "source_activity", data: { active: true } })), client as never);
		expect(client.sourceActive).toBe(true);
		await handleMessage(Buffer.from(JSON.stringify({ type: "source_activity", data: { active: false } })), client as never);
		expect(client.sourceActive).toBe(false);
		expect(client.close).not.toHaveBeenCalled();
		expect(getOverlayBySecret).not.toHaveBeenCalled();
		expect(getOverlayPublic).not.toHaveBeenCalled();
		expect(revalidateOverlaySource).toHaveBeenCalledTimes(2);
	});
	it.each([{}, { overlayId: "ov-1", ownerId: "owner-1", role: "controller" }, { overlayId: "ov-1", ownerId: "owner-1", role: "overlay" }])("rejects activity from unauthorized or unregistered connections %j", async (overrides) => {
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient(overrides);
		await handleMessage(Buffer.from(JSON.stringify({ type: "source_activity", data: { active: true } })), client as never);
		expect(client.close).toHaveBeenCalledWith(4002);
		expect(client.sourceActive).toBeUndefined();
	});
	it.each([{}, { active: "true" }, null])("rejects malformed activity %j", async (data) => {
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient({ overlayId: "ov-1", ownerId: "owner-1", role: "overlay" });
		overlaySubscribers.set("ov-1", new Set([client]));
		await handleMessage(Buffer.from(JSON.stringify({ type: "source_activity", data })), client as never);
		expect(client.close).toHaveBeenCalledWith(4003);
		expect(client.sourceActive).toBeUndefined();
	});
	it("resets activity and removes the previous registry entry when a socket re-subscribes", async () => {
		getOverlayBySecret.mockResolvedValue({ ownerId: "owner-2", id: "ov-2", status: "active" });
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient({ overlayId: "ov-1", ownerId: "owner-1", role: "overlay", sourceActive: true });
		await handleMessage(Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-2", secret: "secret" } })), client as never);
		expect(removeSubscriber).toHaveBeenCalledWith("owner-1", "ov-1", client);
		expect(client.sourceActive).toBeUndefined();
		expect(client.overlayId).toBe("ov-2");
	});
	it("rejects paused overlays at subscription time", async () => {
		getOverlayBySecret.mockResolvedValue({ ownerId: "owner-1", id: "ov-1", status: "paused" });
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient();
		await handleMessage(Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-1", secret: "secret" } })), client as never);
		expect(client.close).toHaveBeenCalledWith(4002);
		expect(addSubscriber).not.toHaveBeenCalled();
	});
});

it("TDD-OVERLAY-RUNTIME-003 refused runtime check cannot restore presence", async () => {
	revalidateOverlaySource.mockResolvedValue(false);
	const { handleMessage } = await loadWebsocketActions();
	const client = createClient({ overlayId: "ov-1", ownerId: "owner-1", role: "overlay", sourceActive: false });
	overlaySubscribers.set("ov-1", new Set([client]));
	await handleMessage(Buffer.from(JSON.stringify({ type: "source_activity", data: { active: true } })), client as never);
	expect(client.sourceActive).toBe(false);
});

describe("WebSocket message and broadcast boundaries", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		revalidateOverlaySource.mockReset().mockResolvedValue(true);
		jwtVerify.mockReset().mockReturnValue({ overlayId: "ov-1", userId: "editor" });
		getOverlayPublic.mockReset().mockResolvedValue({ id: "ov-1", ownerId: "owner" });
		getOverlayOwnerPlanPublic.mockReset().mockResolvedValue(Plan.Pro);
		overlaySubscribers.clear();
		ownerSubscribers.clear();
	});
	it.each(["not-json", "null", "true", "42"])("rejects nonmessage input %s", async (message) => {
		const error = jest.spyOn(console, "error").mockImplementation(() => {});
		try {
			const { handleMessage } = await loadWebsocketActions();
			const client = createClient();
			await handleMessage(Buffer.from(message), client as never);
			expect(client.close).toHaveBeenCalledWith(4003);
			expect(recordWebSocketRejected).toHaveBeenCalledWith("invalid_message");
		} finally {
			error.mockRestore();
		}
	});
	it.each([{ role: "unexpected", overlayId: "ov-1" }, {}, { overlayId: "ov-1", role: "controller" }])("rejects invalid subscription %j", async (data) => {
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient();
		await handleMessage(Buffer.from(JSON.stringify({ type: "subscribe", data })), client as never);
		expect(client.close).toHaveBeenCalledWith(data.role === "unexpected" ? 4003 : 4002);
		expect(addSubscriber).not.toHaveBeenCalled();
	});
	it.each([{ overlayId: "other", userId: "editor" }, { overlayId: "ov-1" }, null])("rejects mismatched controller claims %j", async (claims) => {
		jwtVerify.mockReturnValue(claims);
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient();
		await handleMessage(Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-1", role: "controller", controllerToken: "fixture" } })), client as never);
		expect(client.close).toHaveBeenCalledWith(4002);
		expect(getOverlayPublic).not.toHaveBeenCalled();
	});
	it.each(["missing", "lookup-error", "free", "plan-error"])("controller %s lookup fails closed", async (mode) => {
		if (mode === "missing") getOverlayPublic.mockResolvedValue(null);
		if (mode === "lookup-error") getOverlayPublic.mockRejectedValue(new Error("lookup"));
		if (mode === "free") getOverlayOwnerPlanPublic.mockResolvedValue(Plan.Free);
		if (mode === "plan-error") getOverlayOwnerPlanPublic.mockRejectedValue(new Error("lookup"));
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient();
		await handleMessage(Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-1", role: "controller", controllerToken: "fixture" } })), client as never);
		expect(client.close).toHaveBeenCalledWith(4002);
		expect(addSubscriber).not.toHaveBeenCalled();
	});
	it("controller commands cannot redirect to a different overlay", async () => {
		const { handleMessage } = await loadWebsocketActions();
		const controller = createClient({ role: "controller", ownerId: "owner", overlayId: "ov-1" });
		const own = createClient(),
			foreign = createClient();
		overlaySubscribers.set("ov-1", new Set([own]));
		overlaySubscribers.set("foreign", new Set([foreign]));
		await handleMessage(Buffer.from(JSON.stringify({ type: "command", data: { name: "pause", overlayId: "foreign" } })), controller as never);
		expect(own.send).toHaveBeenCalledWith(JSON.stringify({ type: "command", data: { name: "pause", data: null } }));
		expect(foreign.send).not.toHaveBeenCalled();
	});
	it("state updates exclude sender and closed clients", async () => {
		const { handleMessage } = await loadWebsocketActions();
		const source = createClient({ role: "overlay", ownerId: "owner", overlayId: "ov-1" });
		const open = createClient(),
			closed = createClient({ readyState: WebSocket.CLOSED });
		overlaySubscribers.set("ov-1", new Set([source, open, closed]));
		await handleMessage(Buffer.from(JSON.stringify({ type: "state_update", data: { clipId: "clip" } })), source as never);
		expect(recordOverlayStateUpdate).toHaveBeenCalledWith(source, { clipId: "clip" });
		expect(open.send).toHaveBeenCalledWith(JSON.stringify({ type: "overlay_state", data: { clipId: "clip" } }));
		expect(source.send).not.toHaveBeenCalled();
		expect(closed.send).not.toHaveBeenCalled();
	});
	it.each([{}, { overlayId: "ov-1", role: "controller" }])("unauthorized state update closes the socket before broadcasting %j", async (overrides) => {
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient(overrides);
		await handleMessage(Buffer.from(JSON.stringify({ type: "state_update", data: { clipId: "clip" } })), client as never);
		expect(client.close).toHaveBeenCalledWith(4002);
		expect(recordOverlayStateUpdate).not.toHaveBeenCalled();
	});

	it.each([null, "not an object"])("malformed subscribed state %j never reaches listeners", async (data) => {
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient({ overlayId: "ov-1", role: "overlay" });
		await handleMessage(Buffer.from(JSON.stringify({ type: "state_update", data })), client as never);
		expect(client.close).toHaveBeenCalledWith(4003);
		expect(revalidateOverlaySource).not.toHaveBeenCalled();
		expect(recordOverlayStateUpdate).not.toHaveBeenCalled();
	});

	it("revoked runtime prevents an otherwise valid state broadcast", async () => {
		revalidateOverlaySource.mockResolvedValue(false);
		const { handleMessage } = await loadWebsocketActions();
		const source = createClient({ overlayId: "ov-1", ownerId: "owner", role: "overlay" });
		const receiver = createClient();
		overlaySubscribers.set("ov-1", new Set([source, receiver]));
		await handleMessage(Buffer.from(JSON.stringify({ type: "state_update", data: { clipId: "clip" } })), source as never);
		expect(recordOverlayStateUpdate).not.toHaveBeenCalled();
		expect(receiver.send).not.toHaveBeenCalled();
	});

	it.each([{}, { ownerId: "owner", overlayId: "ov-1", role: "overlay" }])("commands from noncontrollers are rejected %j", async (overrides) => {
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient(overrides);
		await handleMessage(Buffer.from(JSON.stringify({ type: "command", data: { name: "pause" } })), client as never);
		expect(client.close).toHaveBeenCalledWith(4002);
	});

	it.each([undefined, { name: 42 }, { name: "" }])("invalid controller command %j is rejected without delivery", async (data) => {
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient({ ownerId: "owner", overlayId: "ov-1", role: "controller" });
		await handleMessage(Buffer.from(JSON.stringify({ type: "command", data })), client as never);
		expect(client.close).toHaveBeenCalledWith(4003);
	});

	it("an explicitly bound controller target preserves its command data", async () => {
		const { handleMessage } = await loadWebsocketActions();
		const client = createClient({ ownerId: "owner", overlayId: "ov-1", role: "controller" });
		const receiver = createClient();
		overlaySubscribers.set("ov-1", new Set([receiver]));
		await handleMessage(Buffer.from(JSON.stringify({ type: "command", data: { name: "volume", overlayId: "ov-1", data: { volume: 30 } } })), client as never);
		expect(receiver.send).toHaveBeenCalledWith(JSON.stringify({ type: "command", data: { name: "volume", data: { volume: 30 } } }));
	});

	it("playback issue telemetry records the authorized overlay without reflecting it back to the sender", async () => {
		const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const { handleMessage } = await loadWebsocketActions();
			const client = createClient({ ownerId: "owner", overlayId: "ov-1", role: "overlay" });
			overlaySubscribers.set("ov-1", new Set([client]));
			await handleMessage(Buffer.from(JSON.stringify({ type: "state_update", data: { kind: "playback_issue", reason: "network" } })), client as never);
			expect(warning).toHaveBeenCalledWith("Overlay playback issue", { kind: "playback_issue", reason: "network", ownerId: "owner", overlayId: "ov-1" });
			expect(recordOverlayStateUpdate).toHaveBeenCalled();
			expect(client.send).not.toHaveBeenCalled();
		} finally {
			warning.mockRestore();
		}
	});
});
