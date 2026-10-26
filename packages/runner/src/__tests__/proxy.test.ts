import { EventEmitter } from "node:events";
import { activateRtmpProbeNonce, startTCPProxy, stopTCPProxy, proxyEvents } from "../engine";
import * as net from "net";

jest.mock("puppeteer-stream", () => ({ launch: jest.fn(), getStream: jest.fn() }));
jest.mock("../downloader", () => ({ ensureDependencies: jest.fn() }));
jest.mock("../extension", () => ({ writeExtension: jest.fn() }));
jest.mock("net", () => ({ createServer: jest.fn(), Socket: jest.fn() }));

class Socket extends EventEmitter {
	remoteAddress = "127.0.0.1";
	destroyed = false;
	destroy = jest.fn(() => {
		if (!this.destroyed) {
			this.destroyed = true;
			this.emit("close");
		}
		return this;
	});
	end = jest.fn();
	write = jest.fn();
	pipe = jest.fn();
	connect = jest.fn();
}
let accept: (socket: Socket) => void;
let server: EventEmitter & { listen: jest.Mock; close: jest.Mock };
let forwards: Socket[];
beforeEach(() => {
	jest.useFakeTimers();
	jest.clearAllMocks();
	forwards = [];
	server = Object.assign(new EventEmitter(), { listen: jest.fn((_port, _host, ready) => ready()), close: jest.fn((closed) => closed()) });
	(net.createServer as jest.Mock).mockImplementation((callback) => {
		accept = callback;
		return server;
	});
	(net.Socket as unknown as jest.Mock).mockImplementation(() => {
		const socket = new Socket();
		forwards.push(socket);
		return socket;
	});
});
afterEach(async () => {
	await stopTCPProxy();
	jest.clearAllTimers();
	jest.useRealTimers();
});

test("valid reachability nonces are single-use and never open broadcast forwarders", async () => {
	expect(await startTCPProxy()).toBe(true);
	expect(await startTCPProxy()).toBe(false);
	activateRtmpProbeNonce("invalid");
	const nonce = "valid_nonce_fixture_123";
	activateRtmpProbeNonce(nonce);
	activateRtmpProbeNonce(nonce);
	const first = new Socket();
	accept(first);
	first.emit("data", Buffer.from("CLIPIFY_RTMP_"));
	expect(first.end).not.toHaveBeenCalled();
	first.emit("data", Buffer.from(`PROBE ${nonce}\n`));
	expect(first.end).toHaveBeenCalledWith("OK\n");
	expect(net.Socket).not.toHaveBeenCalled();
	first.emit("close");
	const replay = new Socket();
	accept(replay);
	replay.emit("data", Buffer.from(`CLIPIFY_RTMP_PROBE ${nonce}\n`));
	expect(replay.destroy).toHaveBeenCalled();
	const expired = new Socket();
	accept(expired);
	activateRtmpProbeNonce(nonce, 100);
	jest.advanceTimersByTime(100);
	expired.emit("data", Buffer.from(`CLIPIFY_RTMP_PROBE ${nonce}\n`));
	expect(expired.destroy).toHaveBeenCalled();
});

test("real ingest buffers initial bytes, retries refused local connections and closes both sockets", async () => {
	const connected = jest.fn(),
		disconnected = jest.fn();
	proxyEvents.on("obsConnected", connected);
	proxyEvents.on("obsDisconnected", disconnected);
	try {
		await startTCPProxy();
		const client = new Socket();
		accept(client);
		client.emit("data", Buffer.from([3, 0, 0]));
		expect(connected).toHaveBeenCalledTimes(1);
		expect(forwards[0].connect).toHaveBeenCalledWith(1936, "127.0.0.1", expect.any(Function));
		forwards[0].emit("error", Object.assign(new Error("refused"), { code: "ECONNREFUSED" }));
		jest.advanceTimersByTime(100);
		expect(forwards).toHaveLength(2);
		const forward = forwards[1];
		forward.connect.mock.calls[0][2]();
		expect(forward.write).toHaveBeenCalledWith(Buffer.from([3, 0, 0]));
		expect(client.pipe).toHaveBeenCalledWith(forward);
		expect(forward.pipe).toHaveBeenCalledWith(client);
		client.emit("data", Buffer.from([4]));
		expect(connected).toHaveBeenCalledTimes(1);
		client.emit("error", new Error("client error"));
		forward.emit("error", Object.assign(new Error("fatal"), { code: "ECONNRESET" }));
		expect(client.destroy).toHaveBeenCalled();
		expect(disconnected).toHaveBeenCalledTimes(1);
	} finally {
		proxyEvents.off("obsConnected", connected);
		proxyEvents.off("obsDisconnected", disconnected);
	}
});

test("stopping destroys open clients and failed listeners can be retried", async () => {
	server.listen.mockImplementationOnce(() => server.emit("error", new Error("port busy")));
	await expect(startTCPProxy()).rejects.toThrow("port busy");
	expect(await startTCPProxy()).toBe(true);
	const socket = new Socket();
	accept(socket);
	await stopTCPProxy();
	expect(socket.destroy).toHaveBeenCalledTimes(1);
	expect(server.close).toHaveBeenCalledTimes(1);
	await stopTCPProxy();
	expect(server.close).toHaveBeenCalledTimes(1);
});
