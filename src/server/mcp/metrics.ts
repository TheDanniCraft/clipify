import "server-only";
import { randomUUID } from "node:crypto";
import { toolPermissions } from "./permissions";

export const MCP_DURATION_BOUNDS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60] as const;
const REASONS = ["INVALID_INPUT", "ACCESS_DENIED", "RESOURCE_UNAVAILABLE", "FEATURE_RESTRICTED", "PLAN_LIMIT_REACHED", "CONFLICT", "RETRY_CONFLICT", "RATE_LIMITED", "SERVICE_UNAVAILABLE", "MISSING_SCOPE", "AUTHENTICATION_REQUIRED", "CANCELLED", "other"] as const;
export type McpCallOutcome = "success" | "denied" | "error" | "cancelled";
type Category = "read" | "write" | "destructive" | "unknown";
const categoryFor = (name: string): Category => {
	if (!Object.hasOwn(toolPermissions, name)) return "unknown";
	const permission = toolPermissions[name as keyof typeof toolPermissions];
	if (permission.endsWith(":read")) return "read";
	return permission.endsWith(":delete") || permission.endsWith(":rotate") ? "destructive" : "write";
};
const emptyCounts = () => ({ started_total: 0, completed_total: 0, success_total: 0, denied_total: 0, error_total: 0, cancelled_total: 0 });
const bucketKey = (bound: number) => `le_${String(bound).replace(".", "_")}_total`;
const emptyDuration = () => ({ count: 0, seconds_sum: 0, buckets: Object.fromEntries([...MCP_DURATION_BOUNDS.map((bound) => [bucketKey(bound), 0]), ["le_inf_total", 0]]) as Record<string, number> });
const emptyTool = () => ({ ...emptyCounts(), duration: emptyDuration(), lastUsedAt: null as string | null });
const OPERATION_KEYS: Record<string, string> = { "tools/list": "tools_list_total", "prompts/list": "prompts_list_total", "prompts/get": "prompts_get_total", initialize: "initialize_total" };

/** Fixed catalogues only; no identities, payloads or arbitrary labels enter telemetry. */
export function createMcpMetricsStore(options: { now?: () => number; startedAt?: string; instanceId?: string } = {}) {
	const now = options.now ?? (() => performance.now());
	const state = {
		processInstanceId: options.instanceId ?? randomUUID(),
		processStartedAt: options.startedAt ?? new Date(Date.now() - process.uptime() * 1000).toISOString(),
		sampledAt: "",
		calls: { ...emptyCounts(), inFlight: 0 },
		requests: { total: 0, GET_total: 0, POST_total: 0, DELETE_total: 0, OPTIONS_total: 0, other_total: 0, status_2xx_total: 0, status_3xx_total: 0, status_4xx_total: 0, status_5xx_total: 0, other_status_total: 0 },
		operations: { initialize_total: 0, tools_list_total: 0, prompts_list_total: 0, prompts_get_total: 0, other_total: 0 } as Record<string, number>,
		reasons: Object.fromEntries(REASONS.map((reason) => [reason + "_total", 0])) as Record<string, number>,
		categories: { read: emptyCounts(), write: emptyCounts(), destructive: emptyCounts(), unknown: emptyCounts() },
		duration: emptyDuration(),
		tools: Object.fromEntries([...Object.keys(toolPermissions), "unknown"].map((name) => [name, emptyTool()])) as Record<string, ReturnType<typeof emptyTool>>,
	};
	function observe(duration: ReturnType<typeof emptyDuration>, seconds: number) {
		duration.count++;
		duration.seconds_sum += seconds;
		for (const bound of MCP_DURATION_BOUNDS) if (seconds <= bound) duration.buckets[bucketKey(bound)]++;
		duration.buckets.le_inf_total++;
	}
	return {
		startCall(rawName: unknown) {
			const name = typeof rawName === "string" && Object.hasOwn(toolPermissions, rawName) ? rawName : "unknown";
			const tool = state.tools[name],
				category = state.categories[categoryFor(name)],
				started = now();
			let finished = false;
			state.calls.started_total++;
			state.calls.inFlight++;
			tool.started_total++;
			category.started_total++;
			tool.lastUsedAt = new Date().toISOString();
			return (outcome: McpCallOutcome, reason?: string) => {
				if (finished) return;
				finished = true;
				state.calls.inFlight--;
				for (const counts of [state.calls, tool, category]) {
					counts.completed_total++;
					counts[`${outcome}_total`]++;
				}
				if (reason) {
					const key = REASONS.includes(reason as (typeof REASONS)[number]) ? reason : "other";
					state.reasons[key + "_total"]++;
				}
				const seconds = Math.max(0, (now() - started) / 1000);
				observe(state.duration, seconds);
				observe(tool.duration, seconds);
			};
		},
		recordRequest(method: string, status: number) {
			state.requests.total++;
			const methodKey = (["GET", "POST", "DELETE", "OPTIONS"].includes(method) ? method : "other") + "_total";
			state.requests[methodKey as keyof typeof state.requests]++;
			const statusKey = status >= 200 && status < 600 ? `status_${Math.floor(status / 100)}xx_total` : "other_status_total";
			state.requests[statusKey as keyof typeof state.requests]++;
		},
		recordOperation(method: unknown) {
			state.operations[typeof method === "string" && Object.hasOwn(OPERATION_KEYS, method) ? OPERATION_KEYS[method] : "other_total"]++;
		},
		snapshot() {
			return structuredClone({ ...state, sampledAt: new Date().toISOString() });
		},
	};
}
export type { McpMetricsSnapshot } from "@/app/lib/mcpMetrics";
declare global {
	var __clipifyMcpMetrics: ReturnType<typeof createMcpMetricsStore> | undefined;
}
export function getMcpMetricsStore() {
	return (globalThis.__clipifyMcpMetrics ??= createMcpMetricsStore());
}
export function getMcpMetricsSnapshot() {
	return getMcpMetricsStore().snapshot();
}
