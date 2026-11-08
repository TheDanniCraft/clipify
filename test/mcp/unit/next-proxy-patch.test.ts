/** @jest-environment node */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { parse } from "node:url";
import { proxyRequest } from "next/dist/server/lib/router-utils/proxy-request";

test("the installed Next proxy forwards caller context without requesting compressed upstream data", async () => {
	const upstream = createServer((request, response) => {
		response.setHeader("content-type", "application/json");
		response.end(JSON.stringify({ encoding: request.headers["accept-encoding"] ?? null, host: request.headers["x-forwarded-host"], caller: request.headers["x-forwarded-for"] }));
	});
	await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
	const target = upstream.address() as AddressInfo;
	const proxy = createServer((request, response) => {
		void proxyRequest(request, response, parse(`http://127.0.0.1:${target.port}/`, true), undefined, undefined, 5000).catch((error: Error) => response.destroy(error));
	});
	try {
		await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
		const address = proxy.address() as AddressInfo;
		const response = await fetch(`http://127.0.0.1:${address.port}`, { headers: { "accept-encoding": "gzip" } });
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ encoding: null, host: `127.0.0.1:${address.port}`, caller: "127.0.0.1" });
	} finally {
		for (const server of [proxy, upstream]) {
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	}
});
