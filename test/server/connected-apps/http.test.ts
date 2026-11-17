/** @jest-environment node */
import { readConnectedAppJson } from "@/server/connected-apps/http";
it("refuses a different media type that merely starts with application/json", async () => {
	const request = new Request("https://clipify.test/api/connected-apps", { method: "POST", headers: { "Content-Type": "application/jsonp" }, body: "{}" });
	await expect(readConnectedAppJson(request)).rejects.toMatchObject({ code: "INVALID_INPUT", status: 400 });
});
it("expires an incomplete body and cancels its reader", async () => {
	jest.useFakeTimers();
	const cancelled = jest.fn();
	try {
		const request = new Request("https://clipify.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: new ReadableStream({ start() {}, cancel: cancelled }), duplex: "half" } as RequestInit);
		const failure = expect(readConnectedAppJson(request)).rejects.toMatchObject({ code: "INVALID_INPUT", status: 400 });
		await jest.advanceTimersByTimeAsync(10000);
		await failure;
		expect(cancelled).toHaveBeenCalled();
	} finally {
		jest.useRealTimers();
	}
});
it("cancels an active upload when its caller disconnects", async () => {
	const abort = new AbortController();
	const cancelled = jest.fn();
	const request = new Request("https://clipify.test", { method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal, body: new ReadableStream({ start() {}, cancel: cancelled }), duplex: "half" } as RequestInit);
	const failure = expect(readConnectedAppJson(request)).rejects.toMatchObject({ code: "INVALID_INPUT" });
	abort.abort();
	await failure;
	expect(cancelled).toHaveBeenCalled();
});
it("rejects a failed stream and declared oversized body without leaking errors", async () => {
	const headers = { "Content-Type": "application/json" };
	const request = new Request("https://clipify.test", {
		method: "POST",
		headers,
		body: new ReadableStream({
			start(controller) {
				controller.error(new Error("private-internal"));
			},
		}),
		duplex: "half",
	} as RequestInit);
	await expect(readConnectedAppJson(request)).rejects.toMatchObject({ code: "INVALID_INPUT", message: "INVALID_INPUT" });
	await expect(readConnectedAppJson(new Request("https://clipify.test", { method: "POST", headers: { ...headers, "Content-Length": "8193" }, body: "{}" }))).rejects.toMatchObject({ code: "REQUEST_TOO_LARGE", status: 413 });
});
it.each([8192, 8193])("enforces the actual byte limit at %i bytes", async (bytes) => {
	const body = '"' + "x".repeat(bytes - 2) + '"';
	const request = new Request("https://clipify.test", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body });
	if (bytes === 8192) await expect(readConnectedAppJson(request)).resolves.toHaveLength(8190);
	else await expect(readConnectedAppJson(request)).rejects.toMatchObject({ code: "REQUEST_TOO_LARGE", status: 413 });
});
it.each(["abort", "oversize"])("preserves the safe %s error if stream cancellation itself fails", async (reason) => {
	const abort = new AbortController();
	const request = new Request("https://clipify.test", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		signal: abort.signal,
		body: new ReadableStream({
			start(controller) {
				if (reason === "oversize") controller.enqueue(new Uint8Array(8193));
			},
			cancel() {
				return Promise.reject(new Error("private-cancellation-error"));
			},
		}),
		duplex: "half",
	} as RequestInit);
	const failure = expect(readConnectedAppJson(request)).rejects.toMatchObject({ code: reason === "abort" ? "INVALID_INPUT" : "REQUEST_TOO_LARGE" });
	if (reason === "abort") abort.abort();
	await failure;
});
