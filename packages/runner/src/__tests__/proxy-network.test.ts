import { createConnection } from "node:net";
import { randomUUID } from "node:crypto";
import { networkInterfaces } from "node:os";
import { activateRtmpProbeNonce, startTCPProxy, stopTCPProxy } from "../engine";

jest.mock("puppeteer-stream", () => ({ launch: jest.fn(), getStream: jest.fn() }));
jest.mock("../downloader", () => ({ ensureDependencies: jest.fn() }));
jest.mock("../extension", () => ({ writeExtension: jest.fn() }));

const originalHost = process.env.CLIPIFY_RTMP_HOST;
afterEach(async () => {
	await stopTCPProxy();
	// Drain the TCP sockets' close callbacks before Jest restores the test console.
	await new Promise<void>((resolve) => setImmediate(() => setImmediate(resolve)));
	if (originalHost === undefined) delete process.env.CLIPIFY_RTMP_HOST;
	else process.env.CLIPIFY_RTMP_HOST = originalHost;
});

function probe(host: string) {
	return new Promise<string>((resolve, reject) => {
		const socket = createConnection({ host, port: 1935 });
		socket.setTimeout(2000, () => socket.destroy(new Error("Ingest probe timed out")));
		socket.once("error", reject);
		socket.once("connect", () => {
			const nonce = `bind_probe_${randomUUID()}`;
			activateRtmpProbeNonce(nonce);
			socket.write(`CLIPIFY_RTMP_PROBE ${nonce}\n`);
		});
		socket.once("data", (data) => {
			socket.destroy();
			resolve(data.toString());
		});
	});
}

test("default ingest stays on loopback and an explicit wildcard accepts another local interface", async () => {
	const assignedAddress = Object.values(networkInterfaces())
		.flat()
		.find((address) => address?.family === "IPv4" && !address.internal)?.address;
	if (!assignedAddress) throw new Error("The real ingest test requires an assigned non-loopback IPv4 address");
	delete process.env.CLIPIFY_RTMP_HOST;
	await startTCPProxy();
	await expect(probe("127.0.0.1")).resolves.toBe("OK\n");
	await expect(probe(assignedAddress)).rejects.toMatchObject({ code: "ECONNREFUSED" });
	await stopTCPProxy();

	process.env.CLIPIFY_RTMP_HOST = "0.0.0.0";
	await startTCPProxy();
	await expect(probe(assignedAddress)).resolves.toBe("OK\n");
});
