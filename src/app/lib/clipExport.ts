import { z } from "zod";
import { strToU8 } from "fflate";

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

const summarySchema = z.object({
	included: z.array(z.number().int().nonnegative()).max(50),
	skipped: z.array(z.object({ index: z.number().int().nonnegative(), code: z.enum(["clip_unavailable", "download_unavailable", "file_size_limit", "package_size_limit", "invalid_media", "provider_error", "download_timeout", "rate_limited", "reconnect_required", "render_busy", "render_failed", "font_unavailable", "browser_unsupported"]), retryable: z.boolean(), title: z.string().max(1000).optional() })).max(50),
	retryAt: z.string().datetime().optional(),
});
export type ClipExportSummary = z.infer<typeof summarySchema>;
export function decodeClipExportSummary(encoded: string | null, count: number) {
	try {
		if (!encoded || encoded.length > 16384 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("invalid_response");
		const summary = summarySchema.parse(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0)))));
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

// Older Twitch clips use this exact CloudFront distribution; other tenants remain blocked.
export function isTrustedClipMediaUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === "https:" && ["production.assets.clips.twitchcdn.net", "d1ndex63qxojbr.cloudfront.net"].includes(url.hostname) && !url.username && !url.password && !url.port;
	} catch {
		return false;
	}
}

export function clipExportFilename(title: string, id: string, index: number, used: Set<string>) {
	const clean = (value: string) => {
		const characters = Array.from(
			value
				.normalize("NFKC")
				.replace(/[^\p{L}\p{N} _-]/gu, "_")
				.trim(),
		).slice(0, 80);
		while (strToU8(characters.join("")).length > 80) characters.pop();
		return characters.join("") || "clip";
	};
	let base = clean(title);
	if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:[ ._]|$)/i.test(base)) base = `clip_${base}`;
	const stem = `${base}--${clean(id)}`;
	let filename = `${stem}.mp4`;
	let suffix = index + 1;
	while (used.has(filename)) filename = `${stem}--${suffix++}.mp4`;
	used.add(filename);
	return filename;
}

export function isRetryableClipExportFailure(code: string) {
	return ["provider_error", "download_timeout", "rate_limited", "render_busy", "render_failed", "font_unavailable", "browser_unsupported"].includes(code);
}

export function clipExportFailureCode(failures: readonly { code: string }[]) {
	if (failures.some((item) => ["file_size_limit", "package_size_limit"].includes(item.code))) return "EXPORT_LIMIT";
	if (failures.some((item) => item.code === "reconnect_required")) return "RECONNECT_REQUIRED";
	if (failures.some((item) => item.code === "rate_limited")) return "RATE_LIMITED";
	if (failures.some((item) => item.code === "browser_unsupported")) return "BROWSER_UNSUPPORTED";
	if (failures.some((item) => item.code === "provider_error")) return "PROVIDER_UNAVAILABLE";
	if (failures.some((item) => item.code === "download_timeout")) return "EXPORT_TIMEOUT";
	return "EXPORT_UNAVAILABLE";
}
