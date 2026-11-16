import "server-only";
import { trackServerProductEvent } from "@/server/umami";
import { toolPermissions } from "./permissions";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
const resultStates = new Set(["items_returned", "empty_page", "no_overlays", "no_playlists", "not_started", "queued", "running", "partial", "retrying", "rate_limited", "empty_collection", "no_matching_clips", "status_unavailable"]);
export function safeResultState(value?: string) {
	return value && resultStates.has(value) ? value : undefined;
}
const reasons = new Set(["INVALID_INPUT", "ACCESS_DENIED", "RESOURCE_UNAVAILABLE", "FEATURE_RESTRICTED", "PLAN_LIMIT_REACHED", "CONFLICT", "RETRY_CONFLICT", "RATE_LIMITED", "SERVICE_UNAVAILABLE", "MISSING_SCOPE"]);
function emit(principal: TrustedCreatorPrincipal, name: string, data: Parameters<typeof trackServerProductEvent>[2]) {
	try {
		trackServerProductEvent(principal.authUserId, name, data);
	} catch {
		/* Optional measurement cannot fail a connection or tool. */
	}
}
/** Optional measurement uses the existing authoritative statistics-consent gate. No payloads, OAuth codes, URLs or resource identifiers. */
export function trackMcpToolResult(principal: TrustedCreatorPrincipal, input: { tool?: string; outcome: string; reason?: string; resultState?: string }) {
	if (!input.tool || !Object.hasOwn(toolPermissions, input.tool)) return;
	emit(principal, "mcp_tool_result", { channel: "ai", client: principal.clientId === "https://chatgpt.com/oauth/client.json" ? "chatgpt" : "other", tool: input.tool, outcome: input.outcome, reason: input.reason && reasons.has(input.reason) ? input.reason : undefined, result_state: safeResultState(input.resultState) });
}
/** This means a bearer token and grant were accepted, not that initialization or a user task succeeded. */
export function trackMcpAuthenticatedRequest(principal: TrustedCreatorPrincipal, method: unknown) {
	if (method !== "initialize" && method !== "tools/list") return;
	emit(principal, "mcp_authenticated_request", { channel: "ai", client: principal.clientId === "https://chatgpt.com/oauth/client.json" ? "chatgpt" : "other", stage: method === "initialize" ? "initialize" : "tools_list" });
}
