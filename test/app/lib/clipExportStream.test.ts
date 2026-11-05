/** @jest-environment node */
import { readClipExportResponse, EXPORT_STREAM_TYPE } from "@lib/clipExportStream";
import { zipSync, strToU8 } from "fflate";
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value) + "\n");
const summary = Buffer.from(JSON.stringify({ included: [0], skipped: [] })).toString("base64url");
const media = zipSync({ "manifest.json": strToU8("{}") });
function response(parts: Uint8Array[]) {
	return new Response(
		new ReadableStream({
			start(controller) {
				for (const part of parts) controller.enqueue(part);
				controller.close();
			},
		}),
		{ headers: { "content-type": EXPORT_STREAM_TYPE } },
	);
}
it("reads progress split across transport chunks and validates the exact binary file", async () => {
	const event = encode({ type: "clip", index: 0, stage: "processing", title: "Clip title" }),
		header = encode({ type: "file", bytes: media.length, summary }),
		progress = jest.fn();
	const result = await readClipExportResponse(response([event.subarray(0, 2), event.subarray(2), header, media.subarray(0, 1), media.subarray(1)]), 1, "zip", new AbortController().signal, progress);
	expect(result.ok).toBe(true);
	expect(progress).toHaveBeenCalledWith({ index: 0, stage: "processing", title: "Clip title" });
	if (result.ok) expect(result.bytes).toEqual(media);
});
it.each(
	[
		[encode({ type: "clip", index: 1, stage: "processing" })],
		[encode({ type: "clip", index: 0, stage: "invented" })],
		[encode({ type: "other" })],
		[new Uint8Array(65537)],
		[encode({ type: "file", bytes: media.length + 1, summary }), media],
		[encode({ type: "file", bytes: media.length - 1, summary }), media],
		[encode({ type: "file", bytes: media.length, summary: "bad" }), media],
		[encode({ type: "file", bytes: media.length, summary }), new Uint8Array(media.length)],
		[new TextEncoder().encode("unfinished")],
		Array.from({ length: 401 }, () => encode({ type: "clip", index: 0, stage: "queued" })),
	].map((parts) => ({ parts })),
)("rejects malformed, oversized or truncated progress transport %#", async ({ parts }) => {
	await expect(readClipExportResponse(response(parts), 1, "zip", new AbortController().signal, () => {})).rejects.toThrow();
});
it("keeps typed failures inside the private progress response", async () => {
	const result = await readClipExportResponse(response([encode({ type: "error", code: "RECONNECT_REQUIRED" })]), 1, "zip", new AbortController().signal, () => {});
	expect(result).toEqual({ ok: false, code: "RECONNECT_REQUIRED" });
});
it("cancels transport when the user cancels the batch", async () => {
	const abort = new AbortController();
	const stream = response([encode({ type: "clip", index: 0, stage: "queued" })]);
	abort.abort();
	await expect(readClipExportResponse(stream, 1, "zip", abort.signal, () => {})).rejects.toThrow();
});
it("reads a portrait file that shares a transport chunk with its header", async () => {
	const portrait = new Uint8Array([0, 0, 0, 8, 102, 116, 121, 112]);
	const header = encode({ type: "file", bytes: portrait.length, summary });
	const combined = new Uint8Array(header.length + portrait.length);
	combined.set(header);
	combined.set(portrait, header.length);
	const result = await readClipExportResponse(response([combined]), 1, "mp4", new AbortController().signal, () => {});
	expect(result.ok).toBe(true);
	if (result.ok) expect(result.bytes).toEqual(portrait);
});
it("rejects a missing body and invalid portrait bytes", async () => {
	await expect(readClipExportResponse(new Response(null, { headers: { "content-type": EXPORT_STREAM_TYPE } }), 1, "zip", new AbortController().signal, () => {})).rejects.toThrow("invalid_response");
	await expect(readClipExportResponse(response([encode({ type: "file", bytes: 8, summary }), new Uint8Array(8)]), 1, "mp4", new AbortController().signal, () => {})).rejects.toThrow("invalid_response");
});
it("aborts a pending network read and cancels its stream", async () => {
	const abort = new AbortController(),
		cancel = jest.fn();
	const pending = new Response(new ReadableStream({ cancel }), { headers: { "content-type": EXPORT_STREAM_TYPE } });
	const result = readClipExportResponse(pending, 1, "zip", abort.signal, () => {});
	abort.abort();
	await expect(result).rejects.toThrow();
	expect(cancel).toHaveBeenCalledTimes(1);
});
it("cancels a transfer after its file header has arrived", async () => {
	const abort = new AbortController(),
		cancel = jest.fn();
	const pending = new Response(
		new ReadableStream({
			start(controller) {
				controller.enqueue(encode({ type: "file", bytes: media.length, summary }));
			},
			cancel,
		}),
		{ headers: { "content-type": EXPORT_STREAM_TYPE } },
	);
	const result = readClipExportResponse(pending, 1, "zip", abort.signal, () => {});
	const rejection = expect(result).rejects.toThrow();
	await new Promise(setImmediate);
	abort.abort();
	await rejection;
	expect(cancel).toHaveBeenCalledTimes(1);
});
it("keeps the original transfer error when transport cancellation itself rejects", async () => {
	const reader = { read: jest.fn().mockResolvedValue({ done: false, value: encode({ type: "error", code: "RECONNECT_REQUIRED" }) }), cancel: jest.fn().mockRejectedValue(Error("cancel unavailable")), releaseLock: jest.fn() };
	const stream = { ok: true, headers: new Headers({ "content-type": EXPORT_STREAM_TYPE }), body: { getReader: () => reader } } as unknown as Response;
	const controller = new AbortController();
	reader.read.mockImplementationOnce(async () => {
		controller.abort();
		return { done: false, value: encode({ type: "error", code: "RECONNECT_REQUIRED" }) };
	});
	await expect(readClipExportResponse(stream, 1, "zip", controller.signal, () => {})).resolves.toMatchObject({ ok: false, code: "RECONNECT_REQUIRED" });
	expect(reader.cancel).toHaveBeenCalledTimes(2);
	expect(reader.releaseLock).toHaveBeenCalled();
});
