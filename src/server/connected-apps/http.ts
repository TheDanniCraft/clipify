import { ConnectedAppError } from "./grants";
export async function readConnectedAppJson(request: Request): Promise<unknown> {
	if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new ConnectedAppError("INVALID_INPUT", 400);
	if (Number(request.headers.get("content-length")) > 8192) throw new ConnectedAppError("REQUEST_TOO_LARGE", 413);
	if (!request.body || request.signal.aborted) throw new ConnectedAppError("INVALID_INPUT", 400);
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	let fail!: (error: Error) => void;
	const interrupted = new Promise<never>((_, reject) => {
		fail = reject;
	});
	const stop = () => {
		fail(new ConnectedAppError("INVALID_INPUT", 400));
		void reader.cancel().catch(() => {});
	};
	const timer = setTimeout(stop, 10000);
	request.signal.addEventListener("abort", stop, { once: true });
	try {
		while (true) {
			const next = await Promise.race([reader.read(), interrupted]);
			if (next.done) break;
			size += next.value.byteLength;
			if (size > 8192) {
				void reader.cancel().catch(() => {});
				throw new ConnectedAppError("REQUEST_TOO_LARGE", 413);
			}
			chunks.push(next.value);
		}
		return JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
	} catch (error) {
		if (error instanceof ConnectedAppError) throw error;
		throw new ConnectedAppError("INVALID_INPUT", 400);
	} finally {
		clearTimeout(timer);
		request.signal.removeEventListener("abort", stop);
		reader.releaseLock();
	}
}
export function connectedAppFailure(error: unknown): Response {
	const failure = error instanceof ConnectedAppError ? error : new ConnectedAppError("SERVICE_UNAVAILABLE", 503);
	return Response.json({ ok: false, error: { code: failure.code } }, { status: failure.status, headers: { "Cache-Control": "no-store", ...(failure.status === 429 ? { "Retry-After": "60" } : {}) } });
}
