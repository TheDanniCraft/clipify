import { z } from "zod";
import { decodeClipExportError, decodeClipExportSummary, readBoundedResponse } from "./clipExport";
export const EXPORT_STREAM_TYPE = "application/vnd.clipify.export-stream";
const progressSchema = z.object({ index: z.number().int().nonnegative(), stage: z.enum(["queued", "processing", "rendering", "ready", "skipped"]), title: z.string().max(1000).optional(), code: z.string().max(100).optional() });
export type ClipExportProgress = z.infer<typeof progressSchema>;
export async function readClipExportResponse(response: Response, count: number, format: "zip" | "mp4", signal: AbortSignal, progress: (event: ClipExportProgress) => void) {
	if (!response.ok) return { ok: false as const, ...decodeClipExportError(JSON.parse(new TextDecoder().decode(await readBoundedResponse(response, 65536, signal))), count) };
	let summary: ReturnType<typeof decodeClipExportSummary>, bytes: Uint8Array<ArrayBuffer>;
	if (response.headers.get("content-type")?.startsWith(EXPORT_STREAM_TYPE)) {
		const reader = response.body?.getReader();
		if (!reader) throw new Error("invalid_response");
		let chunk = new Uint8Array(),
			offset = 0;
		const line = async () => {
			const parts: Uint8Array[] = [];
			let size = 0;
			while (true) {
				signal.throwIfAborted();
				if (offset === chunk.length) {
					const next = await reader.read();
					if (next.done) throw new Error("invalid_response");
					chunk = next.value;
					offset = 0;
				}
				const end = chunk.indexOf(10, offset),
					stop = end < 0 ? chunk.length : end;
				const part = chunk.subarray(offset, stop);
				size += part.length;
				if (size > 65536) throw new Error("invalid_response");
				parts.push(part);
				offset = stop + (end < 0 ? 0 : 1);
				if (end >= 0) {
					const bytes = new Uint8Array(size);
					let pos = 0;
					for (const part of parts) {
						bytes.set(part, pos);
						pos += part.length;
					}
					return JSON.parse(new TextDecoder().decode(bytes));
				}
			}
		};
		const abort = () => void reader.cancel().catch(() => {});
		signal.addEventListener("abort", abort, { once: true });
		try {
			let file: { bytes: number; summary: string } | undefined;
			for (let events = 0; events < 401; events++) {
				const event = await line();
				if (event.type === "error") return { ok: false as const, ...decodeClipExportError(event, count) };
				if (event.type === "file") {
					file = z
						.object({
							bytes: z
								.number()
								.int()
								.min(8)
								.max((format === "mp4" ? 32 : 130) * 1024 * 1024),
							summary: z.string().max(16384),
						})
						.parse(event);
					break;
				}
				if (event.type !== "clip") throw new Error("invalid_response");
				const item = progressSchema.parse(event);
				if (item.index >= count) throw new Error("invalid_response");
				progress(item);
			}
			if (!file) throw new Error("invalid_response");
			summary = decodeClipExportSummary(file.summary, count);
			const remainder = chunk.subarray(offset);
			let first = true;
			const body = new ReadableStream<Uint8Array>({
				async pull(controller) {
					if (first) {
						first = false;
						if (remainder.length) {
							controller.enqueue(remainder);
							return;
						}
					}
					const next = await reader.read();
					if (next.done) controller.close();
					else controller.enqueue(next.value);
				},
				cancel: () => reader.cancel(),
			});
			bytes = await readBoundedResponse(new Response(body), file.bytes, signal);
			if (bytes.length !== file.bytes) throw new Error("invalid_response");
		} finally {
			signal.removeEventListener("abort", abort);
			await reader.cancel().catch(() => {});
			reader.releaseLock();
		}
	} else {
		if (!response.headers.get("content-type")?.startsWith(format === "mp4" ? "video/mp4" : "application/zip")) throw new Error("invalid_response");
		summary = decodeClipExportSummary(response.headers.get("X-Clipify-Export-Result"), count);
		bytes = await readBoundedResponse(response, (format === "mp4" ? 32 : 130) * 1024 * 1024, signal);
	}
	const archive = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (format === "mp4" ? bytes.length < 8 || archive.getUint32(4) !== 0x66747970 : bytes.length < 22 || archive.getUint32(0) !== 0x504b0304 || archive.getUint32(bytes.length - 22) !== 0x504b0506) throw new Error("invalid_response");
	return { ok: true as const, summary, bytes };
}
