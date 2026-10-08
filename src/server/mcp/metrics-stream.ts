import "server-only";
import type { McpCallOutcome } from "./metrics";
export type McpMeasuredOutcome = { outcome: McpCallOutcome; reason?: string };
/** Only fixed outcome/reason codes survive; bounded transient decoding handles SDK SSE errors. */
function protocolOutcome(wire: string): McpMeasuredOutcome | undefined {
	const messages =
		wire.startsWith("data:") || wire.includes("\ndata:")
			? wire
					.split("\n")
					.filter((line) => line.startsWith("data:"))
					.map((line) => line.slice(5).trim())
			: [wire];
	for (const message of messages) {
		try {
			const body = JSON.parse(message);
			if (body.error) return { outcome: body.error.code === -32603 ? "error" : "denied", reason: body.error.code === -32603 ? "SERVICE_UNAVAILABLE" : "INVALID_INPUT" };
			if (body.result?.isError) {
				const reason = body.result.structuredContent?.error?.code;
				return { outcome: reason === "SERVICE_UNAVAILABLE" ? "error" : "denied", reason: typeof reason === "string" ? reason : "other" };
			}
		} catch {
			continue;
		}
	}
	return undefined;
}
/** Observing response consumption preserves streaming and prevents premature success. */
export function observeMcpResponse(response: Response, complete: (outcome?: McpMeasuredOutcome) => void): Response {
	if (!response.body) {
		complete();
		return response;
	}
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let wire = "";
	let done = false;
	function finish(outcome?: McpMeasuredOutcome) {
		if (!done) {
			done = true;
			complete(outcome);
			wire = "";
		}
	}
	const body = new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const next = await reader.read();
				if (next.done) {
					finish(protocolOutcome(wire));
					controller.close();
					reader.releaseLock();
					return;
				}
				if (wire.length < 65536) wire += decoder.decode(next.value, { stream: true }).slice(0, 65536 - wire.length);
				controller.enqueue(next.value);
			} catch (error) {
				finish({ outcome: "error", reason: "SERVICE_UNAVAILABLE" });
				controller.error(error);
				reader.releaseLock();
			}
		},
		async cancel(reason) {
			finish({ outcome: "cancelled", reason: "CANCELLED" });
			try {
				await reader.cancel(reason);
			} finally {
				reader.releaseLock();
			}
		},
	});
	return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}
