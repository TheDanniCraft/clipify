/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the installed Next CommonJS proxy in a native Node process. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const http = require("node:http");
const { once } = require("node:events");
const { parse } = require("node:url");
const { proxyRequest } = require("next/dist/server/lib/router-utils/proxy-request");

async function listen(server) {
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) {
	server.closeAllConnections();
	await new Promise((resolve) => server.close(resolve));
}
async function scenario(t, mode, budget = 10) {
	let upstreamClosed;
	const closed = new Promise((resolve) => {
		upstreamClosed = resolve;
	});
	const upstream = http.createServer((req, res) => {
		res.on("close", upstreamClosed);
		if (mode === "upstream-error") return req.socket.destroy();
		res.writeHead(200);
		res.write("first");
		if (mode === "success") res.end("last");
	});
	const target = await listen(upstream);
	let response;
	const proxyErrors = [];
	const proxy = http.createServer((req, res) => {
		response = res;
		res.setMaxListeners(budget);
		// Model the two router and two Sentry response lifecycle hooks.
		for (let i = 0; i < 4; i++) res.once("close", () => {});
		proxyRequest(req, res, parse(target)).catch((error) => proxyErrors.push(error));
	});
	const url = await listen(proxy);
	t.after(async () => {
		await close(proxy);
		await close(upstream);
	});
	const result = await new Promise((resolve, reject) => {
		const req = http.get(url, (res) => {
			let body = "";
			res.on("data", (chunk) => {
				body += chunk;
				if (mode === "disconnect") {
					res.destroy();
					resolve({ status: res.statusCode, body });
				}
			});
			res.on("end", () => resolve({ status: res.statusCode, body }));
			res.on("error", reject);
		});
		req.on("error", reject);
	});
	await Promise.race([closed, new Promise((_, reject) => setTimeout(() => reject(Error("upstream remained open")), 2000).unref())]);
	assert.equal(response.getMaxListeners(), budget);
	assert.equal(require("node:events").defaultMaxListeners, 10);
	if (mode === "success") assert.deepEqual(result, { status: 200, body: "firstlast" });
	if (mode === "upstream-error") {
		assert.equal(result.status, 500);
		assert.equal(proxyErrors.length, 1);
	}
}
for (const mode of ["success", "disconnect", "upstream-error"]) {
	test(`real Next proxy ${mode}`, { timeout: 5000 }, (t) => scenario(t, mode));
}
for (const budget of [0, 25]) {
	test(`preserves existing listener budget ${budget}`, { timeout: 5000 }, (t) => scenario(t, "success", budget));
}
