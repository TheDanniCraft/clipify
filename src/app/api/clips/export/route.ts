import { buildClipArchive, readBoundedResponse } from "@/server/clip-export";
import { EXPORT_STREAM_TYPE } from "@lib/clipExportStream";
export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
	const requestUrl = new URL(request.url);
	let expectedOrigin: string;
	try {
		const forwardedProtocol = request.headers.get("x-forwarded-proto");
		const protocol = forwardedProtocol === "https" || forwardedProtocol === "http" ? `${forwardedProtocol}:` : requestUrl.protocol;
		expectedOrigin = new URL(`${protocol}//${request.headers.get("host") ?? requestUrl.host}`).origin;
	} catch {
		return Response.json({ ok: false, code: "PERMISSION_DENIED" }, { status: 403, headers: privateHeaders });
	}
	if (request.headers.get("origin") !== expectedOrigin) return Response.json({ ok: false, code: "PERMISSION_DENIED" }, { status: 403, headers: privateHeaders });
	if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ ok: false, code: "INVALID_INPUT" }, { status: 400, headers: privateHeaders });
	if (Number(request.headers.get("content-length")) > 65536) return Response.json({ ok: false, code: "EXPORT_LIMIT" }, { status: 413, headers: privateHeaders });
	let input: unknown;
	try {
		input = JSON.parse(new TextDecoder().decode(await readBoundedResponse(request, 65536, request.signal)));
	} catch (error) {
		return Response.json({ ok: false, code: error instanceof Error && error.message === "byte_limit" ? "EXPORT_LIMIT" : "INVALID_INPUT" }, { status: error instanceof Error && error.message === "byte_limit" ? 413 : 400, headers: privateHeaders });
	}
	try {
		const format = requestUrl.searchParams.get("format") ?? "zip";
		if (format !== "zip" && format !== "mp4") return Response.json({ ok: false, code: "INVALID_INPUT" }, { status: 400, headers: privateHeaders });
		if (requestUrl.searchParams.get("progress") === "1") {
			const abort = new AbortController();
			const signal = AbortSignal.any([request.signal, abort.signal]);
			const body = new ReadableStream<Uint8Array>({
				start(controller) {
					const emit = (event: unknown) => {
						if (!signal.aborted) controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
					};
					void (async () => {
						try {
							const result = await buildClipArchive(input, signal, format, (event) => emit({ type: "clip", ...event }));
							if (!result.ok) {
								emit({ type: "error", ...result });
								return;
							}
							const summary = Buffer.from(JSON.stringify(result.summary)).toString("base64url");
							if (summary.length > 16384) {
								emit({ type: "error", code: "EXPORT_LIMIT" });
								return;
							}
							emit({ type: "file", bytes: result.bytes.length, summary });
							if (!signal.aborted) controller.enqueue(new Uint8Array(result.bytes));
						} catch {
							emit({ type: "error", code: "SERVICE_UNAVAILABLE" });
						} finally {
							if (!signal.aborted) controller.close();
						}
					})();
				},
				cancel() {
					abort.abort();
				},
			});
			return new Response(body, { headers: { ...privateHeaders, "Content-Type": EXPORT_STREAM_TYPE, "X-Accel-Buffering": "no" } });
		}
		const result = await buildClipArchive(input, request.signal, format);
		const headers = new Headers(privateHeaders);
		const retryAt = result.ok ? result.summary.retryAt : result.retryAt;
		if (retryAt) headers.set("Retry-After", String(Math.max(1, Math.ceil((Date.parse(retryAt) - Date.now()) / 1000))));
		if (!result.ok) return Response.json(result, { status: result.status, headers });
		const summary = Buffer.from(JSON.stringify(result.summary)).toString("base64url");
		if (summary.length > 16384) return Response.json({ ok: false, code: "EXPORT_LIMIT" }, { status: 413, headers });
		headers.set("Content-Type", format === "mp4" ? "video/mp4" : "application/zip");
		headers.set("Content-Disposition", format === "mp4" ? `attachment; filename="clipify-clip.mp4"; filename*=UTF-8''${encodeURIComponent(result.filename ?? "clipify-clip.mp4")}` : `attachment; filename="clipify-clips-${new Date().toISOString().slice(0, 10)}.zip"`);
		headers.set("X-Clipify-Export-Result", summary);
		return new Response(new Uint8Array(result.bytes), { status: 200, headers });
	} catch {
		return Response.json({ ok: false, code: "SERVICE_UNAVAILABLE" }, { status: 503, headers: privateHeaders });
	}
}
