/** @jest-environment node */
import { decodeClipExportSummary } from "@lib/clipExport";
it("normalizes a malformed export header into an invalid-response failure", () => {
	expect(() => decodeClipExportSummary(Buffer.from("not JSON").toString("base64url"), 1)).toThrow("invalid_response");
});

it("retains validated unsuccessful positions for all-failed recovery", async () => {
	const { decodeClipExportError } = await import("@lib/clipExport");
	expect(decodeClipExportError({ code: "PROVIDER_UNAVAILABLE", failures: [{ index: 0, code: "provider_error", retryable: true }] }, 1)).toEqual({ code: "PROVIDER_UNAVAILABLE", failures: [{ index: 0, code: "provider_error", retryable: true }] });
});

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
it.each([1, 25, 50])("validates complete positional summaries of %i selections", (count) => {
	const included = Array.from({ length: count }, (_, index) => index);
	expect(decodeClipExportSummary(encode({ included, skipped: [] }), count)).toEqual({ included, skipped: [] });
});
it.each([null, "?", "x".repeat(16385), encode({ included: [], skipped: [] }), encode({ included: [0, 0], skipped: [] }), encode({ included: [2], skipped: [] }), encode({ included: [0], skipped: [{ index: 0, code: "provider_error", retryable: true }] }), encode({ included: [0], skipped: [], retryAt: "tomorrow" })])("rejects malformed or incomplete summary %#", (value) => {
	expect(() => decodeClipExportSummary(value, 1)).toThrow("invalid_response");
});
it.each([{ code: "" }, { code: "x", failures: [] }, { code: "x", failures: [{ index: 2, code: "provider_error", retryable: true }] }, { code: "x", failures: [{ index: 0, code: "unknown", retryable: true }] }, { code: "x", retryAt: "invalid" }])("rejects invalid error positions %#", async (value) => {
	const { decodeClipExportError } = await import("@lib/clipExport");
	expect(() => decodeClipExportError(value, 1)).toThrow("invalid_response");
});
it("reads an empty response without manufacturing bytes", async () => {
	const { readBoundedResponse } = await import("@lib/clipExport");
	expect(await readBoundedResponse(new Response(null), 10)).toEqual(new Uint8Array());
});
it("joins streamed chunks and releases the reader", async () => {
	const { readBoundedResponse } = await import("@lib/clipExport");
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(new Uint8Array([1, 2]));
			controller.enqueue(new Uint8Array([3]));
			controller.close();
		},
	});
	expect(await readBoundedResponse(new Response(stream), 3)).toEqual(new Uint8Array([1, 2, 3]));
	expect(stream.locked).toBe(false);
});
it("cancels and releases oversized streams", async () => {
	const { readBoundedResponse } = await import("@lib/clipExport");
	const cancel = jest.fn();
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(new Uint8Array(4));
		},
		cancel,
	});
	await expect(readBoundedResponse(new Response(stream), 3)).rejects.toThrow("byte_limit");
	expect(cancel).toHaveBeenCalled();
	expect(stream.locked).toBe(false);
});
it("cancels pending reads when the request is aborted", async () => {
	const { readBoundedResponse } = await import("@lib/clipExport");
	const abort = new AbortController();
	const cancel = jest.fn();
	const stream = new ReadableStream<Uint8Array>({ cancel });
	const read = readBoundedResponse(new Response(stream), 3, abort.signal);
	abort.abort();
	await expect(read).rejects.toThrow();
	expect(cancel).toHaveBeenCalled();
	expect(stream.locked).toBe(false);
});
it("keeps Unicode clip titles readable in partial export details", () => {
	const value = { included: [0], skipped: [{ index: 1, code: "render_failed", retryable: true, title: "Überraschung 世界 🎉" }] };
	expect(decodeClipExportSummary(encode(value), 2)).toEqual(value);
});
