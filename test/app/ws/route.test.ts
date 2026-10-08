/** @jest-environment node */
import { EventEmitter } from "node:events";
import { WebSocket, type WebSocketServer } from "ws";

const revalidate = jest.fn();
const message = jest.fn();
const remove = jest.fn();
const disconnected = jest.fn();
const rejected = jest.fn();
jest.mock("@/server/resources/overlay-source-runtime", () => ({ revalidateOverlaySource: (...args: unknown[]) => revalidate(...args) }));
jest.mock("@actions/websocket", () => ({ handleMessage: (...args: unknown[]) => message(...args) }));
jest.mock("@store/overlaySubscribers", () => ({ removeSubscriber: (...args: unknown[]) => remove(...args) }));
jest.mock("@lib/operationalHealth", () => ({ recordWebSocketDisconnected: (...args: unknown[]) => disconnected(...args), recordWebSocketRejected: (...args: unknown[]) => rejected(...args) }));

function client() {
	return Object.assign(new EventEmitter(), {
		OPEN: WebSocket.OPEN,
		readyState: WebSocket.OPEN as number,
		isAlive: true,
		ownerId: null as string | null,
		overlayId: null as string | null,
		role: "overlay" as "overlay" | "controller",
		terminate: jest.fn(),
		ping: jest.fn(),
		close: jest.fn(),
	});
}

async function setup(count = 1) {
	const route = await import("@/app/ws/route");
	const clients = Array.from({ length: count }, client);
	const server = { clients: new Set(clients) } as unknown as WebSocketServer;
	for (const socket of clients) route.UPGRADE(socket as unknown as WebSocket, server);
	return { ...route, clients };
}

describe("websocket upgrade lifecycle", () => {
	beforeEach(() => {
		jest.resetModules();
		jest.useFakeTimers();
		jest.clearAllMocks();
		revalidate.mockReset().mockResolvedValue(true);
		message.mockResolvedValue(undefined);
	});
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});
	test("serves the upgrade endpoint health response", async () => {
		const { GET } = await setup();
		expect((await GET()).status).toBe(200);
	});
	test.each(["missing-owner", "missing-overlay"])("closes an open subscription with %s after ten seconds", async (mode) => {
		const {
			clients: [socket],
		} = await setup();
		if (mode === "missing-owner") socket.overlayId = "overlay";
		else socket.ownerId = "owner";
		await jest.advanceTimersByTimeAsync(10000);
		expect(socket.close).toHaveBeenCalledWith(4001);
		expect(rejected).toHaveBeenCalledWith("subscribe_timeout");
	});
	test.each(["subscribed", "closed"])("does not reject a %s socket at the subscription deadline", async (mode) => {
		const {
			clients: [socket],
		} = await setup();
		if (mode === "subscribed") {
			socket.ownerId = "owner";
			socket.overlayId = "overlay";
		} else socket.readyState = WebSocket.CLOSED;
		await jest.advanceTimersByTimeAsync(10000);
		expect(socket.close).not.toHaveBeenCalled();
		expect(rejected).not.toHaveBeenCalled();
	});
	test("pings once per interval, accepts pong and terminates an unresponsive peer", async () => {
		const {
			clients: [socket],
		} = await setup();
		socket.ownerId = "owner";
		socket.overlayId = "overlay";
		await jest.advanceTimersByTimeAsync(30000);
		expect(socket.ping).toHaveBeenCalledTimes(1);
		expect(socket.isAlive).toBe(false);
		socket.emit("pong");
		await jest.advanceTimersByTimeAsync(30000);
		expect(socket.ping).toHaveBeenCalledTimes(2);
		await jest.advanceTimersByTimeAsync(30000);
		expect(socket.terminate).toHaveBeenCalledTimes(1);
	});
	test("revalidates only open, bound overlay sources", async () => {
		const { clients } = await setup(5);
		for (const socket of clients) {
			socket.ownerId = "owner";
			socket.overlayId = "overlay";
		}
		clients[1].role = "controller";
		clients[2].readyState = WebSocket.CLOSED;
		clients[3].ownerId = null;
		clients[4].overlayId = null;
		await jest.advanceTimersByTimeAsync(30000);
		expect(revalidate).toHaveBeenCalledTimes(1);
		expect(revalidate.mock.calls[0][0]).toBe(clients[0]);
	});
	test("bounds authority checks to four and avoids overlapping heartbeat checks", async () => {
		const pending: Array<() => void> = [];
		revalidate.mockImplementation(() => new Promise<void>((resolve) => pending.push(resolve)));
		const { clients } = await setup(5);
		for (const socket of clients) {
			socket.ownerId = "owner";
			socket.overlayId = "overlay";
		}
		await jest.advanceTimersByTimeAsync(30000);
		expect(revalidate).toHaveBeenCalledTimes(4);
		for (const socket of clients) socket.emit("pong");
		await jest.advanceTimersByTimeAsync(30000);
		expect(revalidate).toHaveBeenCalledTimes(4);
		pending.splice(0).forEach((resolve) => resolve());
		await jest.advanceTimersByTimeAsync(0);
		expect(revalidate).toHaveBeenCalledTimes(5);
		pending.splice(0).forEach((resolve) => resolve());
		await jest.advanceTimersByTimeAsync(0);
		for (const socket of clients) socket.emit("pong");
		revalidate.mockResolvedValue(true);
		await jest.advanceTimersByTimeAsync(30000);
		expect(revalidate).toHaveBeenCalledTimes(10);
	});
	test("continues revalidation after an individual authority check rejects", async () => {
		const { clients } = await setup(2);
		for (const socket of clients) {
			socket.ownerId = "owner";
			socket.overlayId = "overlay";
		}
		revalidate.mockRejectedValueOnce(new Error("database unavailable"));
		await jest.advanceTimersByTimeAsync(30000);
		expect(revalidate).toHaveBeenCalledTimes(2);
	});
	test("forwards received bytes and their actual socket to the message handler", async () => {
		const {
			clients: [socket],
		} = await setup();
		const bytes = Buffer.from('{"type":"subscribe"}');
		socket.emit("message", bytes);
		await Promise.resolve();
		expect(message).toHaveBeenCalledWith(bytes, socket);
	});
	test.each(["close", "error"])("cleans a bound subscription on %s and cancels its deadline", async (event) => {
		const {
			clients: [socket],
		} = await setup();
		socket.ownerId = "owner";
		socket.overlayId = "overlay";
		socket.emit(event);
		expect(remove).toHaveBeenCalledWith("owner", "overlay", socket);
		expect(disconnected).toHaveBeenCalledWith(socket);
		await jest.advanceTimersByTimeAsync(10000);
		expect(rejected).not.toHaveBeenCalled();
	});
	test("records an unbound disconnect without removing another subscription", async () => {
		const {
			clients: [socket],
		} = await setup();
		socket.emit("close");
		expect(disconnected).toHaveBeenCalledWith(socket);
		expect(remove).not.toHaveBeenCalled();
	});
});
