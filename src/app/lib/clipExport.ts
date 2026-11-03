import { z } from "zod";

export async function readBoundedResponse(response: Pick<Response, "body">, maxBytes: number, signal?: AbortSignal) {
	const reader = response.body?.getReader();
	if (!reader) return new Uint8Array();
	const chunks: Uint8Array[] = [];
	let length = 0;
	const abort = () => void reader.cancel();
	signal?.addEventListener("abort", abort, { once: true });
	try {
		while (true) {
			signal?.throwIfAborted();
			const { value, done } = await reader.read();
			signal?.throwIfAborted();
			if (done) break;
			length += value.byteLength;
			if (length > maxBytes) {
				await reader.cancel();
				throw new Error("byte_limit");
			}
			chunks.push(value);
		}
		const bytes = new Uint8Array(length);
		let offset = 0;
		for (const chunk of chunks) {
			bytes.set(chunk, offset);
			offset += chunk.byteLength;
		}
		return bytes;
	} finally {
		signal?.removeEventListener("abort", abort);
		reader.releaseLock();
	}
}

const summarySchema = z.object({ included: z.array(z.number().int().nonnegative()).max(50), skipped: z.array(z.object({ index: z.number().int().nonnegative(), code: z.enum(["clip_unavailable", "download_unavailable", "file_size_limit", "package_size_limit", "invalid_media", "provider_error", "download_timeout", "rate_limited", "reconnect_required"]), retryable: z.boolean() })).max(50), retryAt: z.string().datetime().optional() });
export type ClipExportSummary = z.infer<typeof summarySchema>;
export function decodeClipExportSummary(encoded: string | null, count: number) {
	try {
		if (!encoded || encoded.length > 16384 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("invalid_response");
		const summary = summarySchema.parse(JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))));
		const indices = [...summary.included, ...summary.skipped.map((item) => item.index)];
		if (!summary.included.length || indices.length !== count || new Set(indices).size !== count || indices.some((index) => index >= count)) throw new Error("invalid_response");
		return summary;
	} catch {
		throw new Error("invalid_response");
	}
}

export function decodeClipExportError(value: unknown, count: number) {
	try {
		const parsed = z.object({ code: z.string().min(1).max(100), retryAt: summarySchema.shape.retryAt, failures: summarySchema.shape.skipped.optional() }).parse(value);
		if (parsed.failures) {
			const indices = parsed.failures.map((item) => item.index);
			if (indices.length !== count || new Set(indices).size !== count || indices.some((index) => index >= count)) throw new Error("invalid_response");
		}
		return parsed;
	} catch {
		throw new Error("invalid_response");
	}
}
