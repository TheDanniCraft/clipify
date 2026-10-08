import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { getMcpMetricsStore, type McpCallOutcome } from "./metrics";
import { observeMcpResponse, type McpMeasuredOutcome } from "./metrics-stream";
type Outcome = McpMeasuredOutcome;
const context = new AsyncLocalStorage<{ result?: Outcome }>();
/** Records the application outcome without completing a second observation. */
export function reportMcpToolOutcome(outcome: McpCallOutcome, reason?: string) {
	const current = context.getStore();
	if (current) current.result = { outcome, reason };
}
function responseOutcome(response: Response): Outcome {
	if (response.status === 429) return { outcome: "denied", reason: "RATE_LIMITED" };
	if (response.status === 401) return { outcome: "denied", reason: "AUTHENTICATION_REQUIRED" };
	if (response.status === 403) return { outcome: "denied", reason: response.headers.get("www-authenticate")?.includes("insufficient_scope") ? "MISSING_SCOPE" : "ACCESS_DENIED" };
	if (response.status >= 500) return { outcome: "error", reason: "SERVICE_UNAVAILABLE" };
	if (response.status >= 400) return { outcome: "denied", reason: "INVALID_INPUT" };
	return { outcome: "success" };
}
export async function trackMcpRequest(request: Request, run: () => Promise<Response>): Promise<Response> {
	let status = 500;
	try {
		const response = await run();
		status = response.status;
		return response;
	} finally {
		getMcpMetricsStore().recordRequest(request.method, status);
	}
}
export async function trackMcpDispatch(request: Request, body: unknown, run: () => Promise<Response>): Promise<Response> {
	const message = body && typeof body === "object" ? (body as { method?: unknown; params?: { name?: unknown } }) : {};
	const metrics = getMcpMetricsStore();
	if (message.method !== "tools/call") {
		if (message.method !== undefined) metrics.recordOperation(message.method);
		return run();
	}
	const finish = metrics.startCall(message.params?.name),
		current: { result?: Outcome } = {};
	return context.run(current, async () => {
		const complete = (wire?: Outcome) => {
			const result = request.signal.aborted ? { outcome: "cancelled" as const, reason: "CANCELLED" } : (wire ?? current.result ?? { outcome: "success" as const });
			finish(result.outcome, result.reason);
		};
		try {
			const response = await run();
			if (response.status >= 400) {
				const result = responseOutcome(response);
				finish(result.outcome, result.reason);
				return response;
			}
			return observeMcpResponse(response, complete);
		} catch (error) {
			finish(request.signal.aborted ? "cancelled" : "error", request.signal.aborted ? "CANCELLED" : "SERVICE_UNAVAILABLE");
			throw error;
		}
	});
}
